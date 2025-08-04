-- FamilyHub Social Authentication Providers - Migration 4
-- This migration creates tables for managing social authentication providers
-- Supports Google, Apple, and other OAuth providers with account linking

-- Social provider types enum
CREATE TYPE social_provider_type AS ENUM (
  'google',
  'apple', 
  'facebook',
  'microsoft',
  'github',
  'twitter',
  'linkedin'
);

-- Account linking status enum
CREATE TYPE link_status AS ENUM (
  'active',      -- Account is linked and active
  'pending',     -- Link is pending verification
  'disabled',    -- Temporarily disabled
  'revoked'      -- Permanently revoked
);

-- Social auth providers table - Tracks user connections to social providers
CREATE TABLE public.social_auth_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Provider information
  provider social_provider_type NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL, -- User ID from the social provider
  provider_username VARCHAR(100), -- Username/handle on the social platform
  provider_email VARCHAR(255), -- Email from social provider (may differ from user's primary)
  
  -- Account details from provider
  provider_data JSONB, -- Raw provider data (profile info, etc.)
  display_name VARCHAR(255), -- Display name from provider
  avatar_url TEXT, -- Profile picture URL from provider
  
  -- Linking metadata
  link_status link_status NOT NULL DEFAULT 'active',
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  
  -- Security and verification
  access_token_hash VARCHAR(255), -- Hashed access token (for security)
  refresh_token_hash VARCHAR(255), -- Hashed refresh token
  token_expires_at TIMESTAMPTZ,
  scope VARCHAR(500), -- OAuth scopes granted
  
  -- Audit information
  linking_ip_address INET,
  linking_user_agent TEXT,
  
  -- Account management
  is_primary_provider BOOLEAN NOT NULL DEFAULT FALSE, -- Primary social login method
  auto_login_enabled BOOLEAN NOT NULL DEFAULT TRUE, -- Can this provider auto-login the user
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT
);

-- Unique constraint: one account per provider per user
CREATE UNIQUE INDEX idx_social_auth_unique_user_provider 
ON public.social_auth_providers(user_id, provider);

-- Unique constraint: one provider account can only link to one user
CREATE UNIQUE INDEX idx_social_auth_unique_provider_account 
ON public.social_auth_providers(provider, provider_user_id);

-- Performance indexes
CREATE INDEX idx_social_auth_user_id ON public.social_auth_providers(user_id);
CREATE INDEX idx_social_auth_provider ON public.social_auth_providers(provider);
CREATE INDEX idx_social_auth_provider_email ON public.social_auth_providers(provider_email);
CREATE INDEX idx_social_auth_status ON public.social_auth_providers(link_status);
CREATE INDEX idx_social_auth_primary ON public.social_auth_providers(user_id) WHERE is_primary_provider = TRUE;
CREATE INDEX idx_social_auth_last_used ON public.social_auth_providers(last_used_at);

-- Social login attempts table - Track social authentication attempts
CREATE TABLE public.social_login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User and provider context
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider social_provider_type NOT NULL,
  provider_user_id VARCHAR(255), -- May be null for failed attempts
  provider_email VARCHAR(255),
  
  -- Attempt details
  attempt_result VARCHAR(50) NOT NULL, -- 'success', 'failed', 'cancelled', 'error'
  error_code VARCHAR(100), -- Provider-specific error code
  error_message TEXT, -- Human-readable error message
  
  -- OAuth flow details
  state_parameter VARCHAR(255), -- OAuth state for CSRF protection
  code_challenge VARCHAR(255), -- PKCE code challenge
  redirect_uri TEXT, -- Where user was redirected from
  
  -- Security information
  ip_address INET NOT NULL,
  user_agent TEXT,
  country VARCHAR(2),
  city VARCHAR(100),
  
  -- Device context
  device_id VARCHAR(255),
  session_id UUID, -- Reference to session if successful
  
  -- Timing
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ, -- When OAuth flow completed
  
  -- Security flags
  is_suspicious BOOLEAN NOT NULL DEFAULT FALSE,
  risk_score INTEGER, -- 0-100 risk assessment
  
  -- Metadata
  provider_response JSONB -- Raw response from provider (sanitized)
);

-- Indexes for social login attempts
CREATE INDEX idx_social_login_attempts_user ON public.social_login_attempts(user_id);
CREATE INDEX idx_social_login_attempts_provider ON public.social_login_attempts(provider, attempted_at);
CREATE INDEX idx_social_login_attempts_result ON public.social_login_attempts(attempt_result, attempted_at);
CREATE INDEX idx_social_login_attempts_ip ON public.social_login_attempts(ip_address, attempted_at);
CREATE INDEX idx_social_login_attempts_suspicious ON public.social_login_attempts(attempted_at) WHERE is_suspicious = TRUE;
CREATE INDEX idx_social_login_attempts_recent ON public.social_login_attempts(attempted_at) WHERE attempted_at > NOW() - INTERVAL '7 days';

-- Account linking requests table - Track pending account linking requests
CREATE TABLE public.account_linking_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Request details
  requesting_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_provider social_provider_type NOT NULL,
  target_provider_user_id VARCHAR(255) NOT NULL,
  target_provider_email VARCHAR(255),
  
  -- Request status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'denied', 'expired'
  
  -- Verification
  verification_token_hash VARCHAR(255),
  verification_code VARCHAR(10), -- Short numeric code for mobile verification
  
  -- Security
  ip_address INET NOT NULL,
  user_agent TEXT,
  
  -- Approval workflow (for sensitive account linking)
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  completed_at TIMESTAMPTZ,
  
  -- Provider data
  provider_data JSONB -- Temporary storage of provider data during linking
);

