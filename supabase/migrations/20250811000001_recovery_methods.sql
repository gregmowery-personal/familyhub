-- Recovery Methods for Passwordless Authentication
-- FamilyHub.care - Account recovery via recovery codes and backup emails

-- Recovery codes table
CREATE TABLE IF NOT EXISTS recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL, -- Hashed recovery code for security
  code_hint TEXT NOT NULL, -- Last 3 characters for user verification
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 years'),
  is_active BOOLEAN DEFAULT true,
  
  CONSTRAINT unique_active_recovery_code UNIQUE(user_id, is_active)
);

-- Backup emails table
CREATE TABLE IF NOT EXISTS backup_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  verification_code TEXT,
  verification_code_expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  CONSTRAINT unique_backup_email UNIQUE(user_id, email),
  CONSTRAINT different_from_primary CHECK (email != (SELECT email FROM auth.users WHERE id = user_id))
);

-- SMS recovery (placeholder for future feature)
CREATE TABLE IF NOT EXISTS sms_recovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  country_code TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT false, -- Disabled until feature is ready
  
  CONSTRAINT unique_sms_recovery UNIQUE(user_id, phone_number)
);

-- Recovery attempts audit table
CREATE TABLE IF NOT EXISTS recovery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT, -- Email attempting recovery
  recovery_method TEXT NOT NULL CHECK (recovery_method IN ('recovery_code', 'backup_email', 'sms')),
  success BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  error_message TEXT,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Session extensions table (for "Remember Me" feature)
CREATE TABLE IF NOT EXISTS session_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  device_fingerprint TEXT,
  extended_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  user_agent TEXT,
  is_trusted_device BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_recovery_codes_user_id ON recovery_codes(user_id) WHERE is_active = true;
CREATE INDEX idx_backup_emails_user_id ON backup_emails(user_id) WHERE is_active = true;
CREATE INDEX idx_recovery_attempts_user_id ON recovery_attempts(user_id);
CREATE INDEX idx_recovery_attempts_email ON recovery_attempts(email);
CREATE INDEX idx_recovery_attempts_attempted_at ON recovery_attempts(attempted_at);
CREATE INDEX idx_session_extensions_user_id ON session_extensions(user_id);
CREATE INDEX idx_session_extensions_expires_at ON session_extensions(expires_at);

-- Row Level Security
ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_recovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_extensions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recovery_codes
CREATE POLICY "Users can view their own recovery codes"
  ON recovery_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recovery codes"
  ON recovery_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recovery codes"
  ON recovery_codes FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for backup_emails
CREATE POLICY "Users can view their own backup emails"
  ON backup_emails FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own backup emails"
  ON backup_emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own backup emails"
  ON backup_emails FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own backup emails"
  ON backup_emails FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for session_extensions
CREATE POLICY "Users can view their own session extensions"
  ON session_extensions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own session extensions"
  ON session_extensions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to generate recovery code
CREATE OR REPLACE FUNCTION generate_recovery_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  -- Generate 10 random alphanumeric characters
  FOR i IN 1..10 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    -- Add hyphen after 5th character
    IF i = 5 THEN
      result := result || '-';
    END IF;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to validate recovery code format
CREATE OR REPLACE FUNCTION is_valid_recovery_code(code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check format: XXXXX-XXXXX (alphanumeric)
  RETURN code ~ '^[A-Z0-9]{5}-[A-Z0-9]{5}$';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired recovery attempts (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_recovery_data()
RETURNS void AS $$
BEGIN
  -- Delete expired recovery codes
  UPDATE recovery_codes 
  SET is_active = false 
  WHERE expires_at < NOW() AND is_active = true;
  
  -- Delete old recovery attempts (keep 90 days)
  DELETE FROM recovery_attempts 
  WHERE attempted_at < NOW() - INTERVAL '90 days';
  
  -- Delete expired session extensions
  DELETE FROM session_extensions 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE recovery_codes IS 'Stores hashed recovery codes for account recovery';
COMMENT ON TABLE backup_emails IS 'Backup email addresses for account recovery';
COMMENT ON TABLE sms_recovery IS 'SMS recovery options (future feature)';
COMMENT ON TABLE recovery_attempts IS 'Audit log of all recovery attempts for security monitoring';
COMMENT ON TABLE session_extensions IS 'Extended sessions for Remember Me functionality';
COMMENT ON COLUMN recovery_codes.code_hint IS 'Last 3 characters of the code, shown to user for verification';
COMMENT ON COLUMN backup_emails.different_from_primary IS 'Ensures backup email is different from primary account email';