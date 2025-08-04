-- FamilyHub Session Management - Migration 2
-- This migration creates tables for enhanced session management beyond Supabase's built-in sessions
-- Includes device tracking, concurrent session limits, and family-specific session features

-- Session tracking table - Enhanced session management
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  
  -- Session identification
  session_token VARCHAR(255) NOT NULL UNIQUE, -- Maps to Supabase session
  refresh_token_hash VARCHAR(255), -- Hashed refresh token for security
  
  -- Device and location information
  device_id VARCHAR(255), -- Unique device identifier
  device_name VARCHAR(100), -- User-friendly device name
  device_type VARCHAR(20), -- 'mobile', 'tablet', 'desktop', 'web'
  platform VARCHAR(50), -- 'iOS', 'Android', 'Windows', 'macOS', 'Linux', 'Web'
  browser_name VARCHAR(50),
  browser_version VARCHAR(20),
  
  -- Network information
  ip_address INET,
  country VARCHAR(2), -- ISO country code
  city VARCHAR(100),
  user_agent TEXT,
  
  -- Session lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ, -- When session was explicitly ended
  
  -- Session status and security
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_trusted_device BOOLEAN NOT NULL DEFAULT FALSE,
  requires_reauth BOOLEAN NOT NULL DEFAULT FALSE, -- Force re-authentication
  
  -- Security flags
  is_suspicious BOOLEAN NOT NULL DEFAULT FALSE, -- Flagged by security system
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  
  -- Family context
  active_family_role user_role_type, -- Current role in active family context
  
  CONSTRAINT valid_expires_at CHECK (expires_at > created_at)
);

-- Indexes for performance and security queries
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_family_id ON public.user_sessions(family_id);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_user_sessions_device ON public.user_sessions(user_id, device_id);
CREATE INDEX idx_user_sessions_last_activity ON public.user_sessions(last_activity_at);
CREATE INDEX idx_user_sessions_expires ON public.user_sessions(expires_at) WHERE is_active = TRUE;
CREATE INDEX idx_user_sessions_suspicious ON public.user_sessions(user_id) WHERE is_suspicious = TRUE;
CREATE INDEX idx_user_sessions_ip ON public.user_sessions(ip_address);

-- Device management table - Track user devices for security
CREATE TABLE public.user_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Device identification
  device_id VARCHAR(255) NOT NULL, -- Unique device identifier
  device_name VARCHAR(100) NOT NULL, -- User-assigned name
  device_type VARCHAR(20) NOT NULL, -- 'mobile', 'tablet', 'desktop'
  platform VARCHAR(50) NOT NULL, -- 'iOS', 'Android', 'Windows', etc.
  
  -- Device fingerprinting for security
  fingerprint_hash VARCHAR(255), -- Hash of device characteristics
  push_token VARCHAR(500), -- For push notifications
  
  -- Trust and security
  is_trusted BOOLEAN NOT NULL DEFAULT FALSE,
  trust_established_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Device status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,
  
  -- Metadata
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique device per user
CREATE UNIQUE INDEX idx_user_devices_unique ON public.user_devices(user_id, device_id);

-- Performance indexes
CREATE INDEX idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX idx_user_devices_trusted ON public.user_devices(user_id, is_trusted);
CREATE INDEX idx_user_devices_active ON public.user_devices(user_id, is_active);
CREATE INDEX idx_user_devices_last_seen ON public.user_devices(last_seen_at);

-- Session limits table - Control concurrent sessions per user/family
CREATE TABLE public.session_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  
  -- Limit configuration
  max_concurrent_sessions INTEGER NOT NULL DEFAULT 5,
  max_device_sessions INTEGER NOT NULL DEFAULT 3, -- Max sessions per device
  max_family_sessions INTEGER, -- Max sessions when accessing this family
  
  -- Enforcement settings
  auto_logout_inactive_hours INTEGER NOT NULL DEFAULT 24,
  force_single_session BOOLEAN NOT NULL DEFAULT FALSE, -- For high-security users
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure either user_id or family_id is set (not both)
  CONSTRAINT session_limits_user_or_family CHECK (
    (user_id IS NOT NULL AND family_id IS NULL) OR 
    (user_id IS NULL AND family_id IS NOT NULL)
  )
);

-- Unique limits per user and family
CREATE UNIQUE INDEX idx_session_limits_user ON public.session_limits(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_session_limits_family ON public.session_limits(family_id) WHERE family_id IS NOT NULL;

-- Login attempts table - Track authentication attempts for security
CREATE TABLE public.login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User identification (may be null for failed attempts)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(255), -- Email used in attempt (for failed attempts)
  
  -- Attempt details
  attempt_type VARCHAR(20) NOT NULL, -- 'password', 'social', 'magic_link', 'otp'
  provider VARCHAR(50), -- 'email', 'google', 'apple', etc.
  success BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason VARCHAR(100), -- 'invalid_password', 'user_not_found', etc.
  
  -- Security information
  ip_address INET NOT NULL,
  user_agent TEXT,
  country VARCHAR(2),
  city VARCHAR(100),
  
  -- Device context
  device_id VARCHAR(255),
  device_fingerprint VARCHAR(255),
  
  -- Risk assessment
  risk_score INTEGER, -- 0-100, higher is more risky
  is_suspicious BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_by_rate_limit BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Metadata
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- MFA context
  mfa_required BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_completed BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_method VARCHAR(20) -- 'totp', 'sms', 'email'
);

