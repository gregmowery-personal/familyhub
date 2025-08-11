-- Remove password-related columns and tables
-- Going passwordless for FamilyHub.care

-- Drop password reset token types from auth_tokens
ALTER TABLE auth_tokens 
DROP CONSTRAINT IF EXISTS auth_tokens_token_type_check;

ALTER TABLE auth_tokens 
ADD CONSTRAINT auth_tokens_token_type_check 
CHECK (token_type IN ('email_verification', 'family_invitation', 'magic_link', 'mfa_backup', 'account_verification', 'session_challenge'));

-- Remove any existing password reset tokens
DELETE FROM auth_tokens WHERE token_type = 'password_reset';

-- Note: We cannot directly modify Supabase Auth's internal tables
-- Password columns in auth.users are managed by Supabase
-- For a true passwordless implementation, you would:
-- 1. Use Supabase's magic link authentication
-- 2. Or implement a custom OTP/verification code system
-- 3. Or use social auth providers only

-- Update audit event types to remove password-related events
UPDATE audit_events 
SET event_type = 'passwordless_login_attempt'
WHERE event_type IN ('password_reset_requested', 'password_reset_completed', 'password_change');

-- Add comment documenting passwordless approach
COMMENT ON TABLE auth_tokens IS 'Token management for passwordless authentication, email verification, and family invitations';