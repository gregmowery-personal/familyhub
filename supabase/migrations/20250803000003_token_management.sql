-- FamilyHub Token Management - Migration 3
-- This migration creates tables for managing various authentication tokens
-- Includes password reset, email verification, invitation tokens, and MFA tokens

-- Token types enum for type safety
CREATE TYPE token_type AS ENUM (
  'password_reset',     -- Password recovery tokens
  'email_verification', -- Email address verification
  'family_invitation',  -- Family member invitation tokens
  'magic_link',         -- Magic link authentication
  'mfa_backup',         -- Multi-factor authentication backup codes
  'account_verification', -- New account verification
  'session_challenge'   -- Session security challenges
);

-- Token status enum
CREATE TYPE token_status AS ENUM (
  'active',    -- Token is valid and can be used
  'used',      -- Token has been consumed
  'expired',   -- Token has expired
  'revoked'    -- Token was manually revoked
);

-- Authentication tokens table - Centralized token management
CREATE TABLE public.auth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Token identification
  token_hash VARCHAR(255) NOT NULL UNIQUE, -- SHA-256 hash of the actual token
  token_type token_type NOT NULL,
  token_status token_status NOT NULL DEFAULT 'active',
  
  -- User and context
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255), -- Email for tokens sent to unregistered users
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  
  -- Token properties
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1, -- How many times token can be used
  uses_count INTEGER NOT NULL DEFAULT 0, -- How many times it has been used
  
  -- Security and tracking
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Who created this token
  ip_address INET, -- IP where token was created
  user_agent TEXT, -- User agent where token was created
  
  -- Token-specific data
  metadata JSONB, -- Flexible data storage for token-specific information
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ, -- When token was first used
  revoked_at TIMESTAMPTZ, -- When token was revoked
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_reason TEXT,
  
  CONSTRAINT valid_expires_at CHECK (expires_at > created_at),
  CONSTRAINT valid_uses CHECK (uses_count <= max_uses),
  CONSTRAINT user_or_email CHECK (user_id IS NOT NULL OR email IS NOT NULL)
);

-- Indexes for performance and security
CREATE INDEX idx_auth_tokens_hash ON public.auth_tokens(token_hash);
CREATE INDEX idx_auth_tokens_user_type ON public.auth_tokens(user_id, token_type);
CREATE INDEX idx_auth_tokens_email_type ON public.auth_tokens(email, token_type);
CREATE INDEX idx_auth_tokens_family ON public.auth_tokens(family_id);
CREATE INDEX idx_auth_tokens_status ON public.auth_tokens(token_status, expires_at);
CREATE INDEX idx_auth_tokens_cleanup ON public.auth_tokens(expires_at) WHERE token_status IN ('expired', 'used');
CREATE INDEX idx_auth_tokens_active ON public.auth_tokens(token_type, created_at) WHERE token_status = 'active';

-- Password reset tokens - Specific table for password recovery
CREATE TABLE public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  
  -- Reset context
  old_password_hash VARCHAR(255), -- Hash of password being reset (for audit)
  reset_reason VARCHAR(50), -- 'user_requested', 'admin_forced', 'security_breach'
  
  -- Security measures
  ip_address INET NOT NULL,
  user_agent TEXT,
  requires_current_password BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  used_at TIMESTAMPTZ,
  attempts_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  
  CONSTRAINT valid_reset_expires CHECK (expires_at > created_at),
  CONSTRAINT valid_attempts CHECK (attempts_count <= max_attempts)
);

-- Indexes for password reset tokens
CREATE INDEX idx_password_reset_user ON public.password_reset_tokens(user_id, is_active);
CREATE INDEX idx_password_reset_hash ON public.password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_expires ON public.password_reset_tokens(expires_at) WHERE is_active = TRUE;
CREATE INDEX idx_password_reset_cleanup ON public.password_reset_tokens(expires_at) WHERE is_active = FALSE;

