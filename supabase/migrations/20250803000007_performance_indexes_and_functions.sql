-- FamilyHub Performance Indexes and Utility Functions - Migration 7
-- This migration adds additional performance indexes and utility functions
-- for optimal database performance and enhanced functionality

-- ============================================================================
-- ADDITIONAL PERFORMANCE INDEXES
-- ============================================================================

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_family_members_role_active 
ON public.family_members(family_id, role, is_family_admin) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_active_user_device 
ON public.user_sessions(user_id, device_id, is_active) 
WHERE is_active = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_tokens_user_type_status 
ON public.auth_tokens(user_id, token_type, token_status, expires_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_family_events 
ON public.auth_audit_log(target_family_id, event_type, occurred_at) 
WHERE target_family_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_providers_active_primary 
ON public.social_auth_providers(user_id, provider, is_primary_provider) 
WHERE link_status = 'active';

-- Partial indexes for specific security queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_login_attempts_failed_recent 
ON public.login_attempts(ip_address, attempted_at, email) 
WHERE success = FALSE AND attempted_at > NOW() - INTERVAL '24 hours';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_incidents_open_critical 
ON public.security_incidents(first_detected_at, incident_type) 
WHERE status IN ('open', 'investigating') AND severity IN ('high', 'critical');

-- GIN indexes for JSONB columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_notification_prefs 
ON public.user_profiles USING GIN(notification_preferences);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_family_members_custody_schedule 
ON public.family_members USING GIN(custody_schedule) 
WHERE custody_schedule IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_tokens_metadata 
ON public.auth_tokens USING GIN(metadata) 
WHERE metadata IS NOT NULL;

-- Text search indexes for common search operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_name_search 
ON public.user_profiles USING GIN(to_tsvector('english', 
  COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(display_name, '')
));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_families_name_search 
ON public.families USING GIN(to_tsvector('english', name));

-- ============================================================================
-- UTILITY FUNCTIONS FOR FAMILY MANAGEMENT
-- ============================================================================

-- Function to get family member count by role
CREATE OR REPLACE FUNCTION public.get_family_member_counts(p_family_id UUID)
RETURNS TABLE(
  role user_role_type,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fm.role,
    COUNT(*) as count
  FROM public.family_members fm
  WHERE fm.family_id = p_family_id AND fm.deleted_at IS NULL
  GROUP BY fm.role
  ORDER BY 
    CASE fm.role
      WHEN 'admin' THEN 1
      WHEN 'adult' THEN 2
      WHEN 'senior' THEN 3
      WHEN 'teen' THEN 4
      WHEN 'child' THEN 5
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's active sessions count
CREATE OR REPLACE FUNCTION public.get_user_active_sessions_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  session_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO session_count
  FROM public.user_sessions
  WHERE user_id = p_user_id 
    AND is_active = TRUE 
    AND expires_at > NOW();
  
  RETURN session_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has exceeded login attempts
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(
  p_identifier VARCHAR(255), -- email or IP address
  p_identifier_type VARCHAR(10), -- 'email' or 'ip'
  p_time_window INTERVAL DEFAULT INTERVAL '1 hour',
  p_max_attempts INTEGER DEFAULT 5
)
RETURNS TABLE(
  is_rate_limited BOOLEAN,
  attempts_count INTEGER,
  window_start TIMESTAMPTZ,
  next_allowed_at TIMESTAMPTZ
) AS $$
DECLARE
  window_start TIMESTAMPTZ := NOW() - p_time_window;
  attempts INTEGER;
  next_allowed TIMESTAMPTZ;
BEGIN
  -- Count failed attempts in the time window
  IF p_identifier_type = 'email' THEN
    SELECT COUNT(*) INTO attempts
    FROM public.login_attempts
    WHERE email = p_identifier 
      AND success = FALSE 
      AND attempted_at > window_start;
  ELSE
    SELECT COUNT(*) INTO attempts
    FROM public.login_attempts
    WHERE ip_address = p_identifier::INET 
      AND success = FALSE 
      AND attempted_at > window_start;
  END IF;
  
  -- Calculate when next attempt is allowed
  IF attempts >= p_max_attempts THEN
    SELECT attempted_at + p_time_window INTO next_allowed
    FROM public.login_attempts
    WHERE (
      CASE WHEN p_identifier_type = 'email' 
        THEN email = p_identifier 
        ELSE ip_address = p_identifier::INET 
      END
    )
    AND success = FALSE 
    AND attempted_at > window_start
    ORDER BY attempted_at ASC
    LIMIT 1;
  END IF;
  
  RETURN QUERY SELECT 
    attempts >= p_max_attempts,
    attempts,
    window_start,
    next_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get family invitation status
CREATE OR REPLACE FUNCTION public.get_family_invitation_status(p_token_hash VARCHAR(255))
RETURNS TABLE(
  is_valid BOOLEAN,
  family_name VARCHAR(100),
  inviter_name VARCHAR(100),
  invited_email VARCHAR(255),
  invited_role user_role_type,
  expires_at TIMESTAMPTZ,
  relationship VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (fit.is_active AND fit.expires_at > NOW() AND fit.uses_count < fit.max_uses) as is_valid,
    f.name as family_name,
    (up.first_name || ' ' || up.last_name) as inviter_name,
    fit.invited_email,
    fit.invited_role,
    fit.expires_at,
    fit.relationship
  FROM public.family_invitation_tokens fit
  JOIN public.families f ON f.id = fit.family_id
  JOIN public.user_profiles up ON up.id = fit.inviter_id
  WHERE fit.token_hash = p_token_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely delete user (soft delete with cleanup)
CREATE OR REPLACE FUNCTION public.soft_delete_user(p_user_id UUID, p_deleted_by UUID)
RETURNS BOOLEAN AS $$
DECLARE
  family_count INTEGER;
  admin_families UUID[];
BEGIN
  -- Check if user is the only admin of any families
  SELECT ARRAY_AGG(family_id) INTO admin_families
  FROM public.family_members fm
  WHERE fm.user_id = p_user_id 
    AND fm.is_family_admin = TRUE 
    AND fm.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.family_members fm2
      WHERE fm2.family_id = fm.family_id 
        AND fm2.user_id != p_user_id 
        AND fm2.is_family_admin = TRUE 
        AND fm2.deleted_at IS NULL
    );
  
  -- Cannot delete if user is the only admin of any family
  IF array_length(admin_families, 1) > 0 THEN
    RAISE EXCEPTION 'Cannot delete user: sole administrator of % families', array_length(admin_families, 1);
  END IF;
  
  -- Soft delete user profile
  UPDATE public.user_profiles
  SET deleted_at = NOW()
  WHERE id = p_user_id;
  
  -- Soft delete family memberships
  UPDATE public.family_members
  SET deleted_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Deactivate sessions
  UPDATE public.user_sessions
  SET is_active = FALSE, ended_at = NOW()
  WHERE user_id = p_user_id AND is_active = TRUE;
  
  -- Revoke active tokens
  UPDATE public.auth_tokens
  SET token_status = 'revoked', revoked_at = NOW(), revoked_by = p_deleted_by
  WHERE user_id = p_user_id AND token_status = 'active';
  
  -- Deactivate MFA backup codes
  UPDATE public.mfa_backup_codes
  SET is_active = FALSE
  WHERE user_id = p_user_id AND is_active = TRUE;
  
  -- Revoke social auth providers
  UPDATE public.social_auth_providers
  SET link_status = 'revoked', revoked_at = NOW()
  WHERE user_id = p_user_id AND link_status = 'active';
  
  -- Log the deletion
  PERFORM public.log_audit_event(
    'user_deleted',
    'account_management',
    'high',
    p_deleted_by,
    p_user_id,
    NULL,
    'User account soft deleted',
    jsonb_build_object('deleted_by', p_deleted_by)
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECURITY AND MAINTENANCE FUNCTIONS
-- ============================================================================

-- Function to detect anomalous login patterns
CREATE OR REPLACE FUNCTION public.detect_login_anomalies(p_user_id UUID)
RETURNS TABLE(
  anomaly_type VARCHAR(50),
  risk_score INTEGER,
  description TEXT,
  first_occurrence TIMESTAMPTZ,
  occurrence_count INTEGER
) AS $$
BEGIN
  -- Detect logins from new countries
  RETURN QUERY
  SELECT 
    'new_country_login'::VARCHAR(50),
    60::INTEGER,
    'Login from new country: ' || la.country,
    MIN(la.attempted_at),
    COUNT(*)::INTEGER
  FROM public.login_attempts la
  WHERE la.user_id = p_user_id 
    AND la.success = TRUE
    AND la.attempted_at > NOW() - INTERVAL '7 days'
    AND la.country NOT IN (
      SELECT DISTINCT country 
      FROM public.login_attempts la2
      WHERE la2.user_id = p_user_id 
        AND la2.success = TRUE
        AND la2.attempted_at BETWEEN NOW() - INTERVAL '90 days' AND NOW() - INTERVAL '7 days'
        AND la2.country IS NOT NULL
    )
    AND la.country IS NOT NULL
  GROUP BY la.country;
  
  -- Detect high frequency of failed logins
  RETURN QUERY
  SELECT 
    'high_failed_attempts'::VARCHAR(50),
    80::INTEGER,
    'High frequency of failed login attempts',
    MIN(la.attempted_at),
    COUNT(*)::INTEGER
  FROM public.login_attempts la
  WHERE la.user_id = p_user_id 
    AND la.success = FALSE
    AND la.attempted_at > NOW() - INTERVAL '1 hour'
  HAVING COUNT(*) >= 5;
  
  -- Detect logins at unusual times
  RETURN QUERY
  SELECT 
    'unusual_time_login'::VARCHAR(50),
    40::INTEGER,
    'Login at unusual time',
    MIN(la.attempted_at),
    COUNT(*)::INTEGER
  FROM public.login_attempts la
  WHERE la.user_id = p_user_id 
    AND la.success = TRUE
    AND la.attempted_at > NOW() - INTERVAL '24 hours'
    AND EXTRACT(hour FROM la.attempted_at) NOT IN (
      SELECT EXTRACT(hour FROM la2.attempted_at) as login_hour
      FROM public.login_attempts la2
      WHERE la2.user_id = p_user_id 
        AND la2.success = TRUE
        AND la2.attempted_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '1 day'
      GROUP BY EXTRACT(hour FROM la2.attempted_at)
      HAVING COUNT(*) >= 3  -- Must have logged in at this hour at least 3 times before
    )
  GROUP BY EXTRACT(hour FROM la.attempted_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired data across all tables
CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS TABLE(
  table_name TEXT,
  records_cleaned INTEGER
) AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  -- Clean up expired auth tokens
  PERFORM public.cleanup_expired_tokens();
  SELECT changes()::INTEGER INTO cleaned_count;
  RETURN QUERY SELECT 'auth_tokens'::TEXT, cleaned_count;
  
  -- Clean up old login attempts (keep for 90 days)
  DELETE FROM public.login_attempts 
  WHERE attempted_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN QUERY SELECT 'login_attempts'::TEXT, cleaned_count;
  
  -- Clean up expired sessions
  UPDATE public.user_sessions 
  SET is_active = FALSE, ended_at = NOW()
  WHERE is_active = TRUE AND expires_at <= NOW();
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN QUERY SELECT 'user_sessions'::TEXT, cleaned_count;
  
  -- Clean up old social login attempts (keep for 30 days)
  DELETE FROM public.social_login_attempts 
  WHERE attempted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN QUERY SELECT 'social_login_attempts'::TEXT, cleaned_count;
  
  -- Clean up expired family invitation tokens
  UPDATE public.family_invitation_tokens
  SET is_active = FALSE
  WHERE is_active = TRUE AND expires_at <= NOW();
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN QUERY SELECT 'family_invitation_tokens'::TEXT, cleaned_count;
  
  -- Clean up audit logs based on retention policy
  SELECT public.cleanup_audit_logs() INTO cleaned_count;
  RETURN QUERY SELECT 'audit_logs'::TEXT, cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- REPORTING AND ANALYTICS FUNCTIONS
-- ============================================================================

-- Function to get family activity summary
CREATE OR REPLACE FUNCTION public.get_family_activity_summary(
  p_family_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  total_members INTEGER,
  active_members INTEGER,
  recent_logins INTEGER,
  security_events INTEGER,
  pending_invitations INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM public.family_members WHERE family_id = p_family_id AND deleted_at IS NULL),
    (SELECT COUNT(*)::INTEGER FROM public.family_members fm 
     WHERE fm.family_id = p_family_id AND fm.deleted_at IS NULL
     AND fm.last_active_at > NOW() - (p_days || ' days')::INTERVAL),
    (SELECT COUNT(*)::INTEGER FROM public.login_attempts la
     JOIN public.family_members fm ON fm.user_id = la.user_id
     WHERE fm.family_id = p_family_id AND la.success = TRUE
     AND la.attempted_at > NOW() - (p_days || ' days')::INTERVAL),
    (SELECT COUNT(*)::INTEGER FROM public.auth_audit_log aal
     WHERE aal.target_family_id = p_family_id
     AND aal.severity IN ('high', 'critical')
     AND aal.occurred_at > NOW() - (p_days || ' days')::INTERVAL),
    (SELECT COUNT(*)::INTEGER FROM public.family_invitation_tokens fit
     WHERE fit.family_id = p_family_id AND fit.is_active = TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON FUNCTION public.get_family_member_counts IS 'Returns count of family members by role for a specific family';
COMMENT ON FUNCTION public.get_user_active_sessions_count IS 'Returns the number of active sessions for a user';
COMMENT ON FUNCTION public.check_login_rate_limit IS 'Checks if login attempts have exceeded rate limits for email or IP';
COMMENT ON FUNCTION public.get_family_invitation_status IS 'Returns detailed information about a family invitation token';
COMMENT ON FUNCTION public.soft_delete_user IS 'Safely soft-deletes a user with proper cleanup and validation';
COMMENT ON FUNCTION public.detect_login_anomalies IS 'Detects anomalous login patterns for security monitoring';
COMMENT ON FUNCTION public.cleanup_expired_data IS 'Comprehensive cleanup of expired data across all tables';
COMMENT ON FUNCTION public.get_family_activity_summary IS 'Returns activity summary for a family over specified time period';