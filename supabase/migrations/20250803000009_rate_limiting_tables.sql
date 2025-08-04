-- Rate limiting and security tables for FamilyHub authentication

-- Login attempts tracking for rate limiting
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT FALSE,
  email VARCHAR(255),
  endpoint VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Blocked IPs for security
CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address INET NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_login_attempts_key_attempted ON public.login_attempts(key, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_attempted ON public.login_attempts(ip_address, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success_attempted ON public.login_attempts(success, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_endpoint_attempted ON public.login_attempts(endpoint, attempted_at);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_active ON public.blocked_ips(ip_address, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires ON public.blocked_ips(expires_at) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

-- RLS Policies for login_attempts (system table, no user access needed)
CREATE POLICY "System can manage login attempts"
  ON public.login_attempts
  FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for blocked_ips (system table, no user access needed)
CREATE POLICY "System can manage blocked IPs"
  ON public.blocked_ips
  FOR ALL
  TO service_role
  USING (true);

-- Function to cleanup old login attempts
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete login attempts older than 90 days
  DELETE FROM public.login_attempts
  WHERE attempted_at < NOW() - INTERVAL '90 days';
  
  -- Delete expired blocked IPs
  UPDATE public.blocked_ips
  SET is_active = FALSE
  WHERE expires_at < NOW() AND is_active = TRUE;
  
  -- Delete old inactive blocked IP records (older than 30 days)
  DELETE FROM public.blocked_ips
  WHERE is_active = FALSE AND updated_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Create a function to check if an IP is blocked
CREATE OR REPLACE FUNCTION is_ip_blocked(check_ip INET)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  blocked_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO blocked_count
  FROM public.blocked_ips
  WHERE ip_address = check_ip
    AND is_active = TRUE
    AND expires_at > NOW();
    
  RETURN blocked_count > 0;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.login_attempts TO service_role;
GRANT ALL ON public.blocked_ips TO service_role;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION cleanup_old_login_attempts() TO service_role;
GRANT EXECUTE ON FUNCTION is_ip_blocked(INET) TO service_role, authenticated, anon;