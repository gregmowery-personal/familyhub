-- Migration: Complete RBAC System Implementation
-- Date: 2025-08-03
-- Author: Claude
-- Purpose: Implements comprehensive Role-Based Access Control system with permissions,
--          delegations, emergency overrides, audit logging, and performance optimizations

-- ============================================================================
-- MIGRATION UP
-- ============================================================================

BEGIN;

-- Create required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================================
-- CORE RBAC TABLES
-- ============================================================================

-- Roles table with state management
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(30) NOT NULL CHECK (type IN ('admin', 'caregiver', 'viewer', 'care_recipient', 'child', 'helper', 'emergency_contact', 'bot_agent')),
  state VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (state IN ('pending_approval', 'active', 'suspended', 'expired', 'revoked')),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100, -- Higher number = higher priority
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type)
);

-- Permissions table with resource-action model
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  effect VARCHAR(10) NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  scope VARCHAR(20) CHECK (scope IN ('own', 'assigned', 'family', 'all')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource, action, effect, scope)
);

-- Permission Sets for modular permission management
CREATE TABLE permission_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  parent_set_id UUID REFERENCES permission_sets(id), -- For inheritance, with cycle prevention
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT no_self_reference CHECK (id != parent_set_id)
);

-- Permission set hierarchy tracking (prevents circular dependencies)
CREATE TABLE permission_set_hierarchy (
  ancestor_id UUID REFERENCES permission_sets(id) ON DELETE CASCADE,
  descendant_id UUID REFERENCES permission_sets(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id)
);

-- Permission set to permissions mapping
CREATE TABLE permission_set_permissions (
  permission_set_id UUID REFERENCES permission_sets(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (permission_set_id, permission_id)
);

-- Role to permission sets mapping
CREATE TABLE role_permission_sets (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_set_id UUID REFERENCES permission_sets(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_set_id)
);

-- ============================================================================
-- USER ROLE ASSIGNMENTS
-- ============================================================================

-- User role assignments with comprehensive metadata
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- References auth.users(id) but not enforced for flexibility
  role_id UUID REFERENCES roles(id),
  
  -- Assignment metadata
  granted_by UUID, -- References auth.users(id)
  reason TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Time bounds
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP WITH TIME ZONE,
  
  -- State management
  state VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (state IN ('pending_approval', 'active', 'suspended', 'expired', 'revoked')),
  state_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  state_changed_by UUID, -- References auth.users(id)
  
  -- Expiration reminder
  reminder_days_before INTEGER,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Revocation
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by UUID, -- References auth.users(id)
  revoke_reason TEXT,
  
  CONSTRAINT valid_time_bounds CHECK (valid_until IS NULL OR valid_until > valid_from)
);

-- User role scope management (replaces TEXT[] arrays for better normalization)
CREATE TABLE user_role_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_role_id UUID REFERENCES user_roles(id) ON DELETE CASCADE,
  scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('global', 'family', 'individual')),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('user', 'family', 'group')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_role_id, entity_type, entity_id)
);

-- Structured recurring schedules (instead of JSONB for better queryability)
CREATE TABLE recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_role_id UUID REFERENCES user_roles(id) ON DELETE CASCADE,
  days_of_week INTEGER[] NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  timezone VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_days CHECK (array_length(days_of_week, 1) > 0 AND days_of_week <@ ARRAY[0,1,2,3,4,5,6]),
  CONSTRAINT valid_time_range CHECK (time_end > time_start),
  UNIQUE(user_role_id)
);

-- ============================================================================
-- DELEGATION SYSTEM
-- ============================================================================