-- Email verification tokens - For verifying email addresses
CREATE TABLE public.email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Email being verified
  email VARCHAR(255) NOT NULL,
  old_email VARCHAR(255), -- Previous email if this is a change
  is_email_change BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Token details
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  verification_code VARCHAR(10), -- Optional numeric code for mobile apps
  
  -- Security
  ip_address INET,
  user_agent TEXT,
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  verified_at TIMESTAMPTZ,
  attempts_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  CONSTRAINT valid_verify_expires CHECK (expires_at > created_at),
  CONSTRAINT valid_verify_attempts CHECK (attempts_count <= max_attempts)
);

-- Indexes for email verification
CREATE INDEX idx_email_verification_user ON public.email_verification_tokens(user_id, is_active);
CREATE INDEX idx_email_verification_email ON public.email_verification_tokens(email, is_active);
CREATE INDEX idx_email_verification_hash ON public.email_verification_tokens(token_hash);
CREATE INDEX idx_email_verification_code ON public.email_verification_tokens(verification_code) WHERE verification_code IS NOT NULL;

-- Family invitation tokens - For inviting users to join families
CREATE TABLE public.family_invitation_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  
  -- Invitation details
  invited_email VARCHAR(255) NOT NULL,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_role user_role_type NOT NULL DEFAULT 'adult',
  relationship VARCHAR(50), -- Suggested relationship
  
  -- Token
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  invitation_message TEXT,
  
  -- Security and limits
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses_count INTEGER NOT NULL DEFAULT 0,
  ip_address INET,
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  declined_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  
  CONSTRAINT valid_invitation_expires CHECK (expires_at > created_at),
  CONSTRAINT valid_invitation_uses CHECK (uses_count <= max_uses)
);

-- Indexes for family invitations
CREATE INDEX idx_family_invitations_family ON public.family_invitation_tokens(family_id, is_active);
CREATE INDEX idx_family_invitations_email ON public.family_invitation_tokens(invited_email, is_active);
CREATE INDEX idx_family_invitations_inviter ON public.family_invitation_tokens(inviter_id);
CREATE INDEX idx_family_invitations_hash ON public.family_invitation_tokens(token_hash);
CREATE INDEX idx_family_invitations_expires ON public.family_invitation_tokens(expires_at) WHERE is_active = TRUE;

-- MFA backup codes - For multi-factor authentication recovery
CREATE TABLE public.mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Code details
  code_hash VARCHAR(255) NOT NULL, -- Hash of the backup code
  code_sequence INTEGER NOT NULL, -- Order in the backup code set
  
  -- Usage tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Code set management
  set_id UUID NOT NULL, -- Groups codes generated together
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  
  -- Security
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Unique constraint for backup codes
CREATE UNIQUE INDEX idx_mfa_backup_codes_user_sequence ON public.mfa_backup_codes(user_id, code_sequence, set_id);
CREATE INDEX idx_mfa_backup_codes_user_active ON public.mfa_backup_codes(user_id, is_active);
CREATE INDEX idx_mfa_backup_codes_set ON public.mfa_backup_codes(set_id);
CREATE INDEX idx_mfa_backup_codes_hash ON public.mfa_backup_codes(code_hash);

-- Function to create password reset token
CREATE OR REPLACE FUNCTION public.create_password_reset_token(
  p_user_id UUID,
  p_token_hash VARCHAR(255),
  p_ip_address INET,
  p_user_agent TEXT DEFAULT NULL,
  p_expires_hours INTEGER DEFAULT 1
)
RETURNS UUID AS $$
DECLARE
  reset_token_id UUID;
BEGIN
  -- Revoke any existing active reset tokens for this user
  UPDATE public.password_reset_tokens
  SET is_active = FALSE, revoked_at = NOW()
  WHERE user_id = p_user_id AND is_active = TRUE;
  
  -- Create new reset token
  INSERT INTO public.password_reset_tokens (
    user_id, token_hash, ip_address, user_agent, expires_at
  ) VALUES (
    p_user_id, 
    p_token_hash, 
    p_ip_address, 
    p_user_agent,
    NOW() + (p_expires_hours || ' hours')::INTERVAL
  ) RETURNING id INTO reset_token_id;
  
  RETURN reset_token_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify and consume token