-- Indexes for security analysis and rate limiting
CREATE INDEX idx_login_attempts_user_id ON public.login_attempts(user_id);
CREATE INDEX idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX idx_login_attempts_ip ON public.login_attempts(ip_address, attempted_at);
CREATE INDEX idx_login_attempts_device ON public.login_attempts(device_id, attempted_at);
CREATE INDEX idx_login_attempts_suspicious ON public.login_attempts(attempted_at) WHERE is_suspicious = TRUE;
CREATE INDEX idx_login_attempts_failed ON public.login_attempts(ip_address, attempted_at) WHERE success = FALSE;
CREATE INDEX idx_login_attempts_recent ON public.login_attempts(attempted_at) WHERE attempted_at > NOW() - INTERVAL '24 hours';

-- Function to update last activity and clean up expired sessions
CREATE OR REPLACE FUNCTION public.update_session_activity(session_token VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
  session_exists BOOLEAN;
BEGIN
  UPDATE public.user_sessions 
  SET 
    last_activity_at = NOW(),
    failed_attempts = 0 -- Reset failed attempts on successful activity
  WHERE 
    session_token = $1 
    AND is_active = TRUE 
    AND expires_at > NOW();
  
  GET DIAGNOSTICS session_exists = FOUND;
  
  -- Clean up expired sessions
  UPDATE public.user_sessions 
  SET 
    is_active = FALSE,
    ended_at = NOW()
  WHERE 
    expires_at <= NOW() 
    AND is_active = TRUE;
  
  RETURN session_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to enforce session limits
CREATE OR REPLACE FUNCTION public.enforce_session_limits(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  max_sessions INTEGER;
  current_sessions INTEGER;
  oldest_session_id UUID;
BEGIN
  -- Get session limit for user
  SELECT COALESCE(sl.max_concurrent_sessions, 5) INTO max_sessions
  FROM public.session_limits sl
  WHERE sl.user_id = p_user_id;
  
  -- Count current active sessions
  SELECT COUNT(*) INTO current_sessions
  FROM public.user_sessions
  WHERE user_id = p_user_id AND is_active = TRUE AND expires_at > NOW();
  
  -- If over limit, deactivate oldest sessions
  WHILE current_sessions >= max_sessions LOOP
    SELECT id INTO oldest_session_id
    FROM public.user_sessions
    WHERE user_id = p_user_id AND is_active = TRUE AND expires_at > NOW()
    ORDER BY last_activity_at ASC
    LIMIT 1;
    
    UPDATE public.user_sessions
    SET is_active = FALSE, ended_at = NOW()
    WHERE id = oldest_session_id;
    
    current_sessions := current_sessions - 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create new session with device tracking
CREATE OR REPLACE FUNCTION public.create_user_session(
  p_user_id UUID,
  p_session_token VARCHAR(255),
  p_device_info JSONB,
  p_ip_address INET,
  p_expires_at TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
  session_id UUID;
  device_id VARCHAR(255);
  family_id UUID;
  user_role user_role_type;
BEGIN
  -- Extract device ID from device info
  device_id := p_device_info->>'device_id';
  
  -- Get user's primary family and role
  SELECT fm.family_id, fm.role INTO family_id, user_role
  FROM public.family_members fm
  WHERE fm.user_id = p_user_id AND fm.is_primary_contact = TRUE
  LIMIT 1;
  
  -- If no primary family, get first family
  IF family_id IS NULL THEN
    SELECT fm.family_id, fm.role INTO family_id, user_role
    FROM public.family_members fm
    WHERE fm.user_id = p_user_id
    ORDER BY fm.joined_at ASC
    LIMIT 1;
  END IF;
  
  -- Enforce session limits
  PERFORM public.enforce_session_limits(p_user_id);
  
  -- Create session record
  INSERT INTO public.user_sessions (
    user_id, family_id, session_token, device_id, device_name, device_type,
    platform, browser_name, browser_version, ip_address, country, city,
    user_agent, expires_at, active_family_role
  ) VALUES (
    p_user_id, family_id, p_session_token,
    device_id,
    p_device_info->>'device_name',
    p_device_info->>'device_type',
    p_device_info->>'platform',
    p_device_info->>'browser_name',
    p_device_info->>'browser_version',
    p_ip_address,
    p_device_info->>'country',
    p_device_info->>'city',
    p_device_info->>'user_agent',
    p_expires_at,
    user_role
  ) RETURNING id INTO session_id;
  
  -- Update or create device record
  INSERT INTO public.user_devices (
    user_id, device_id, device_name, device_type, platform,
    fingerprint_hash, last_seen_at
  ) VALUES (
    p_user_id,
    device_id,
    p_device_info->>'device_name',
    p_device_info->>'device_type',
    p_device_info->>'platform',
    p_device_info->>'fingerprint_hash',
    NOW()
  ) ON CONFLICT (user_id, device_id) DO UPDATE SET
    last_seen_at = NOW(),
    device_name = EXCLUDED.device_name;
  
  RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for updated_at columns
CREATE TRIGGER update_user_devices_updated_at
  BEFORE UPDATE ON public.user_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_limits_updated_at
  BEFORE UPDATE ON public.session_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.user_sessions IS 'Enhanced session tracking with device information and family context';
COMMENT ON TABLE public.user_devices IS 'Device management and trust tracking for users';
COMMENT ON TABLE public.session_limits IS 'Configurable limits for concurrent sessions per user or family';
COMMENT ON TABLE public.login_attempts IS 'Security audit log of all authentication attempts';

COMMENT ON FUNCTION public.update_session_activity IS 'Updates session activity timestamp and cleans up expired sessions';
COMMENT ON FUNCTION public.enforce_session_limits IS 'Enforces maximum concurrent session limits by deactivating oldest sessions';
COMMENT ON FUNCTION public.create_user_session IS 'Creates new session with device tracking and family context';