-- Delegation records with improved structure
CREATE TABLE delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL, -- References auth.users(id)
  to_user_id UUID NOT NULL, -- References auth.users(id)
  role_id UUID REFERENCES roles(id),
  
  -- Time bounds
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Metadata
  reason TEXT NOT NULL,
  approved_by UUID, -- References auth.users(id)
  approved_at TIMESTAMP WITH TIME ZONE,
  
  -- State
  state VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'expired', 'revoked')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Revocation
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by UUID, -- References auth.users(id)
  revoke_reason TEXT,
  
  CONSTRAINT valid_delegation_time CHECK (valid_until > valid_from),
  CONSTRAINT no_self_delegation CHECK (from_user_id != to_user_id)
);

-- Delegation scopes (similar to user_role_scopes)
CREATE TABLE delegation_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id UUID REFERENCES delegations(id) ON DELETE CASCADE,
  scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('global', 'family', 'individual')),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('user', 'family', 'group')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(delegation_id, entity_type, entity_id)
);

-- Delegation permission subsets (optional - allows delegating subset of permissions)
CREATE TABLE delegation_permissions (
  delegation_id UUID REFERENCES delegations(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (delegation_id, permission_id)
);

-- ============================================================================
-- EMERGENCY OVERRIDE SYSTEM
-- ============================================================================

-- Emergency overrides for critical situations
CREATE TABLE emergency_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by UUID NOT NULL, -- References auth.users(id)
  affected_user UUID NOT NULL, -- References auth.users(id)
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('no_response_24h', 'panic_button', 'admin_override', 'medical_emergency')),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  
  -- Granted permissions during emergency
  granted_permissions UUID[] NOT NULL, -- Array of permission IDs
  
  -- Notification tracking
  notified_users UUID[] NOT NULL,
  
  -- Timestamps
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  deactivated_at TIMESTAMP WITH TIME ZONE,
  deactivated_by UUID, -- References auth.users(id)
  
  -- Audit
  justification TEXT NOT NULL,
  
  CONSTRAINT valid_duration CHECK (duration_minutes > 0 AND duration_minutes <= 1440) -- Max 24 hours
);

-- ============================================================================
-- AUDIT LOGGING SYSTEM
-- ============================================================================

-- Dual audit logging: permission checks
CREATE TABLE audit_permission_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- References auth.users(id)
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  allowed BOOLEAN NOT NULL,
  denial_reason VARCHAR(100),
  
  -- Context
  user_roles UUID[], -- Snapshot of role IDs
  delegations UUID[], -- Active delegation IDs
  emergency_override UUID REFERENCES emergency_overrides(id),
  
  -- Performance metrics
  evaluation_time_ms INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  
  -- Request context
  ip_address INET,
  session_id UUID,
  user_agent TEXT,
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dual audit logging: permission changes
CREATE TABLE audit_permission_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by UUID NOT NULL, -- References auth.users(id)
  change_type VARCHAR(50) NOT NULL CHECK (change_type IN (
    'role_assigned', 'role_revoked', 'role_modified',
    'delegation_created', 'delegation_approved', 'delegation_revoked',
    'permission_set_updated', 'emergency_override_activated'
  )),
  
  -- Affected entities
  affected_user UUID, -- References auth.users(id)
  affected_role UUID REFERENCES roles(id),
  affected_delegation UUID REFERENCES delegations(id),
  
  -- Change details
  before_state JSONB,
  after_state JSONB,
  justification TEXT,
  
  -- Approval tracking
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID, -- References auth.users(id)
  approved_at TIMESTAMP WITH TIME ZONE,
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- STORED PROCEDURES AND FUNCTIONS
-- ============================================================================

