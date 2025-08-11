-- Fix device_info parameter parsing in create_user_session
-- Migration: 20250806000011_fix_device_info_parsing.sql

-- Drop all existing create_user_session functions to avoid conflicts
DROP FUNCTION IF EXISTS public.create_user_session(UUID, VARCHAR, JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_user_session(UUID, VARCHAR, JSONB, INET, TIMESTAMPTZ);

-- Create the correct function signature that matches the TypeScript calling code
CREATE OR REPLACE FUNCTION public.create_user_session(
  user_id UUID,
  session_token VARCHAR(255),
  device_info TEXT DEFAULT NULL,
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  session_id UUID;
  device_id VARCHAR(255);
  family_id UUID;
  user_role TEXT;
  expires_at TIMESTAMPTZ;
  device_info_json JSONB;
BEGIN
  -- Set default expiration to 30 days from now
  expires_at := NOW() + INTERVAL '30 days';
  
  -- Parse device_info from TEXT to JSONB
  IF device_info IS NOT NULL THEN
    BEGIN
      device_info_json := device_info::JSONB;
    EXCEPTION 
      WHEN OTHERS THEN
        device_info_json := '{}'::JSONB;
    END;
  ELSE
    device_info_json := '{}'::JSONB;
  END IF;
  
  -- Extract device ID from device info
  device_id := COALESCE(device_info_json->>'device_id', 'unknown');
  
  -- Get user's primary family and role from family_members table
  SELECT fm.family_id, fm.role::TEXT INTO family_id, user_role
  FROM public.family_members fm
  WHERE fm.user_id = create_user_session.user_id AND fm.is_primary_contact = TRUE
  LIMIT 1;
  
  -- If no primary family, get first family
  IF family_id IS NULL THEN
    SELECT fm.family_id, fm.role::TEXT INTO family_id, user_role
    FROM public.family_members fm
    WHERE fm.user_id = create_user_session.user_id
    ORDER BY fm.joined_at ASC
    LIMIT 1;
  END IF;
  
  -- Enforce session limits
  PERFORM public.enforce_session_limits(create_user_session.user_id);
  
  -- Create session record
  INSERT INTO public.user_sessions (
    user_id, family_id, session_token, device_id, device_name, device_type,
    platform, browser_name, browser_version, ip_address, country, city,
    user_agent, expires_at, active_family_role
  ) VALUES (
    create_user_session.user_id, 
    family_id, 
    create_user_session.session_token,
    device_id,
    COALESCE(device_info_json->>'device_name', 'Unknown Device'),
    COALESCE(device_info_json->>'device_type', 'unknown'),
    COALESCE(device_info_json->>'platform', 'unknown'),
    COALESCE(device_info_json->>'browser_name', 'unknown'),
    COALESCE(device_info_json->>'browser_version', 'unknown'),
    create_user_session.ip_address::INET,
    device_info_json->>'country',
    device_info_json->>'city',
    create_user_session.user_agent,
    expires_at,
    COALESCE(user_role::user_role_type, 'adult'::user_role_type)
  ) RETURNING id INTO session_id;
  
  -- Update last login time for the user
  UPDATE public.user_profiles 
  SET 
    last_login_at = NOW(),
    updated_at = NOW()
  WHERE id = create_user_session.user_id;
  
  -- Log the session creation
  PERFORM public.log_audit_event(
    'session_created',
    'authentication',
    'User session created successfully',
    create_user_session.user_id,
    family_id,
    jsonb_build_object(
      'session_id', session_id,
      'device_info', device_info_json,
      'ip_address', create_user_session.ip_address,
      'user_agent', create_user_session.user_agent
    )
  );
  
  RETURN session_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    PERFORM public.log_audit_event(
      'session_creation_failed',
      'authentication',
      'Failed to create user session: ' || SQLERRM,
      create_user_session.user_id,
      family_id,
      jsonb_build_object(
        'error', SQLERRM,
        'ip_address', create_user_session.ip_address,
        'user_agent', create_user_session.user_agent
      )
    );
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_user_session IS 'Creates new session with device tracking and family context, handles device_info as TEXT input';