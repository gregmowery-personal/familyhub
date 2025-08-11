-- Create rate limiting tables for security
-- These tables protect the realm from attacks while allowing legitimate users through

-- ============================================================================
-- BLOCKED IPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    reason TEXT,
    blocked_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    blocked_by TEXT,
    is_permanent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique IP addresses
    CONSTRAINT blocked_ips_ip_unique UNIQUE(ip_address)
);

-- Create indexes for performance
CREATE INDEX idx_blocked_ips_ip_address ON public.blocked_ips(ip_address);
CREATE INDEX idx_blocked_ips_blocked_until ON public.blocked_ips(blocked_until);

-- Enable RLS
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

-- Only system can manage blocked IPs
CREATE POLICY "System manages blocked IPs" 
    ON public.blocked_ips 
    FOR ALL 
    USING (false) 
    WITH CHECK (false);

-- ============================================================================
-- LOGIN ATTEMPTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    user_agent TEXT,
    email TEXT,
    endpoint TEXT NOT NULL,
    success BOOLEAN DEFAULT FALSE,
    error_code TEXT,
    attempt_count INTEGER DEFAULT 1,
    first_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Composite key for tracking attempts
    CONSTRAINT login_attempts_unique_key UNIQUE(ip_address, endpoint, email)
);

-- Create indexes for performance
CREATE INDEX idx_login_attempts_ip_address ON public.login_attempts(ip_address);
CREATE INDEX idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX idx_login_attempts_endpoint ON public.login_attempts(endpoint);
CREATE INDEX idx_login_attempts_last_attempt ON public.login_attempts(last_attempt_at);
CREATE INDEX idx_login_attempts_blocked_until ON public.login_attempts(blocked_until);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only system can manage login attempts
CREATE POLICY "System manages login attempts" 
    ON public.login_attempts 
    FOR ALL 
    USING (false) 
    WITH CHECK (false);

-- ============================================================================
-- CLEANUP FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_blocks()
RETURNS void AS $$
BEGIN
    -- Remove expired IP blocks
    DELETE FROM public.blocked_ips 
    WHERE blocked_until < NOW() AND is_permanent = FALSE;
    
    -- Remove old login attempts (older than 30 days)
    DELETE FROM public.login_attempts 
    WHERE last_attempt_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Set up periodic cleanup (requires pg_cron)
-- SELECT cron.schedule('cleanup-expired-blocks', '0 */6 * * *', 'SELECT public.cleanup_expired_blocks();');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if IP is blocked
CREATE OR REPLACE FUNCTION public.is_ip_blocked(check_ip INET)
RETURNS BOOLEAN AS $$
DECLARE
    is_blocked BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.blocked_ips 
        WHERE ip_address = check_ip 
        AND (is_permanent = TRUE OR blocked_until > NOW())
    ) INTO is_blocked;
    
    RETURN is_blocked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record login attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(
    p_ip_address INET,
    p_endpoint TEXT,
    p_success BOOLEAN,
    p_email TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_error_code TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.login_attempts (
        ip_address,
        endpoint,
        success,
        email,
        user_agent,
        error_code,
        attempt_count,
        first_attempt_at,
        last_attempt_at
    ) VALUES (
        p_ip_address,
        p_endpoint,
        p_success,
        p_email,
        p_user_agent,
        p_error_code,
        1,
        NOW(),
        NOW()
    )
    ON CONFLICT (ip_address, endpoint, email) DO UPDATE
    SET 
        attempt_count = login_attempts.attempt_count + 1,
        last_attempt_at = NOW(),
        success = EXCLUDED.success,
        error_code = EXCLUDED.error_code,
        user_agent = EXCLUDED.user_agent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.blocked_ips IS 'Tracks blocked IP addresses for security';
COMMENT ON TABLE public.login_attempts IS 'Tracks login attempts for rate limiting';
COMMENT ON FUNCTION public.is_ip_blocked IS 'Check if an IP address is currently blocked';
COMMENT ON FUNCTION public.record_login_attempt IS 'Record a login attempt for rate limiting';