-- FamilyHub Audit Triggers and Functions - Migration 8
-- This migration creates comprehensive audit triggers for automatic logging
-- of all security-sensitive operations and data changes

-- ============================================================================
-- AUDIT TRIGGER FUNCTIONS
-- ============================================================================

-- Generic audit trigger function for table changes
CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS TRIGGER AS $$
DECLARE
  event_type_val audit_event_type;
  table_name TEXT := TG_TABLE_NAME;
  operation TEXT := TG_OP;
  old_data JSONB;
  new_data JSONB;
  changed_fields JSONB;
BEGIN
  -- Determine event type based on operation and table
  CASE operation
    WHEN 'INSERT' THEN
      CASE table_name
        WHEN 'families' THEN event_type_val := 'family_created';
        WHEN 'family_members' THEN event_type_val := 'member_added';
        WHEN 'social_auth_providers' THEN event_type_val := 'social_account_linked';
        ELSE event_type_val := 'user_created';
      END CASE;
      new_data := to_jsonb(NEW);
    WHEN 'UPDATE' THEN
      CASE table_name
        WHEN 'families' THEN event_type_val := 'family_updated';
        WHEN 'family_members' THEN 
          -- Check if role changed
          IF OLD.role IS DISTINCT FROM NEW.role THEN
            event_type_val := 'member_role_changed';
          ELSE
            event_type_val := 'user_updated';
          END IF;
        WHEN 'user_profiles' THEN event_type_val := 'user_updated';
        WHEN 'social_auth_providers' THEN 
          IF OLD.link_status != NEW.link_status AND NEW.link_status = 'revoked' THEN
            event_type_val := 'social_account_unlinked';
          ELSE
            event_type_val := 'user_updated';
          END IF;
        ELSE event_type_val := 'user_updated';
      END CASE;
      old_data := to_jsonb(OLD);
      new_data := to_jsonb(NEW);
      
      -- Calculate changed fields
      SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val))
      INTO changed_fields
      FROM (
        SELECT key, 
               old_data ->> key as old_val,
               new_data ->> key as new_val
        FROM jsonb_object_keys(new_data) as key
        WHERE old_data ->> key IS DISTINCT FROM new_data ->> key
      ) as changes;
      
    WHEN 'DELETE' THEN
      CASE table_name
        WHEN 'families' THEN event_type_val := 'family_deleted';
        WHEN 'family_members' THEN event_type_val := 'member_removed';
        ELSE event_type_val := 'user_deleted';
      END CASE;
      old_data := to_jsonb(OLD);
  END CASE;
  
  -- Log the audit event
  PERFORM public.log_audit_event(
    event_type_val,
    'data_management',
    'medium',
    COALESCE(
      CASE 
        WHEN NEW IS NOT NULL THEN 
          CASE table_name
            WHEN 'families', 'family_members', 'family_relationships' THEN 
              (SELECT fm.user_id FROM public.family_members fm 
               WHERE fm.family_id = COALESCE(NEW.family_id, NEW.id) 
               AND fm.is_family_admin = TRUE LIMIT 1)
            ELSE NEW.id
          END
        WHEN OLD IS NOT NULL THEN
          CASE table_name
            WHEN 'families', 'family_members', 'family_relationships' THEN
              (SELECT fm.user_id FROM public.family_members fm 
               WHERE fm.family_id = COALESCE(OLD.family_id, OLD.id) 
               AND fm.is_family_admin = TRUE LIMIT 1)
            ELSE OLD.id
          END
      END,
      auth.uid()
    ),
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.family_id, OLD.family_id),
    operation || ' operation on ' || table_name,
    jsonb_build_object(
      'table_name', table_name,
      'operation', operation,
      'old_data', old_data,
      'new_data', new_data,
      'changed_fields', changed_fields
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit trigger for authentication events
CREATE OR REPLACE FUNCTION public.audit_auth_events()
RETURNS TRIGGER AS $$
DECLARE
  event_type_val audit_event_type;
  severity_val audit_severity;
  description TEXT;
BEGIN
  -- Determine event type and severity based on the table and operation
  CASE TG_TABLE_NAME
    WHEN 'user_sessions' THEN
      IF TG_OP = 'INSERT' THEN
        event_type_val := 'session_created';
        severity_val := 'low';
        description := 'New user session created';
      ELSIF TG_OP = 'UPDATE' AND OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
        event_type_val := 'session_terminated';
        severity_val := 'low';
        description := 'User session terminated';
      END IF;
      
    WHEN 'password_reset_tokens' THEN
      IF TG_OP = 'INSERT' THEN
        event_type_val := 'token_created';
        severity_val := 'medium';
        description := 'Password reset token created';
      ELSIF TG_OP = 'UPDATE' AND OLD.used_at IS NULL AND NEW.used_at IS NOT NULL THEN
        event_type_val := 'password_changed';
        severity_val := 'high';
        description := 'Password changed via reset token';
      END IF;
      
    WHEN 'email_verification_tokens' THEN
      IF TG_OP = 'INSERT' THEN
        event_type_val := 'token_created';
        severity_val := 'medium';
        description := 'Email verification token created';
      ELSIF TG_OP = 'UPDATE' AND OLD.verified_at IS NULL AND NEW.verified_at IS NOT NULL THEN
        event_type_val := 'email_verified';
        severity_val := 'medium';
        description := 'Email address verified';
      END IF;
      
    WHEN 'family_invitation_tokens' THEN
      IF TG_OP = 'INSERT' THEN
        event_type_val := 'family_invitation_sent';
        severity_val := 'medium';
        description := 'Family invitation sent';
      ELSIF TG_OP = 'UPDATE' AND OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL THEN
        event_type_val := 'family_invitation_accepted';
        severity_val := 'medium';
        description := 'Family invitation accepted';
      ELSIF TG_OP = 'UPDATE' AND OLD.declined_at IS NULL AND NEW.declined_at IS NOT NULL THEN
        event_type_val := 'family_invitation_declined';
        severity_val := 'low';
        description := 'Family invitation declined';
      END IF;
      
    WHEN 'mfa_backup_codes' THEN
      IF TG_OP = 'INSERT' AND NEW.used_at IS NULL THEN
        event_type_val := 'backup_codes_generated';
        severity_val := 'high';
        description := 'MFA backup codes generated';
      ELSIF TG_OP = 'UPDATE' AND OLD.used_at IS NULL AND NEW.used_at IS NOT NULL THEN
        event_type_val := 'backup_code_used';
        severity_val := 'high';
        description := 'MFA backup code used';
      END IF;
  END CASE;
  
  -- Only log if we have a valid event type
  IF event_type_val IS NOT NULL THEN
    PERFORM public.log_audit_event(
      event_type_val,
      'authentication',
      severity_val,
      COALESCE(NEW.user_id, OLD.user_id, NEW.inviter_id),
      COALESCE(NEW.user_id, OLD.user_id),
      COALESCE(NEW.family_id, OLD.family_id),
      description,
      jsonb_build_object(
        'table_name', TG_TABLE_NAME,
        'operation', TG_OP,
        'token_type', COALESCE(NEW.token_type, 'unknown'),
        'ip_address', COALESCE(NEW.ip_address, OLD.ip_address)
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit trigger for login attempts
CREATE OR REPLACE FUNCTION public.audit_login_attempt()
RETURNS TRIGGER AS $$
DECLARE
  event_type_val audit_event_type;
  severity_val audit_severity;
  risk_score INTEGER := 20;
BEGIN
  -- Only audit INSERT operations (new login attempts)
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;
  
  -- Determine event type and risk based on success and context
  IF NEW.success THEN
    IF NEW.attempt_type = 'password' THEN
      event_type_val := 'login_success';
    ELSE
      event_type_val := 'social_login_success';
    END IF;
    severity_val := 'low';
    risk_score := 10;
  ELSE
    IF NEW.attempt_type = 'password' THEN
      event_type_val := 'login_failure';
    ELSE
      event_type_val := 'social_login_failure';
    END IF;
    severity_val := 'medium';
    risk_score := 50;
    
    -- Increase risk for repeated failures
    IF (SELECT COUNT(*) FROM public.login_attempts 
        WHERE ip_address = NEW.ip_address 
        AND success = FALSE 
        AND attempted_at > NOW() - INTERVAL '1 hour') >= 3 THEN
      risk_score := 80;
      severity_val := 'high';
    END IF;
  END IF;
  
  -- Log the audit event
  PERFORM public.log_audit_event(
    event_type_val,
    'authentication',
    severity_val,
    NEW.user_id,
    NEW.user_id,
    NULL,
    CASE WHEN NEW.success THEN 'Successful login' ELSE 'Failed login: ' || COALESCE(NEW.failure_reason, 'Unknown') END,
    jsonb_build_object(
      'attempt_type', NEW.attempt_type,
      'provider', NEW.provider,
      'ip_address', NEW.ip_address,
      'country', NEW.country,
      'user_agent', LEFT(NEW.user_agent, 200), -- Truncate for storage
      'failure_reason', NEW.failure_reason,
      'risk_score', risk_score
    ),
    NEW.ip_address,
    NEW.user_agent,
    NULL,
    NEW.success,
    CASE WHEN NOT NEW.success THEN NEW.failure_reason END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit trigger for suspicious activities
CREATE OR REPLACE FUNCTION public.audit_suspicious_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger on certain security-sensitive updates
  IF TG_TABLE_NAME = 'user_sessions' AND TG_OP = 'UPDATE' THEN
    -- Log if session marked as suspicious
    IF OLD.is_suspicious = FALSE AND NEW.is_suspicious = TRUE THEN
      PERFORM public.log_audit_event(
        'suspicious_activity',
        'security',
        'high',
        NEW.user_id,
        NEW.user_id,
        NEW.family_id,
        'Session flagged as suspicious',
        jsonb_build_object(
          'session_id', NEW.id,
          'ip_address', NEW.ip_address,
          'device_id', NEW.device_id,
          'failed_attempts', NEW.failed_attempts
        ),
        NEW.ip_address,
        NEW.user_agent,
        NEW.id
      );
    END IF;
    
    -- Log excessive failed attempts
    IF OLD.failed_attempts < 5 AND NEW.failed_attempts >= 5 THEN
      PERFORM public.log_audit_event(
        'rate_limit_exceeded',
        'security',
        'high',
        NEW.user_id,
        NEW.user_id,
        NEW.family_id,
        'Excessive failed attempts detected',
        jsonb_build_object(
          'session_id', NEW.id,
          'failed_attempts', NEW.failed_attempts,
          'ip_address', NEW.ip_address
        ),
        NEW.ip_address
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE AUDIT TRIGGERS
-- ============================================================================

-- Triggers for general table changes
CREATE TRIGGER audit_families_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

CREATE TRIGGER audit_family_members_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

CREATE TRIGGER audit_family_relationships_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.family_relationships
  FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes();

-- Triggers for authentication events
CREATE TRIGGER audit_user_sessions_events
  AFTER INSERT OR UPDATE ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.audit_auth_events();

CREATE TRIGGER audit_password_reset_events
  AFTER INSERT OR UPDATE ON public.password_reset_tokens
  FOR EACH ROW EXECUTE FUNCTION public.audit_auth_events();

CREATE TRIGGER audit_email_verification_events
  AFTER INSERT OR UPDATE ON public.email_verification_tokens
  FOR EACH ROW EXECUTE FUNCTION public.audit_auth_events();

CREATE TRIGGER audit_family_invitation_events
  AFTER INSERT OR UPDATE ON public.family_invitation_tokens
  FOR EACH ROW EXECUTE FUNCTION public.audit_auth_events();

CREATE TRIGGER audit_mfa_backup_codes_events
  AFTER INSERT OR UPDATE ON public.mfa_backup_codes
  FOR EACH ROW EXECUTE FUNCTION public.audit_auth_events();

-- Trigger for login attempts
CREATE TRIGGER audit_login_attempts_trigger
  AFTER INSERT ON public.login_attempts
  FOR EACH ROW EXECUTE FUNCTION public.audit_login_attempt();

-- Trigger for social login attempts
CREATE TRIGGER audit_social_login_attempts_trigger
  AFTER INSERT ON public.social_login_attempts
  FOR EACH ROW EXECUTE FUNCTION public.audit_login_attempt();

-- Triggers for suspicious activities
CREATE TRIGGER audit_suspicious_sessions
  AFTER UPDATE ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.audit_suspicious_activity();

-- ============================================================================
-- ADDITIONAL SECURITY FUNCTIONS
-- ============================================================================

-- Function to automatically lock account after too many failed attempts
CREATE OR REPLACE FUNCTION public.check_and_lock_account()
RETURNS TRIGGER AS $$
DECLARE
  failed_count INTEGER;
  lock_duration INTERVAL := INTERVAL '30 minutes';
BEGIN
  -- Only process failed login attempts
  IF NOT (TG_OP = 'INSERT' AND NEW.success = FALSE) THEN
    RETURN NEW;
  END IF;
  
  -- Count recent failed attempts for this user
  SELECT COUNT(*) INTO failed_count
  FROM public.login_attempts
  WHERE user_id = NEW.user_id
    AND success = FALSE
    AND attempted_at > NOW() - INTERVAL '1 hour';
  
  -- Lock account if too many failures
  IF failed_count >= 10 THEN
    -- Create a security incident
    INSERT INTO public.security_incidents (
      incident_type, severity, title, description, first_detected_at,
      affected_user_ids, initial_risk_score, auto_mitigation_applied
    ) VALUES (
      'brute_force_attack',
      'high',
      'Potential brute force attack detected',
      'User account locked due to ' || failed_count || ' failed login attempts',
      NOW(),
      ARRAY[NEW.user_id],
      90,
      TRUE
    );
    
    -- Revoke all active sessions for this user
    UPDATE public.user_sessions
    SET is_active = FALSE, ended_at = NOW()
    WHERE user_id = NEW.user_id AND is_active = TRUE;
    
    -- Create a temporary "lock" token that prevents login
    INSERT INTO public.auth_tokens (
      token_hash, token_type, user_id, expires_at, metadata
    ) VALUES (
      encode(gen_random_bytes(32), 'hex'),
      'session_challenge',
      NEW.user_id,
      NOW() + lock_duration,
      jsonb_build_object(
        'reason', 'account_locked',
        'failed_attempts', failed_count,
        'locked_at', NOW()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic account locking
CREATE TRIGGER check_account_lock_trigger
  AFTER INSERT ON public.login_attempts
  FOR EACH ROW EXECUTE FUNCTION public.check_and_lock_account();

-- Function to detect and log device changes
CREATE OR REPLACE FUNCTION public.audit_device_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Log new device registration
    PERFORM public.log_audit_event(
      'user_updated',
      'security',
      'medium',
      NEW.user_id,
      NEW.user_id,
      NULL,
      'New device registered: ' || COALESCE(NEW.device_name, NEW.device_id),
      jsonb_build_object(
        'device_id', NEW.device_id,
        'device_name', NEW.device_name,
        'device_type', NEW.device_type,
        'platform', NEW.platform,
        'is_first_device', (
          SELECT COUNT(*) FROM public.user_devices 
          WHERE user_id = NEW.user_id AND id != NEW.id
        ) = 0
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log device trust status changes
    IF OLD.is_trusted != NEW.is_trusted THEN
      PERFORM public.log_audit_event(
        'user_updated',
        'security',
        CASE WHEN NEW.is_trusted THEN 'medium' ELSE 'high' END,
        NEW.user_id,
        NEW.user_id,
        NULL,
        'Device trust status changed: ' || CASE WHEN NEW.is_trusted THEN 'trusted' ELSE 'untrusted' END,
        jsonb_build_object(
          'device_id', NEW.device_id,
          'device_name', NEW.device_name,
          'old_trusted', OLD.is_trusted,
          'new_trusted', NEW.is_trusted
        )
      );
    END IF;
    
    -- Log device blocking
    IF OLD.is_blocked != NEW.is_blocked AND NEW.is_blocked THEN
      PERFORM public.log_audit_event(
        'suspicious_activity',
        'security',
        'high',
        NEW.user_id,
        NEW.user_id,
        NULL,
        'Device blocked: ' || COALESCE(NEW.blocked_reason, 'No reason provided'),
        jsonb_build_object(
          'device_id', NEW.device_id,
          'device_name', NEW.device_name,
          'blocked_reason', NEW.blocked_reason
        )
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for device changes
CREATE TRIGGER audit_device_changes_trigger
  AFTER INSERT OR UPDATE ON public.user_devices
  FOR EACH ROW EXECUTE FUNCTION public.audit_device_changes();

-- Comments for documentation
COMMENT ON FUNCTION public.audit_table_changes IS 'Generic audit trigger function for logging table changes';
COMMENT ON FUNCTION public.audit_auth_events IS 'Specialized audit trigger for authentication-related events';
COMMENT ON FUNCTION public.audit_login_attempt IS 'Audit trigger specifically for login attempts with risk assessment';
COMMENT ON FUNCTION public.audit_suspicious_activity IS 'Audit trigger for detecting and logging suspicious activities';
COMMENT ON FUNCTION public.check_and_lock_account IS 'Automatically locks accounts after excessive failed login attempts';
COMMENT ON FUNCTION public.audit_device_changes IS 'Audit trigger for device registration and trust changes';