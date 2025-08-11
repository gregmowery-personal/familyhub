-- Fix rate limiting table schema to match expected columns
-- Adds missing columns that the rate limiter is looking for

-- ============================================================================
-- Fix BLOCKED_IPS table - add missing is_active column
-- ============================================================================
ALTER TABLE public.blocked_ips 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Add expires_at if it doesn't exist (for consistency)
ALTER TABLE public.blocked_ips 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Update existing records to have proper expires_at values
UPDATE public.blocked_ips 
SET expires_at = COALESCE(blocked_until, blocked_at + INTERVAL '1 hour')
WHERE expires_at IS NULL;

-- Now make expires_at NOT NULL
ALTER TABLE public.blocked_ips 
ALTER COLUMN expires_at SET NOT NULL;

-- Update is_active based on blocked_until
UPDATE public.blocked_ips 
SET is_active = CASE 
    WHEN is_permanent = TRUE THEN TRUE
    WHEN blocked_until IS NULL THEN TRUE
    WHEN blocked_until > NOW() THEN TRUE
    ELSE FALSE
END;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_active ON public.blocked_ips(ip_address, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- Fix LOGIN_ATTEMPTS table - add missing key column
-- ============================================================================
ALTER TABLE public.login_attempts 
ADD COLUMN IF NOT EXISTS key VARCHAR(255);

-- Populate the key column for existing records
UPDATE public.login_attempts 
SET key = CONCAT(endpoint, ':', COALESCE(email, 'anonymous'), ':', ip_address::text)
WHERE key IS NULL;

-- Make key NOT NULL after populating
ALTER TABLE public.login_attempts 
ALTER COLUMN key SET NOT NULL;

-- Add missing columns for consistency
ALTER TABLE public.login_attempts 
ADD COLUMN IF NOT EXISTS attempted_at TIMESTAMPTZ;

-- Update attempted_at from existing timestamps
UPDATE public.login_attempts 
SET attempted_at = COALESCE(last_attempt_at, created_at)
WHERE attempted_at IS NULL;

-- Make attempted_at NOT NULL
ALTER TABLE public.login_attempts 
ALTER COLUMN attempted_at SET NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_login_attempts_key_attempted ON public.login_attempts(key, attempted_at);

-- ============================================================================
-- Update cleanup function to handle both schemas
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_blocks()
RETURNS void AS $$
BEGIN
    -- Remove expired IP blocks (handle both schema versions)
    UPDATE public.blocked_ips 
    SET is_active = FALSE
    WHERE expires_at < NOW() AND is_active = TRUE;
    
    -- Also handle old schema with blocked_until
    DELETE FROM public.blocked_ips 
    WHERE blocked_until IS NOT NULL 
      AND blocked_until < NOW() 
      AND (is_permanent = FALSE OR is_permanent IS NULL);
    
    -- Remove old login attempts (older than 30 days)
    DELETE FROM public.login_attempts 
    WHERE COALESCE(attempted_at, last_attempt_at, created_at) < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update helper functions
-- ============================================================================

-- Update is_ip_blocked function to handle both schemas
CREATE OR REPLACE FUNCTION public.is_ip_blocked(check_ip INET)
RETURNS BOOLEAN AS $$
DECLARE
    is_blocked BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.blocked_ips 
        WHERE ip_address = check_ip 
        AND (
            -- New schema with is_active and expires_at
            (is_active = TRUE AND expires_at > NOW()) OR
            -- Old schema with is_permanent and blocked_until  
            (is_permanent = TRUE OR (blocked_until IS NOT NULL AND blocked_until > NOW()))
        )
    ) INTO is_blocked;
    
    RETURN is_blocked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update record_login_attempt function to handle new key column
CREATE OR REPLACE FUNCTION public.record_login_attempt(
    p_ip_address INET,
    p_endpoint TEXT,
    p_success BOOLEAN,
    p_email TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_error_code TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    attempt_key TEXT;
BEGIN
    -- Generate key for the attempt
    attempt_key := CONCAT(p_endpoint, ':', COALESCE(p_email, 'anonymous'), ':', p_ip_address::text);
    
    INSERT INTO public.login_attempts (
        key,
        ip_address,
        endpoint,
        success,
        email,
        user_agent,
        error_code,
        attempt_count,
        attempted_at,
        first_attempt_at,
        last_attempt_at
    ) VALUES (
        attempt_key,
        p_ip_address,
        p_endpoint,
        p_success,
        p_email,
        p_user_agent,
        p_error_code,
        1,
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (key) DO UPDATE
    SET 
        attempt_count = login_attempts.attempt_count + 1,
        attempted_at = NOW(),
        last_attempt_at = NOW(),
        success = EXCLUDED.success,
        error_code = EXCLUDED.error_code,
        user_agent = EXCLUDED.user_agent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration completed: Fixed rate limiting table schema to match expected columns (is_active, key, attempted_at)