-- Stored procedure to prevent circular dependencies in permission sets
CREATE OR REPLACE FUNCTION prevent_permission_set_cycles() RETURNS TRIGGER AS $$
BEGIN
  -- Check if adding this relationship would create a cycle
  IF EXISTS (
    SELECT 1 FROM permission_set_hierarchy 
    WHERE ancestor_id = NEW.descendant_id 
    AND descendant_id = NEW.ancestor_id
  ) THEN
    RAISE EXCEPTION 'Circular dependency detected: permission set % cannot inherit from % (would create cycle)', 
                    NEW.ancestor_id, NEW.descendant_id;
  END IF;
  
  -- Check for deeper cycles by verifying if descendant is already an ancestor
  IF NEW.ancestor_id != NEW.descendant_id AND EXISTS (
    SELECT 1 FROM permission_set_hierarchy 
    WHERE ancestor_id = NEW.descendant_id 
    AND descendant_id = NEW.ancestor_id
  ) THEN
    RAISE EXCEPTION 'Circular dependency detected: permission set % is already a descendant of %', 
                    NEW.descendant_id, NEW.ancestor_id;
  END IF;
  
  -- Prevent self-reference
  IF NEW.ancestor_id = NEW.descendant_id THEN
    RAISE EXCEPTION 'Self-reference not allowed: permission set cannot inherit from itself';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper function to safely add permission set inheritance