CREATE OR REPLACE FUNCTION public.verify_token(
  p_token_hash VARCHAR(255),
  p_token_type token_type
)
RETURNS TABLE(
  token_id UUID,
  user_id UUID,
  email VARCHAR(255),
  family_id UUID,
  metadata JSONB,
  is_valid BOOLEAN
) AS $$
DECLARE
  token_record RECORD;
  is_valid BOOLEAN := FALSE;
BEGIN
  -- Get token record
  SELECT * INTO token_record
  FROM public.auth_tokens
  WHERE token_hash = p_token_hash AND token_type = p_token_type;
  
  -- Check token validity
  IF token_record.id IS NOT NULL THEN
    is_valid := (
      token_record.token_status = 'active' AND
      token_record.expires_at > NOW() AND
      token_record.uses_count < token_record.max_uses
    );
    
    -- If valid, increment usage count
    IF is_valid THEN
      UPDATE public.auth_tokens
      SET 
        uses_count = uses_count + 1,
        used_at = COALESCE(used_at, NOW()),
        token_status = CASE 
          WHEN uses_count + 1 >= max_uses THEN 'used'::token_status
          ELSE token_status
        END
      WHERE id = token_record.id;
    END IF;
  END IF;
  
  -- Return result
  RETURN QUERY SELECT 
    token_record.id,
    token_record.user_id,
    token_record.email,
    token_record.family_id,
    token_record.metadata,
    is_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  -- Update expired tokens
  UPDATE public.auth_tokens
  SET token_status = 'expired'
  WHERE token_status = 'active' AND expires_at <= NOW();
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Clean up specific token tables
  UPDATE public.password_reset_tokens
  SET is_active = FALSE
  WHERE is_active = TRUE AND expires_at <= NOW();
  
  UPDATE public.email_verification_tokens
  SET is_active = FALSE
  WHERE is_active = TRUE AND expires_at <= NOW();
  
  UPDATE public.family_invitation_tokens
  SET is_active = FALSE
  WHERE is_active = TRUE AND expires_at <= NOW();
  
  UPDATE public.mfa_backup_codes
  SET is_active = FALSE
  WHERE is_active = TRUE AND expires_at <= NOW();
  
  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate MFA backup codes
CREATE OR REPLACE FUNCTION public.generate_mfa_backup_codes(
  p_user_id UUID,
  p_generated_by UUID,
  p_ip_address INET,
  p_code_hashes TEXT[]
)
RETURNS UUID AS $$
DECLARE
  set_id UUID := uuid_generate_v4();
  code_hash TEXT;
  sequence_num INTEGER := 1;
BEGIN
  -- Deactivate existing backup codes
  UPDATE public.mfa_backup_codes
  SET is_active = FALSE
  WHERE user_id = p_user_id AND is_active = TRUE;
  
  -- Insert new backup codes
  FOREACH code_hash IN ARRAY p_code_hashes LOOP
    INSERT INTO public.mfa_backup_codes (
      user_id, code_hash, code_sequence, set_id, 
      generated_by, ip_address
    ) VALUES (
      p_user_id, code_hash, sequence_num, set_id,
      p_generated_by, p_ip_address
    );
    
    sequence_num := sequence_num + 1;
  END LOOP;
  
  RETURN set_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE public.auth_tokens IS 'Centralized token management for various authentication purposes';
COMMENT ON TABLE public.password_reset_tokens IS 'Specific tokens for password recovery with enhanced security';
COMMENT ON TABLE public.email_verification_tokens IS 'Tokens for verifying email addresses and email changes';
COMMENT ON TABLE public.family_invitation_tokens IS 'Invitation tokens for adding members to families';
COMMENT ON TABLE public.mfa_backup_codes IS 'Backup codes for multi-factor authentication recovery';

COMMENT ON FUNCTION public.create_password_reset_token IS 'Creates a new password reset token and revokes existing ones';
COMMENT ON FUNCTION public.verify_token IS 'Verifies and consumes an authentication token';
COMMENT ON FUNCTION public.cleanup_expired_tokens IS 'Marks expired tokens as inactive and returns count cleaned';
COMMENT ON FUNCTION public.generate_mfa_backup_codes IS 'Generates new set of MFA backup codes for a user';