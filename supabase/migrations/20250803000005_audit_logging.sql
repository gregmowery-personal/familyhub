-- FamilyHub Audit Logging - Migration 5
-- This migration creates comprehensive audit logging for security and compliance
-- Tracks all authentication events, data access, and security-sensitive operations

-- Audit event types enum
CREATE TYPE audit_event_type AS ENUM (
  -- Authentication events
  'login_success',
  'login_failure', 
  'logout',
  'session_created',
  'session_expired',
  'session_terminated',
  
  -- Account management
  'user_created',
  'user_updated',
  'user_deleted',
  'password_changed',
  'email_changed',
  'email_verified',
  
  -- Family management
  'family_created',
  'family_updated',
  'family_deleted',
  'member_added',
  'member_removed',
  'member_role_changed',
  'family_invitation_sent',
  'family_invitation_accepted',
  'family_invitation_declined',
  
  -- Social authentication
  'social_account_linked',
  'social_account_unlinked',
  'social_login_success',
  'social_login_failure',
  
  -- Security events
  'suspicious_activity',
  'rate_limit_exceeded',
  'token_created',
  'token_used',
  'token_expired',
  'mfa_enabled',
  'mfa_disabled',
  'backup_codes_generated',
  'backup_code_used',
  
  -- Data access
  'sensitive_data_accessed',
  'admin_action_performed',
  'bulk_data_export',
  'data_deletion_requested',
  
  -- System events
  'system_maintenance',
  'configuration_changed',
  'migration_executed'
);

-- Audit severity levels
CREATE TYPE audit_severity AS ENUM (
  'low',       -- Routine operations
  'medium',    -- Important operations
  'high',      -- Security-sensitive operations
  'critical'   -- Security incidents or breaches
);

-- Main audit log table
CREATE TABLE public.auth_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Event identification
  event_type audit_event_type NOT NULL,
  event_category VARCHAR(50) NOT NULL, -- 'authentication', 'authorization', 'data_access', etc.
  severity audit_severity NOT NULL DEFAULT 'medium',
  
  -- Actor information (who performed the action)
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user', 'system', 'admin', 'service'
  actor_ip_address INET,
  actor_user_agent TEXT,
  actor_session_id UUID,
  
  -- Target information (what was acted upon)
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  target_resource_type VARCHAR(50), -- 'user', 'family', 'session', 'token', etc.
  target_resource_id VARCHAR(255), -- ID of the target resource
  
  -- Event details
  event_description TEXT NOT NULL,
  event_data JSONB, -- Structured data about the event
  
  -- Context information
  request_id VARCHAR(255), -- Correlation ID for request tracing
  trace_id VARCHAR(255), -- Distributed tracing ID
  
  -- Geographic and network context
  country VARCHAR(2),
  city VARCHAR(100),
  timezone VARCHAR(50),
  
  -- Device context
  device_id VARCHAR(255),
  device_type VARCHAR(20),
  platform VARCHAR(50),
  
  -- Result and impact
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_code VARCHAR(100),
  error_message TEXT,
  
  -- Security assessment
  risk_score INTEGER, -- 0-100 risk assessment
  is_anomalous BOOLEAN NOT NULL DEFAULT FALSE, -- Flagged by anomaly detection
  anomaly_reasons TEXT[], -- Array of anomaly indicators
  
  -- Compliance and retention
  retention_period INTERVAL DEFAULT INTERVAL '7 years', -- How long to keep this record
  is_pii_redacted BOOLEAN NOT NULL DEFAULT FALSE, -- Whether PII has been redacted
  
  -- Timestamp
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance and querying
CREATE INDEX idx_audit_log_event_type ON public.auth_audit_log(event_type, occurred_at);
CREATE INDEX idx_audit_log_actor ON public.auth_audit_log(actor_user_id, occurred_at);
CREATE INDEX idx_audit_log_target_user ON public.auth_audit_log(target_user_id, occurred_at);
CREATE INDEX idx_audit_log_target_family ON public.auth_audit_log(target_family_id, occurred_at);
CREATE INDEX idx_audit_log_severity ON public.auth_audit_log(severity, occurred_at);
CREATE INDEX idx_audit_log_category ON public.auth_audit_log(event_category, occurred_at);
CREATE INDEX idx_audit_log_ip ON public.auth_audit_log(actor_ip_address, occurred_at);
CREATE INDEX idx_audit_log_session ON public.auth_audit_log(actor_session_id);
CREATE INDEX idx_audit_log_anomalous ON public.auth_audit_log(occurred_at) WHERE is_anomalous = TRUE;
CREATE INDEX idx_audit_log_high_risk ON public.auth_audit_log(occurred_at) WHERE risk_score >= 70;
CREATE INDEX idx_audit_log_retention ON public.auth_audit_log(occurred_at, retention_period);
CREATE INDEX idx_audit_log_request_id ON public.auth_audit_log(request_id);

