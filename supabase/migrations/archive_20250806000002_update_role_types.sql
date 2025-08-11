-- Migration: Update Role Types and Hierarchy
-- Date: 2025-08-06
-- Author: Elrond Half-elven, Lord of Rivendell
-- Purpose: Restructure the role hierarchy to include system_admin and rename admin to family_coordinator
--          Add proper priority-based role definitions for all 9 roles in the realm

-- ============================================================================
-- MIGRATION UP - THE REFORGING OF ROLES
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: UPDATE THE CHECK CONSTRAINT ON ROLES TABLE
-- ============================================================================

-- Remove the old constraint that bound us to the previous hierarchy
ALTER TABLE roles DROP CONSTRAINT roles_type_check;

-- Forge a new constraint that includes all 9 roles of the realm
ALTER TABLE roles ADD CONSTRAINT roles_type_check 
  CHECK (type IN (
    'system_admin',      -- The highest authority
    'family_coordinator', -- Renamed from 'admin'
    'caregiver', 
    'care_recipient', 
    'helper', 
    'emergency_contact', 
    'child', 
    'viewer', 
    'bot_agent'
  ));

-- ============================================================================
-- STEP 2: UPDATE EXISTING ADMIN ROLES TO FAMILY_COORDINATOR
-- ============================================================================

-- Transform the old admin role type to the new family_coordinator
UPDATE roles 
SET 
  type = 'family_coordinator',
  name = 'Family Coordinator',
  description = 'Primary family coordinator with comprehensive management permissions',
  priority = 100,
  updated_at = CURRENT_TIMESTAMP
WHERE type = 'admin';

-- Update any user role assignments that reference admin roles
-- (This updates the role type, but user_roles table references by role ID so no direct update needed there)

-- Update RLS policies that reference the old 'admin' type
-- First, we need to drop and recreate the policies that reference 'admin'

-- Drop existing admin-related policies
DROP POLICY IF EXISTS "roles_admin_policy" ON roles;
DROP POLICY IF EXISTS "user_roles_admin_policy" ON user_roles;
DROP POLICY IF EXISTS "audit_admin_only" ON audit_permission_checks;
DROP POLICY IF EXISTS "audit_changes_admin_only" ON audit_permission_changes;

-- Recreate policies with updated role types (family_coordinator OR system_admin)
CREATE POLICY "roles_admin_policy" ON roles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() 
    AND r.type IN ('family_coordinator', 'system_admin')
    AND ur.state = 'active'
  )
);

CREATE POLICY "user_roles_admin_policy" ON user_roles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() 
    AND r.type IN ('family_coordinator', 'system_admin')
    AND ur.state = 'active'
  )
);

CREATE POLICY "audit_admin_only" ON audit_permission_checks FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() 
    AND r.type IN ('family_coordinator', 'system_admin')
    AND ur.state = 'active'
  )
);

CREATE POLICY "audit_changes_admin_only" ON audit_permission_changes FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() 
    AND r.type IN ('family_coordinator', 'system_admin')
    AND ur.state = 'active'
  )
);

-- ============================================================================
-- STEP 3: INSERT/UPDATE ALL 9 ROLE DEFINITIONS WITH PROPER PRIORITIES
-- ============================================================================

-- First, ensure all required roles exist with proper priorities
-- Using INSERT ... ON CONFLICT to handle cases where roles might already exist