CREATE OR REPLACE FUNCTION add_permission_set_inheritance(
  parent_set_id UUID,
  child_set_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Insert direct relationship
  INSERT INTO permission_set_hierarchy (ancestor_id, descendant_id, depth)
  VALUES (parent_set_id, child_set_id, 1)
  ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
  
  -- Insert transitive relationships
  INSERT INTO permission_set_hierarchy (ancestor_id, descendant_id, depth)
  SELECT h.ancestor_id, child_set_id, h.depth + 1
  FROM permission_set_hierarchy h
  WHERE h.descendant_id = parent_set_id
  ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
  
  -- Insert reverse transitive relationships
  INSERT INTO permission_set_hierarchy (ancestor_id, descendant_id, depth)
  SELECT parent_set_id, h.descendant_id, h.depth + 1
  FROM permission_set_hierarchy h
  WHERE h.ancestor_id = child_set_id
  ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to validate scope entity references
CREATE OR REPLACE FUNCTION validate_scope_entity() RETURNS TRIGGER AS $$
BEGIN
  -- Note: We can't enforce foreign keys to auth.users here due to cross-schema references
  -- This would need to be handled at the application level or with additional validation
  
  -- For now, just ensure entity_id is not null
  IF NEW.entity_id IS NULL THEN
    RAISE EXCEPTION 'entity_id cannot be null';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to compute emergency override expiration
CREATE OR REPLACE FUNCTION compute_emergency_expires_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at = NEW.activated_at + (NEW.duration_minutes * INTERVAL '1 minute');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Prevent circular dependencies in permission sets
CREATE TRIGGER prevent_cycles_trigger
  BEFORE INSERT OR UPDATE ON permission_set_hierarchy
  FOR EACH ROW EXECUTE FUNCTION prevent_permission_set_cycles();

-- Validate scope entities
CREATE TRIGGER validate_scope_entity_trigger
  BEFORE INSERT OR UPDATE ON user_role_scopes
  FOR EACH ROW EXECUTE FUNCTION validate_scope_entity();

CREATE TRIGGER validate_delegation_scope_entity_trigger
  BEFORE INSERT OR UPDATE ON delegation_scopes
  FOR EACH ROW EXECUTE FUNCTION validate_scope_entity();

-- Auto-update timestamps
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permission_sets_updated_at
  BEFORE UPDATE ON permission_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Compute emergency override expiration
CREATE TRIGGER compute_emergency_expires_trigger
  BEFORE INSERT OR UPDATE ON emergency_overrides
  FOR EACH ROW EXECUTE FUNCTION compute_emergency_expires_at();

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- User roles indexes
CREATE INDEX idx_user_roles_active ON user_roles(user_id, state) WHERE state = 'active';
CREATE INDEX idx_user_roles_expiry ON user_roles(valid_until) WHERE valid_until IS NOT NULL AND state = 'active';
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- User role scopes indexes
CREATE INDEX idx_user_role_scopes_lookup ON user_role_scopes(entity_id, entity_type);
CREATE INDEX idx_user_role_scopes_user_role ON user_role_scopes(user_role_id);

-- Recurring schedules indexes
CREATE INDEX idx_recurring_schedules_role ON recurring_schedules(user_role_id);

-- Delegations indexes
CREATE INDEX idx_delegations_active ON delegations(to_user_id, state) WHERE state = 'active';
CREATE INDEX idx_delegations_expiry ON delegations(valid_until) WHERE state = 'active';
CREATE INDEX idx_delegations_from_user ON delegations(from_user_id);
CREATE INDEX idx_delegations_to_user ON delegations(to_user_id);

-- Delegation scopes indexes
CREATE INDEX idx_delegation_scopes_lookup ON delegation_scopes(entity_id, entity_type);
CREATE INDEX idx_delegation_scopes_delegation ON delegation_scopes(delegation_id);

-- Emergency overrides indexes
CREATE INDEX idx_emergency_overrides_active ON emergency_overrides(expires_at, deactivated_at) WHERE deactivated_at IS NULL;
CREATE INDEX idx_emergency_overrides_affected_user ON emergency_overrides(affected_user);

-- Audit indexes
CREATE INDEX idx_audit_checks_user_timestamp ON audit_permission_checks(user_id, timestamp DESC);
CREATE INDEX idx_audit_checks_resource ON audit_permission_checks(resource_type, resource_id);
CREATE INDEX idx_audit_changes_user_timestamp ON audit_permission_changes(affected_user, timestamp DESC);
CREATE INDEX idx_audit_changes_type ON audit_permission_changes(change_type, timestamp DESC);

-- Role and permission indexes
CREATE INDEX idx_roles_type_state ON roles(type, state);
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX idx_permission_sets_parent ON permission_sets(parent_set_id);

-- ============================================================================
-- MATERIALIZED VIEW FOR PERFORMANCE
-- ============================================================================

-- Materialized view for "who can access what" queries
CREATE MATERIALIZED VIEW user_permissions AS
SELECT 
  u.user_id as user_id,
  r.id as role_id,
  r.type as role_type,
  p.resource,
  p.action,
  p.effect,
  p.scope,
  urs.entity_id as scoped_to_entity,
  ur.valid_until,
  'direct' as source
FROM user_roles ur
JOIN user_role_scopes urs ON ur.id = urs.user_role_id
JOIN roles r ON ur.role_id = r.id
JOIN role_permission_sets rps ON r.id = rps.role_id
JOIN permission_set_permissions psp ON rps.permission_set_id = psp.permission_set_id
JOIN permissions p ON psp.permission_id = p.id
JOIN (SELECT DISTINCT user_id FROM user_roles) u ON ur.user_id = u.user_id
WHERE ur.state = 'active'
  AND ur.valid_from <= CURRENT_TIMESTAMP 
  AND (ur.valid_until IS NULL OR ur.valid_until > CURRENT_TIMESTAMP)
  AND r.state = 'active'

UNION

SELECT 
  d.to_user_id as user_id,
  r.id as role_id,
  r.type as role_type,
  p.resource,
  p.action,
  p.effect,
  p.scope,
  ds.entity_id as scoped_to_entity,
  d.valid_until,
  'delegation' as source
FROM delegations d
JOIN delegation_scopes ds ON d.id = ds.delegation_id
JOIN roles r ON d.role_id = r.id
JOIN role_permission_sets rps ON r.id = rps.role_id
JOIN permission_set_permissions psp ON rps.permission_set_id = psp.permission_set_id
JOIN permissions p ON psp.permission_id = p.id
WHERE d.state = 'active'
  AND d.valid_from <= CURRENT_TIMESTAMP 
  AND d.valid_until > CURRENT_TIMESTAMP
  AND r.state = 'active';

-- Index for the materialized view
CREATE UNIQUE INDEX idx_user_permissions_unique ON user_permissions(user_id, resource, action, scoped_to_entity, source, role_id);
CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_resource ON user_permissions(resource, action);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_user_permissions() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_permissions;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA - CORE ROLES AND PERMISSIONS
-- ============================================================================

-- Insert core roles
INSERT INTO roles (id, type, name, description, priority, is_system) VALUES
  (gen_random_uuid(), 'admin', 'System Administrator', 'Full system access with all permissions', 1000, true),
  (gen_random_uuid(), 'caregiver', 'Primary Caregiver', 'Can manage schedules, tasks, and care recipients', 800, true),
  (gen_random_uuid(), 'viewer', 'Family Viewer', 'Can view family information and schedules', 600, true),
  (gen_random_uuid(), 'care_recipient', 'Care Recipient', 'Person receiving care with limited self-management permissions', 400, true),
  (gen_random_uuid(), 'child', 'Child', 'Child family member with age-appropriate permissions', 300, true),
  (gen_random_uuid(), 'helper', 'Helper', 'Temporary helper with limited permissions', 200, true),
  (gen_random_uuid(), 'emergency_contact', 'Emergency Contact', 'Emergency access to critical information only', 100, true),
  (gen_random_uuid(), 'bot_agent', 'Bot Agent', 'Automated system agent for notifications and reminders', 50, true);

-- Insert core permission sets
INSERT INTO permission_sets (id, name, description) VALUES
  (gen_random_uuid(), 'full_admin', 'Complete administrative permissions'),
  (gen_random_uuid(), 'caregiver_base', 'Base permissions for caregivers'),
  (gen_random_uuid(), 'viewer_base', 'Base viewing permissions'),
  (gen_random_uuid(), 'self_management', 'Self-management permissions'),
  (gen_random_uuid(), 'emergency_access', 'Emergency-only access permissions'),
  (gen_random_uuid(), 'child_safe', 'Child-appropriate permissions'),
  (gen_random_uuid(), 'helper_temporary', 'Temporary helper permissions'),
  (gen_random_uuid(), 'bot_automation', 'Bot automation permissions');

-- Insert core permissions
INSERT INTO permissions (resource, action, effect, scope, description) VALUES
  -- User management
  ('user', 'create', 'allow', 'family', 'Create new family members'),
  ('user', 'read', 'allow', 'own', 'Read own profile'),
  ('user', 'read', 'allow', 'family', 'Read family member profiles'),
  ('user', 'update', 'allow', 'own', 'Update own profile'),
  ('user', 'update', 'allow', 'assigned', 'Update assigned care recipients'),
  ('user', 'delete', 'allow', 'family', 'Delete family members'),
  
  -- Schedule management
  ('schedule', 'create', 'allow', 'family', 'Create family schedules'),
  ('schedule', 'read', 'allow', 'family', 'View family schedules'),
  ('schedule', 'update', 'allow', 'assigned', 'Update assigned schedules'),
  ('schedule', 'delete', 'allow', 'assigned', 'Delete assigned schedules'),
  
  -- Task management
  ('task', 'create', 'allow', 'family', 'Create tasks'),
  ('task', 'read', 'allow', 'family', 'View tasks'),
  ('task', 'update', 'allow', 'assigned', 'Update assigned tasks'),
  ('task', 'delete', 'allow', 'assigned', 'Delete assigned tasks'),
  ('task', 'assign', 'allow', 'family', 'Assign tasks to family members'),
  
  -- Document management
  ('document', 'create', 'allow', 'family', 'Upload documents'),
  ('document', 'read', 'allow', 'family', 'View family documents'),
  ('document', 'update', 'allow', 'assigned', 'Update document metadata'),
  ('document', 'delete', 'allow', 'assigned', 'Delete documents'),
  
  -- Contact management
  ('contact', 'create', 'allow', 'family', 'Add contacts'),
  ('contact', 'read', 'allow', 'family', 'View contacts'),
  ('contact', 'update', 'allow', 'family', 'Update contacts'),
  ('contact', 'delete', 'allow', 'family', 'Delete contacts'),
  
  -- Role management (admin only)
  ('role', 'assign', 'allow', 'family', 'Assign roles to family members'),
  ('role', 'revoke', 'allow', 'family', 'Revoke roles from family members'),
  ('role', 'view', 'allow', 'family', 'View role assignments'),
  
  -- System administration
  ('system', 'admin', 'allow', 'all', 'System administration access'),
  ('system', 'backup', 'allow', 'all', 'Database backup access'),
  ('system', 'audit', 'allow', 'all', 'Audit log access'),
  
  -- Emergency permissions
  ('emergency', 'override', 'allow', 'family', 'Activate emergency override'),
  ('emergency', 'access', 'allow', 'all', 'Emergency access to critical info'),
  
  -- Notification permissions
  ('notification', 'send', 'allow', 'family', 'Send notifications'),
  ('notification', 'read', 'allow', 'own', 'Read own notifications'),
  
  -- Delegation permissions
  ('delegation', 'create', 'allow', 'own', 'Create delegations'),
  ('delegation', 'approve', 'allow', 'family', 'Approve delegations'),
  ('delegation', 'revoke', 'allow', 'own', 'Revoke own delegations');

-- Link permission sets to permissions
-- Get permission set and permission IDs for linking
DO $$
DECLARE
  admin_set_id UUID;
  caregiver_set_id UUID;
  viewer_set_id UUID;
  self_mgmt_set_id UUID;
  emergency_set_id UUID;
  child_set_id UUID;
  helper_set_id UUID;
  bot_set_id UUID;
BEGIN
  -- Get permission set IDs
  SELECT id INTO admin_set_id FROM permission_sets WHERE name = 'full_admin';
  SELECT id INTO caregiver_set_id FROM permission_sets WHERE name = 'caregiver_base';
  SELECT id INTO viewer_set_id FROM permission_sets WHERE name = 'viewer_base';
  SELECT id INTO self_mgmt_set_id FROM permission_sets WHERE name = 'self_management';
  SELECT id INTO emergency_set_id FROM permission_sets WHERE name = 'emergency_access';
  SELECT id INTO child_set_id FROM permission_sets WHERE name = 'child_safe';
  SELECT id INTO helper_set_id FROM permission_sets WHERE name = 'helper_temporary';
  SELECT id INTO bot_set_id FROM permission_sets WHERE name = 'bot_automation';
  
  -- Full admin gets all permissions
  INSERT INTO permission_set_permissions (permission_set_id, permission_id)
  SELECT admin_set_id, id FROM permissions;
  
  -- Caregiver permissions
  INSERT INTO permission_set_permissions (permission_set_id, permission_id)
  SELECT caregiver_set_id, id FROM permissions 
  WHERE (resource, action) IN (
    ('user', 'read'), ('user', 'update'),
    ('schedule', 'create'), ('schedule', 'read'), ('schedule', 'update'), ('schedule', 'delete'),
    ('task', 'create'), ('task', 'read'), ('task', 'update'), ('task', 'delete'), ('task', 'assign'),
    ('document', 'create'), ('document', 'read'), ('document', 'update'), ('document', 'delete'),
    ('contact', 'create'), ('contact', 'read'), ('contact', 'update'), ('contact', 'delete'),
    ('notification', 'send'), ('notification', 'read'),
    ('delegation', 'create'), ('delegation', 'approve'), ('delegation', 'revoke')
  );
  
  -- Viewer permissions (read-only)
  INSERT INTO permission_set_permissions (permission_set_id, permission_id)
  SELECT viewer_set_id, id FROM permissions 
  WHERE action = 'read' OR (resource, action) = ('notification', 'read');
  
  -- Self-management permissions
  INSERT INTO permission_set_permissions (permission_set_id, permission_id)
  SELECT self_mgmt_set_id, id FROM permissions 
  WHERE scope = 'own' OR (resource, action) IN (
    ('schedule', 'read'), ('schedule', 'update'),
    ('task', 'read'), ('task', 'update'),
    ('document', 'read')
  );
  
  -- Emergency access permissions
  INSERT INTO permission_set_permissions (permission_set_id, permission_id)
  SELECT emergency_set_id, id FROM permissions 
  WHERE resource = 'emergency' OR (resource, action) IN (
    ('user', 'read'), ('contact', 'read'), ('document', 'read')
  );
  
  -- Child-safe permissions
  INSERT INTO permission_set_permissions (permission_set_id, permission_id)
  SELECT child_set_id, id FROM permissions 
  WHERE scope = 'own' OR (resource, action) IN (
    ('schedule', 'read'), ('task', 'read'), ('task', 'update'),
    ('notification', 'read')
  );
  
  -- Helper permissions (temporary, limited)
  INSERT INTO permission_set_permissions (permission_set_id, permission_id)
  SELECT helper_set_id, id FROM permissions 
  WHERE (resource, action) IN (
    ('schedule', 'read'), ('task', 'read'), ('task', 'update'),
    ('contact', 'read'), ('notification', 'read')
  );
  
  -- Bot automation permissions
  INSERT INTO permission_set_permissions (permission_set_id, permission_id)
  SELECT bot_set_id, id FROM permissions 
  WHERE (resource, action) IN (
    ('notification', 'send'), ('schedule', 'read'), ('task', 'read'),
    ('user', 'read')
  );
END $$;

-- Link roles to permission sets
DO $$
DECLARE
  admin_role_id UUID;
  caregiver_role_id UUID;
  viewer_role_id UUID;
  care_recipient_role_id UUID;
  child_role_id UUID;
  helper_role_id UUID;
  emergency_role_id UUID;
  bot_role_id UUID;
  
  admin_set_id UUID;
  caregiver_set_id UUID;
  viewer_set_id UUID;
  self_mgmt_set_id UUID;
  emergency_set_id UUID;
  child_set_id UUID;
  helper_set_id UUID;
  bot_set_id UUID;
BEGIN
  -- Get role IDs
  SELECT id INTO admin_role_id FROM roles WHERE type = 'admin';
  SELECT id INTO caregiver_role_id FROM roles WHERE type = 'caregiver';
  SELECT id INTO viewer_role_id FROM roles WHERE type = 'viewer';
  SELECT id INTO care_recipient_role_id FROM roles WHERE type = 'care_recipient';
  SELECT id INTO child_role_id FROM roles WHERE type = 'child';
  SELECT id INTO helper_role_id FROM roles WHERE type = 'helper';
  SELECT id INTO emergency_role_id FROM roles WHERE type = 'emergency_contact';
  SELECT id INTO bot_role_id FROM roles WHERE type = 'bot_agent';
  
  -- Get permission set IDs
  SELECT id INTO admin_set_id FROM permission_sets WHERE name = 'full_admin';
  SELECT id INTO caregiver_set_id FROM permission_sets WHERE name = 'caregiver_base';
  SELECT id INTO viewer_set_id FROM permission_sets WHERE name = 'viewer_base';
  SELECT id INTO self_mgmt_set_id FROM permission_sets WHERE name = 'self_management';
  SELECT id INTO emergency_set_id FROM permission_sets WHERE name = 'emergency_access';
  SELECT id INTO child_set_id FROM permission_sets WHERE name = 'child_safe';
  SELECT id INTO helper_set_id FROM permission_sets WHERE name = 'helper_temporary';
  SELECT id INTO bot_set_id FROM permission_sets WHERE name = 'bot_automation';
  
  -- Link roles to permission sets
  INSERT INTO role_permission_sets (role_id, permission_set_id) VALUES
    (admin_role_id, admin_set_id),
    (caregiver_role_id, caregiver_set_id),
    (viewer_role_id, viewer_set_id),
    (care_recipient_role_id, self_mgmt_set_id),
    (child_role_id, child_set_id),
    (helper_role_id, helper_set_id),
    (emergency_role_id, emergency_set_id),
    (bot_role_id, bot_set_id);
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all RBAC tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_permission_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_permission_changes ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (these would need to be customized based on your auth system)
-- Note: These policies assume you have a way to identify admin users

-- Roles - readable by all authenticated users, manageable by admins
CREATE POLICY "roles_read_policy" ON roles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "roles_admin_policy" ON roles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() 
    AND r.type = 'admin' 
    AND ur.state = 'active'
  )
);