-- Security incident tracking table
CREATE TABLE public.security_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Incident identification
  incident_type VARCHAR(50) NOT NULL, -- 'brute_force', 'credential_stuffing', 'anomalous_access', etc.
  severity audit_severity NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'investigating', 'resolved', 'false_positive'
  
  -- Affected entities
  affected_user_ids UUID[],
  affected_family_ids UUID[],
  affected_ip_addresses INET[],
  
  -- Incident details
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Timeline
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  -- Investigation
  assigned_to VARCHAR(100), -- Who is investigating
  investigation_notes TEXT,
  
  -- Related audit logs
  related_audit_log_ids UUID[],
  
  -- Response actions
  actions_taken TEXT[],
  auto_mitigation_applied BOOLEAN NOT NULL DEFAULT FALSE,
  manual_intervention_required BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Risk assessment
  initial_risk_score INTEGER, -- Risk when first detected
  final_risk_score INTEGER, -- Risk after investigation
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for security incidents
CREATE INDEX idx_security_incidents_type ON public.security_incidents(incident_type, first_detected_at);
CREATE INDEX idx_security_incidents_severity ON public.security_incidents(severity, status);
CREATE INDEX idx_security_incidents_status ON public.security_incidents(status, first_detected_at);
CREATE INDEX idx_security_incidents_affected_users ON public.security_incidents USING GIN(affected_user_ids);
CREATE INDEX idx_security_incidents_timeline ON public.security_incidents(first_detected_at, last_activity_at);

-- Data access log table - Track access to sensitive data
CREATE TABLE public.data_access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Access details
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  session_id UUID,
  
  -- Data accessed
  resource_type VARCHAR(50) NOT NULL, -- 'user_profile', 'family_data', 'documents', etc.
  resource_id VARCHAR(255) NOT NULL,
  operation VARCHAR(20) NOT NULL, -- 'read', 'write', 'delete', 'export'
  
  -- Access context
  access_reason VARCHAR(100), -- 'user_request', 'admin_action', 'system_maintenance'
  ip_address INET NOT NULL,
  user_agent TEXT,
  
  -- Data sensitivity
  data_classification VARCHAR(20) NOT NULL, -- 'public', 'internal', 'confidential', 'restricted'
  contains_pii BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Result
  access_granted BOOLEAN NOT NULL,
  denial_reason TEXT, -- If access was denied
  
  -- Compliance
  legal_basis VARCHAR(100), -- GDPR/privacy law basis for access
  retention_period INTERVAL DEFAULT INTERVAL '7 years',
  
  -- Metadata
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for data access log
CREATE INDEX idx_data_access_user ON public.data_access_log(user_id, accessed_at);
CREATE INDEX idx_data_access_resource ON public.data_access_log(resource_type, resource_id);
CREATE INDEX idx_data_access_operation ON public.data_access_log(operation, accessed_at);
CREATE INDEX idx_data_access_sensitive ON public.data_access_log(accessed_at) WHERE data_classification IN ('confidential', 'restricted');
CREATE INDEX idx_data_access_pii ON public.data_access_log(accessed_at) WHERE contains_pii = TRUE;
CREATE INDEX idx_data_access_denied ON public.data_access_log(accessed_at) WHERE access_granted = FALSE;

-- Function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_event_type audit_event_type,
  p_event_category VARCHAR(50),
  p_severity audit_severity,
  p_actor_user_id UUID,
  p_target_user_id UUID DEFAULT NULL,
  p_target_family_id UUID DEFAULT NULL,
  p_description TEXT,
  p_event_data JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_code VARCHAR(100) DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  audit_id UUID;
  risk_score INTEGER := 0;
  is_anomalous BOOLEAN := FALSE;