-- The Supreme Administrator - Master of all realms
INSERT INTO roles (id, type, name, description, priority, is_system, state)
VALUES (
  gen_random_uuid(), 
  'system_admin', 
  'System Administrator', 
  'Supreme authority with complete system access across all families and administrative functions', 
  200, 
  true, 
  'active'
) ON CONFLICT (type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  is_system = EXCLUDED.is_system,
  state = EXCLUDED.state,
  updated_at = CURRENT_TIMESTAMP;

-- Update the existing family_coordinator (formerly admin) with correct priority
UPDATE roles 
SET 
  priority = 100,
  name = 'Family Coordinator',
  description = 'Primary family coordinator with comprehensive management permissions for their family realm',
  updated_at = CURRENT_TIMESTAMP
WHERE type = 'family_coordinator';

-- Update caregiver priority and ensure proper definition
UPDATE roles 
SET 
  priority = 90,
  name = 'Primary Caregiver',
  description = 'Trusted caregiver who can manage schedules, tasks, and care recipients within their assigned scope',
  updated_at = CURRENT_TIMESTAMP
WHERE type = 'caregiver';

-- Update care_recipient priority and ensure proper definition
UPDATE roles 
SET 
  priority = 70,
  name = 'Care Recipient',
  description = 'Person receiving care with self-management permissions and limited family oversight access',
  updated_at = CURRENT_TIMESTAMP
WHERE type = 'care_recipient';

-- Update helper priority and ensure proper definition
UPDATE roles 
SET 
  priority = 60,
  name = 'Helper',
  description = 'Temporary helper with limited permissions for specific tasks and timeframes',
  updated_at = CURRENT_TIMESTAMP
WHERE type = 'helper';

-- Update emergency_contact priority and ensure proper definition
UPDATE roles 
SET 
  priority = 50,
  name = 'Emergency Contact',
  description = 'Emergency contact with access to critical information during urgent situations only',
  updated_at = CURRENT_TIMESTAMP
WHERE type = 'emergency_contact';

-- Update child priority and ensure proper definition
UPDATE roles 
SET 
  priority = 40,
  name = 'Child',
  description = 'Child family member with age-appropriate permissions and parental oversight',
  updated_at = CURRENT_TIMESTAMP
WHERE type = 'child';

-- Update viewer priority and ensure proper definition
UPDATE roles 
SET 
  priority = 30,
  name = 'Family Viewer',
  description = 'Family member or friend with read-only access to family information and schedules',
  updated_at = CURRENT_TIMESTAMP
WHERE type = 'viewer';

-- Update bot_agent priority and ensure proper definition
UPDATE roles 
SET 
  priority = 10,
  name = 'Bot Agent',
  description = 'Automated system agent for notifications, reminders, and system maintenance tasks',
  updated_at = CURRENT_TIMESTAMP
WHERE type = 'bot_agent';

-- ============================================================================
-- STEP 4: CREATE SYSTEM_ADMIN PERMISSION SET AND PERMISSIONS
-- ============================================================================

-- Create a supreme admin permission set
INSERT INTO permission_sets (id, name, description)
VALUES (
  gen_random_uuid(),
  'system_admin_supreme',
  'Supreme administrative permissions that transcend individual family boundaries'
) ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- Add system-level permissions that only system_admin should have
INSERT INTO permissions (resource, action, effect, scope, description) VALUES
  ('system', 'manage_families', 'allow', 'all', 'Create, modify, and delete family groups'),
  ('system', 'global_user_management', 'allow', 'all', 'Manage users across all families'),
  ('system', 'platform_configuration', 'allow', 'all', 'Configure platform-wide settings'),
  ('system', 'security_management', 'allow', 'all', 'Manage security policies and configurations'),
  ('system', 'data_export', 'allow', 'all', 'Export data across all families'),
  ('role', 'system_assign', 'allow', 'all', 'Assign system-level roles including other system admins')
ON CONFLICT (resource, action, effect, scope) DO NOTHING;

-- Link system admin permission set to the new permissions
DO $$
DECLARE
  system_admin_set_id UUID;
BEGIN
  SELECT id INTO system_admin_set_id FROM permission_sets WHERE name = 'system_admin_supreme';
  
  -- Grant all existing permissions to system admin
  INSERT INTO permission_set_permissions (permission_set_id, permission_id)
  SELECT system_admin_set_id, id FROM permissions
  ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
END $$;

-- Link system_admin role to its permission set
DO $$
DECLARE
  system_admin_role_id UUID;
  system_admin_set_id UUID;
BEGIN
  SELECT id INTO system_admin_role_id FROM roles WHERE type = 'system_admin';
  SELECT id INTO system_admin_set_id FROM permission_sets WHERE name = 'system_admin_supreme';
  
  INSERT INTO role_permission_sets (role_id, permission_set_id)
  VALUES (system_admin_role_id, system_admin_set_id)
  ON CONFLICT (role_id, permission_set_id) DO NOTHING;
END $$;

-- ============================================================================
-- STEP 5: UPDATE MATERIALIZED VIEW AND REFRESH
-- ============================================================================

-- The materialized view user_permissions should automatically pick up the changes
-- since it queries by role type, but we should refresh it to ensure consistency
SELECT refresh_user_permissions();

-- ============================================================================
-- STEP 6: ADD COMMENTS FOR FUTURE REFERENCE
-- ============================================================================

COMMENT ON TABLE roles IS 'Role definitions with hierarchy: system_admin (200) > family_coordinator (100) > caregiver (90) > care_recipient (70) > helper (60) > emergency_contact (50) > child (40) > viewer (30) > bot_agent (10)';

COMMENT ON COLUMN roles.priority IS 'Role priority for conflict resolution and hierarchy enforcement. Higher numbers indicate higher authority.';

COMMENT ON COLUMN roles.type IS 'Role type from the established hierarchy. system_admin has supreme authority, family_coordinator manages individual families.';

COMMIT;

-- ============================================================================
-- MIGRATION DOWN (Rollback) - IF NEEDED
-- ============================================================================
-- To rollback this migration, run the following:
--
-- BEGIN;
-- 
-- -- Revert priority changes and role definitions
-- UPDATE roles SET priority = 1000 WHERE type = 'family_coordinator';
-- UPDATE roles SET type = 'admin', name = 'System Administrator', 
--   description = 'Full system access with all permissions' WHERE type = 'family_coordinator';
-- 
-- -- Remove system_admin role and related data
-- DELETE FROM role_permission_sets WHERE role_id IN (SELECT id FROM roles WHERE type = 'system_admin');
-- DELETE FROM permission_set_permissions WHERE permission_set_id IN (SELECT id FROM permission_sets WHERE name = 'system_admin_supreme');
-- DELETE FROM permission_sets WHERE name = 'system_admin_supreme';
-- DELETE FROM permissions WHERE resource = 'system' AND action IN ('manage_families', 'global_user_management', 'platform_configuration', 'security_management', 'data_export');
-- DELETE FROM permissions WHERE resource = 'role' AND action = 'system_assign';
-- DELETE FROM roles WHERE type = 'system_admin';
-- 
-- -- Restore old constraint
-- ALTER TABLE roles DROP CONSTRAINT roles_type_check;
-- ALTER TABLE roles ADD CONSTRAINT roles_type_check 
--   CHECK (type IN ('admin', 'caregiver', 'viewer', 'care_recipient', 'child', 'helper', 'emergency_contact', 'bot_agent'));
-- 
-- -- Restore old RLS policies
-- DROP POLICY IF EXISTS "roles_admin_policy" ON roles;
-- DROP POLICY IF EXISTS "user_roles_admin_policy" ON user_roles;
-- DROP POLICY IF EXISTS "audit_admin_only" ON audit_permission_checks;
-- DROP POLICY IF EXISTS "audit_changes_admin_only" ON audit_permission_changes;
-- 
-- CREATE POLICY "roles_admin_policy" ON roles FOR ALL USING (
--   EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id 
--           WHERE ur.user_id = auth.uid() AND r.type = 'admin' AND ur.state = 'active')
-- );
-- 
-- CREATE POLICY "user_roles_admin_policy" ON user_roles FOR ALL USING (
--   EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id 
--           WHERE ur.user_id = auth.uid() AND r.type = 'admin' AND ur.state = 'active')
-- );
-- 
-- CREATE POLICY "audit_admin_only" ON audit_permission_checks FOR ALL USING (
--   EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id 
--           WHERE ur.user_id = auth.uid() AND r.type = 'admin' AND ur.state = 'active')
-- );
-- 
-- CREATE POLICY "audit_changes_admin_only" ON audit_permission_changes FOR ALL USING (
--   EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id 
--           WHERE ur.user_id = auth.uid() AND r.type = 'admin' AND ur.state = 'active')
-- );
-- 
-- SELECT refresh_user_permissions();
-- 
-- COMMIT;

-- ============================================================================
-- VALIDATION QUERIES - Use these to verify the migration succeeded
-- ============================================================================
-- 
-- -- Verify all 9 roles exist with correct priorities:
-- SELECT type, name, priority, state FROM roles ORDER BY priority DESC;
-- 
-- -- Verify system_admin has supreme permissions:
-- SELECT r.type, ps.name as permission_set, COUNT(p.id) as permission_count
-- FROM roles r
-- JOIN role_permission_sets rps ON r.id = rps.role_id
-- JOIN permission_sets ps ON rps.permission_set_id = ps.id
-- JOIN permission_set_permissions psp ON ps.id = psp.permission_set_id
-- JOIN permissions p ON psp.permission_id = p.id
-- WHERE r.type = 'system_admin'
-- GROUP BY r.type, ps.name;
-- 
-- -- Verify no admin roles remain:
-- SELECT COUNT(*) as remaining_admin_roles FROM roles WHERE type = 'admin';
-- 
-- -- Verify family_coordinator role is properly configured:
-- SELECT type, name, description, priority FROM roles WHERE type = 'family_coordinator';