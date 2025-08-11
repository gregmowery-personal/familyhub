-- Fix function signatures to match TypeScript expectations
-- Migration: 20250806000010_fix_function_signatures.sql

-- 1. Fix get_user_families function to return detailed family information
-- Note: Working with family_members table that has user_role_type enum column
CREATE OR REPLACE FUNCTION public.get_user_families(user_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  family_type TEXT,
  timezone TEXT,
  role TEXT,
  is_family_admin BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.family_type::TEXT,
    COALESCE(f.timezone, 'America/New_York') as timezone,
    fm.role::TEXT as role,
    fm.is_family_admin as is_family_admin
  FROM public.families f
  INNER JOIN public.family_members fm ON f.id = fm.family_id
  WHERE fm.user_id = get_user_families.user_id 
    AND (fm.deleted_at IS NULL OR fm.deleted_at IS NULL)
    AND (f.deleted_at IS NULL OR f.deleted_at IS NULL)
  ORDER BY fm.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_families IS 'Returns detailed family information for a user including role and admin status';

-- 2. Fix create_user_session function to match calling signature
CREATE OR REPLACE FUNCTION public.create_user_session(
  user_id UUID,
  session_token VARCHAR(255),
  device_info JSONB DEFAULT NULL,
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
BEGIN
  -- Set default expiration to 30 days from now
  expires_at := NOW() + INTERVAL '30 days';
  
  -- Extract device ID from device info
  device_id := COALESCE(device_info->>'device_id', 'unknown');
  
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
    COALESCE(device_info->>'device_name', 'Unknown Device'),
    COALESCE(device_info->>'device_type', 'unknown'),
    COALESCE(device_info->>'platform', 'unknown'),
    COALESCE(device_info->>'browser_name', 'unknown'),
    COALESCE(device_info->>'browser_version', 'unknown'),
    create_user_session.ip_address::INET,
    device_info->>'country',
    device_info->>'city',
    create_user_session.user_agent,
    expires_at,
    user_role::user_role_type
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
      'device_info', device_info,
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

COMMENT ON FUNCTION public.create_user_session IS 'Creates new session with device tracking and family context, matches TypeScript calling signature';

-- Note: Index creation skipped as family_members table may not exist in remote database
-- These can be added later when the table structure is confirmed:
-- CREATE INDEX IF NOT EXISTS idx_family_members_user_primary 
-- ON public.family_members (user_id, is_primary_contact) 
-- WHERE deleted_at IS NULL;

-- CREATE INDEX IF NOT EXISTS idx_families_active 
-- ON public.families (id) 
-- WHERE deleted_at IS NULL;