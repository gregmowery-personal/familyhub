-- Create email_verifications table for storing verification tokens
CREATE TABLE IF NOT EXISTS public.email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    verification_code VARCHAR(6) NOT NULL, -- 6-digit code for easy testing
    type VARCHAR(50) NOT NULL DEFAULT 'signup', -- signup, password_reset, email_change
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT email_verifications_user_id_type_key UNIQUE(user_id, type)
);

-- Create indexes
CREATE INDEX idx_email_verifications_token ON public.email_verifications(token);
CREATE INDEX idx_email_verifications_user_id ON public.email_verifications(user_id);
CREATE INDEX idx_email_verifications_email ON public.email_verifications(email);
CREATE INDEX idx_email_verifications_expires_at ON public.email_verifications(expires_at);

-- Enable RLS
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own verification records
CREATE POLICY "Users can view own email verifications" 
    ON public.email_verifications 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- System can insert/update verifications (for API routes)
CREATE POLICY "System can manage email verifications" 
    ON public.email_verifications 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- Function to clean up expired verifications
CREATE OR REPLACE FUNCTION public.cleanup_expired_verifications()
RETURNS void AS $$
BEGIN
    DELETE FROM public.email_verifications 
    WHERE expires_at < NOW() AND verified_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Set up a cron job to clean up expired verifications periodically
-- This would need pg_cron extension enabled
-- SELECT cron.schedule('cleanup-expired-verifications', '0 */6 * * *', 'SELECT public.cleanup_expired_verifications();');