BEGIN
  -- Calculate basic risk score based on event type and context
  CASE p_event_type
    WHEN 'login_failure', 'suspicious_activity', 'rate_limit_exceeded' THEN
      risk_score := 70;
    WHEN 'social_account_linked', 'password_changed', 'email_changed' THEN
      risk_score := 50;
    WHEN 'member_role_changed', 'admin_action_performed' THEN
      risk_score := 60;
    ELSE
      risk_score := 20;
  END CASE;
  
  -- Check for anomalous patterns (simplified)
  IF p_event_type IN ('login_failure', 'suspicious_activity') THEN
    SELECT COUNT(*) > 5 INTO is_anomalous
    FROM public.auth_audit_log
    WHERE 
      actor_ip_address = p_ip_address 
      AND event_type = p_event_type
      AND occurred_at > NOW() - INTERVAL '1 hour';
  END IF;
  
  -- Insert audit log entry
  INSERT INTO public.auth_audit_log (
    event_type, event_category, severity, actor_user_id, target_user_id,
    target_family_id, event_description, event_data, actor_ip_address,
    actor_user_agent, actor_session_id, success, error_code, error_message,
    risk_score, is_anomalous
  ) VALUES (
    p_event_type, p_event_category, p_severity, p_actor_user_id, p_target_user_id,
    p_target_family_id, p_description, p_event_data, p_ip_address,
    p_user_agent, p_session_id, p_success, p_error_code, p_error_message,
    risk_score, is_anomalous
  ) RETURNING id INTO audit_id;
  
  -- Create security incident if high risk and anomalous
  IF risk_score >= 70 AND is_anomalous THEN
    INSERT INTO public.security_incidents (
      incident_type, severity, title, description, first_detected_at,
      affected_user_ids, related_audit_log_ids, initial_risk_score
    ) VALUES (
      'anomalous_' || p_event_type::TEXT,
      p_severity,
      'Anomalous ' || p_event_type::TEXT || ' detected',
      'Multiple ' || p_event_type::TEXT || ' events detected from IP ' || p_ip_address::TEXT,
      NOW(),
      CASE WHEN p_actor_user_id IS NOT NULL THEN ARRAY[p_actor_user_id] ELSE ARRAY[]::UUID[] END,
      ARRAY[audit_id],
      risk_score
    );
  END IF;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log data access
CREATE OR REPLACE FUNCTION public.log_data_access(
  p_user_id UUID,
  p_resource_type VARCHAR(50),
  p_resource_id VARCHAR(255),
  p_operation VARCHAR(20),
  p_data_classification VARCHAR(20) DEFAULT 'internal',
  p_contains_pii BOOLEAN DEFAULT FALSE,
  p_ip_address INET DEFAULT NULL,
  p_access_granted BOOLEAN DEFAULT TRUE,
  p_denial_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  access_id UUID;
BEGIN
  INSERT INTO public.data_access_log (
    user_id, resource_type, resource_id, operation, data_classification,
    contains_pii, ip_address, access_granted, denial_reason
  ) VALUES (
    p_user_id, p_resource_type, p_resource_id, p_operation, p_data_classification,
    p_contains_pii, p_ip_address, p_access_granted, p_denial_reason
  ) RETURNING id INTO access_id;
  
  RETURN access_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old audit logs based on retention policy
CREATE OR REPLACE FUNCTION public.cleanup_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete logs past their retention period
  DELETE FROM public.auth_audit_log
  WHERE occurred_at < (NOW() - retention_period);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Also clean up data access logs older than 7 years
  DELETE FROM public.data_access_log
  WHERE accessed_at < (NOW() - INTERVAL '7 years');
  
  -- Clean up resolved security incidents older than 2 years
  DELETE FROM public.security_incidents
  WHERE status = 'resolved' AND resolved_at < (NOW() - INTERVAL '2 years');
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically log user profile changes
CREATE OR REPLACE FUNCTION public.audit_user_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log user profile updates
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.log_audit_event(
      'user_updated',
      'account_management',
      'medium',
      NEW.id,
      NEW.id,
      NULL,
      'User profile updated',
      jsonb_build_object(
        'changed_fields', (
          SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val))
          FROM (
            SELECT key, 
                   COALESCE(to_jsonb(OLD) ->> key, '') as old_val,
                   COALESCE(to_jsonb(NEW) ->> key, '') as new_val
            FROM jsonb_object_keys(to_jsonb(NEW)) as key
            WHERE to_jsonb(OLD) ->> key IS DISTINCT FROM to_jsonb(NEW) ->> key
          ) as changes
        )
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit trigger for user profiles
CREATE TRIGGER audit_user_profile_changes_trigger
  AFTER UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION audit_user_profile_changes();

-- Create triggers for updated_at columns
CREATE TRIGGER update_security_incidents_updated_at
  BEFORE UPDATE ON public.security_incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.auth_audit_log IS 'Comprehensive audit log for all authentication and security events';
COMMENT ON TABLE public.security_incidents IS 'Tracks security incidents and their investigation status';
COMMENT ON TABLE public.data_access_log IS 'Logs access to sensitive data for compliance and security monitoring';

COMMENT ON FUNCTION public.log_audit_event IS 'Logs an audit event with automatic risk assessment and anomaly detection';
COMMENT ON FUNCTION public.log_data_access IS 'Logs data access events for compliance and security monitoring';
COMMENT ON FUNCTION public.cleanup_audit_logs IS 'Removes old audit logs based on retention policies';