-- User roles - users can see their own roles, admins can see all
CREATE POLICY "user_roles_self_policy" ON user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_roles_admin_policy" ON user_roles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() 
    AND r.type = 'admin' 
    AND ur.state = 'active'
  )
);

-- Audit logs - admins only
CREATE POLICY "audit_admin_only" ON audit_permission_checks FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() 
    AND r.type = 'admin' 
    AND ur.state = 'active'
  )
);

CREATE POLICY "audit_changes_admin_only" ON audit_permission_changes FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() 
    AND r.type = 'admin' 
    AND ur.state = 'active'
  )
);

-- Initial refresh of materialized view
SELECT refresh_user_permissions();

COMMIT;

-- ============================================================================
-- MIGRATION DOWN (Rollback)
-- ============================================================================
-- Uncomment and run the following to rollback this migration:

-- BEGIN;
-- 
-- -- Drop materialized view
-- DROP MATERIALIZED VIEW IF EXISTS user_permissions CASCADE;
-- 
-- -- Drop RLS policies
-- DROP POLICY IF EXISTS "roles_read_policy" ON roles;
-- DROP POLICY IF EXISTS "roles_admin_policy" ON roles;
-- DROP POLICY IF EXISTS "user_roles_self_policy" ON user_roles;
-- DROP POLICY IF EXISTS "user_roles_admin_policy" ON user_roles;
-- DROP POLICY IF EXISTS "audit_admin_only" ON audit_permission_checks;
-- DROP POLICY IF EXISTS "audit_changes_admin_only" ON audit_permission_changes;
-- 
-- -- Drop triggers
-- DROP TRIGGER IF EXISTS prevent_cycles_trigger ON permission_set_hierarchy;
-- DROP TRIGGER IF EXISTS validate_scope_entity_trigger ON user_role_scopes;
-- DROP TRIGGER IF EXISTS validate_delegation_scope_entity_trigger ON delegation_scopes;
-- DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
-- DROP TRIGGER IF EXISTS update_permission_sets_updated_at ON permission_sets;
-- 
-- -- Drop functions
-- DROP FUNCTION IF EXISTS prevent_permission_set_cycles();
-- DROP FUNCTION IF EXISTS add_permission_set_inheritance(UUID, UUID);
-- DROP FUNCTION IF EXISTS validate_scope_entity();
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP FUNCTION IF EXISTS refresh_user_permissions();
-- 
-- -- Drop tables in dependency order
-- DROP TABLE IF EXISTS audit_permission_changes CASCADE;
-- DROP TABLE IF EXISTS audit_permission_checks CASCADE;
-- DROP TABLE IF EXISTS emergency_overrides CASCADE;
-- DROP TABLE IF EXISTS delegation_permissions CASCADE;
-- DROP TABLE IF EXISTS delegation_scopes CASCADE;
-- DROP TABLE IF EXISTS delegations CASCADE;
-- DROP TABLE IF EXISTS recurring_schedules CASCADE;
-- DROP TABLE IF EXISTS user_role_scopes CASCADE;
-- DROP TABLE IF EXISTS user_roles CASCADE;
-- DROP TABLE IF EXISTS role_permission_sets CASCADE;
-- DROP TABLE IF EXISTS permission_set_permissions CASCADE;
-- DROP TABLE IF EXISTS permission_set_hierarchy CASCADE;
-- DROP TABLE IF EXISTS permission_sets CASCADE;
-- DROP TABLE IF EXISTS permissions CASCADE;
-- DROP TABLE IF EXISTS roles CASCADE;
-- 
-- COMMIT;