-- Performance indexes
CREATE INDEX idx_account_linking_user ON public.account_linking_requests(requesting_user_id);
CREATE INDEX idx_account_linking_status ON public.account_linking_requests(status, expires_at);
CREATE INDEX idx_account_linking_token ON public.account_linking_requests(verification_token_hash);
CREATE INDEX idx_account_linking_provider ON public.account_linking_requests(target_provider, target_provider_user_id);

-- Provider configuration table - Store provider-specific settings
CREATE TABLE public.social_provider_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Provider details
  provider social_provider_type NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- OAuth configuration
  client_id VARCHAR(255) NOT NULL,
  client_secret_hash VARCHAR(255), -- Encrypted client secret
  redirect_uri TEXT NOT NULL,
  scope VARCHAR(500) NOT NULL,
  
  -- Provider-specific settings
  settings JSONB NOT NULL DEFAULT '{}',
  
  -- Feature flags
  supports_refresh_tokens BOOLEAN NOT NULL DEFAULT TRUE,
  supports_pkce BOOLEAN NOT NULL DEFAULT FALSE,
  requires_email_verification BOOLEAN NOT NULL DEFAULT FALSE,
  auto_link_existing_users BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Rate limiting
  max_attempts_per_hour INTEGER NOT NULL DEFAULT 100,
  max_attempts_per_day INTEGER NOT NULL DEFAULT 1000,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_tested_at TIMESTAMPTZ
);

-- Insert default provider configurations
INSERT INTO public.social_provider_configs (provider, client_id, redirect_uri, scope) VALUES
('google', 'placeholder_client_id', 'https://your-domain.com/auth/callback/google', 'openid email profile'),
('apple', 'placeholder_client_id', 'https://your-domain.com/auth/callback/apple', 'name email');

-- Function to link social provider account
CREATE OR REPLACE FUNCTION public.link_social_provider(
  p_user_id UUID,
  p_provider social_provider_type,
  p_provider_user_id VARCHAR(255),
  p_provider_email VARCHAR(255),
  p_provider_data JSONB,
  p_ip_address INET DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  link_id UUID;
  existing_link UUID;
BEGIN
  -- Check if this provider account is already linked to another user
  SELECT id INTO existing_link
  FROM public.social_auth_providers
  WHERE provider = p_provider AND provider_user_id = p_provider_user_id;
  
  IF existing_link IS NOT NULL THEN
    RAISE EXCEPTION 'Provider account already linked to another user';
  END IF;
  
  -- Create or update the link
  INSERT INTO public.social_auth_providers (
    user_id, provider, provider_user_id, provider_email,
    provider_data, linking_ip_address, last_used_at
  ) VALUES (
    p_user_id, p_provider, p_provider_user_id, p_provider_email,
    p_provider_data, p_ip_address, NOW()
  ) ON CONFLICT (user_id, provider) DO UPDATE SET
    provider_user_id = EXCLUDED.provider_user_id,
    provider_email = EXCLUDED.provider_email,
    provider_data = EXCLUDED.provider_data,
    link_status = 'active',
    last_used_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO link_id;
  
  RETURN link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unlink social provider
CREATE OR REPLACE FUNCTION public.unlink_social_provider(
  p_user_id UUID,
  p_provider social_provider_type,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  provider_count INTEGER;
  has_password BOOLEAN;
BEGIN
  -- Check if user has other authentication methods
  SELECT COUNT(*) INTO provider_count
  FROM public.social_auth_providers
  WHERE user_id = p_user_id AND link_status = 'active' AND provider != p_provider;
  
  -- Check if user has a password set
  SELECT (encrypted_password IS NOT NULL) INTO has_password
  FROM auth.users
  WHERE id = p_user_id;
  
  -- Prevent unlinking if it would leave user with no auth method
  IF provider_count = 0 AND NOT has_password THEN
    RAISE EXCEPTION 'Cannot unlink last authentication method. Set a password first.';
  END IF;
  
  -- Update the link status
  UPDATE public.social_auth_providers
  SET 
    link_status = 'revoked',
    revoked_at = NOW(),
    revoked_reason = COALESCE(p_reason, 'User requested'),
    updated_at = NOW()
  WHERE user_id = p_user_id AND provider = p_provider;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's social providers
CREATE OR REPLACE FUNCTION public.get_user_social_providers(p_user_id UUID)
RETURNS TABLE(
  provider social_provider_type,
  provider_email VARCHAR(255),
  display_name VARCHAR(255),
  linked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  is_primary BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sap.provider,
    sap.provider_email,
    sap.display_name,
    sap.linked_at,
    sap.last_used_at,
    sap.is_primary_provider
  FROM public.social_auth_providers sap
  WHERE sap.user_id = p_user_id AND sap.link_status = 'active'
  ORDER BY sap.is_primary_provider DESC, sap.linked_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for updated_at columns  
CREATE TRIGGER update_social_auth_providers_updated_at
  BEFORE UPDATE ON public.social_auth_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_provider_configs_updated_at
  BEFORE UPDATE ON public.social_provider_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.social_auth_providers IS 'Manages user connections to social authentication providers (Google, Apple, etc.)';
COMMENT ON TABLE public.social_login_attempts IS 'Audit log of all social authentication attempts for security monitoring';
COMMENT ON TABLE public.account_linking_requests IS 'Tracks pending requests to link social accounts with additional verification';
COMMENT ON TABLE public.social_provider_configs IS 'Configuration settings for each social authentication provider';

COMMENT ON FUNCTION public.link_social_provider IS 'Links a social provider account to a user with conflict checking';
COMMENT ON FUNCTION public.unlink_social_provider IS 'Safely unlinks a social provider ensuring user retains auth method';
COMMENT ON FUNCTION public.get_user_social_providers IS 'Returns all active social providers for a user';