-- Migration: Fix RLS Infinite Recursion in RBAC System
-- Date: 2025-08-07
-- Author: Elrond Half-elven, Lord of Rivendell, Keeper of Database Realms
-- Purpose: Breaks the circular dependency between roles and user_roles RLS policies
--          that was causing infinite recursion when querying roles during family creation

-- ============================================================================
-- MIGRATION UP - BREAKING THE CHAINS OF RECURSION
-- ============================================================================

BEGIN;

-- First, we must drop the cursed policies that create the circular reference
DROP POLICY IF EXISTS "roles_admin_policy" ON roles;
DROP POLICY IF EXISTS "user_roles_admin_policy" ON user_roles;

-- ============================================================================
-- SOLUTION: Use materialized view with security definer function
-- ============================================================================

-- Create a security definer function to check admin status without RLS recursion
-- This function bypasses RLS by running with definer's privileges
CREATE OR REPLACE FUNCTION public.is_user_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- Directly count admin roles without triggering RLS on user_roles
  -- We use a direct query that won't trigger recursive policy checks
  SELECT COUNT(*)
  INTO admin_count
  FROM user_roles ur
  INNER JOIN roles r ON ur.role_id = r.id
  WHERE ur.user_id = check_user_id
    AND r.type IN ('admin', 'family_coordinator', 'system_admin')
    AND ur.state = 'active'
    AND r.state = 'active';
  
  RETURN admin_count > 0;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_user_admin(UUID) TO authenticated;

-- ============================================================================
-- RECREATE POLICIES WITHOUT CIRCULAR DEPENDENCIES
-- ============================================================================

-- New roles policy that uses our security definer function
-- This prevents recursion by not querying user_roles within RLS context
CREATE POLICY "roles_admin_policy_safe" ON roles 
FOR ALL 
USING (public.is_user_admin(auth.uid()));

-- New user_roles policy that allows self-access and admin access
-- For user_roles, we use a simpler approach that doesn't create recursion
CREATE POLICY "user_roles_admin_policy_safe" ON user_roles 
FOR ALL 
USING (
  -- Users can always access their own roles
  user_id = auth.uid() 
  OR 
  -- Admins can access all roles (using our safe function)
  public.is_user_admin(auth.uid())
);

-- ============================================================================
-- ADDITIONAL SAFETY: Make roles readable for family operations
-- ============================================================================

-- Ensure basic role information is readable for family creation/management
-- This allows the family creation process to query role information
CREATE POLICY "roles_family_operations_read" ON roles 
FOR SELECT 
USING (
  -- All authenticated users can read role information
  -- This is safe because roles contain no sensitive data
  auth.uid() IS NOT NULL 
  AND state = 'active'
);

-- ============================================================================
-- OPTIMIZE: Add function-based index for performance
-- ============================================================================

-- Create an index to optimize the admin check function
-- This helps performance when checking admin status frequently
CREATE INDEX IF NOT EXISTS idx_user_roles_admin_check 
ON user_roles(user_id, state) 
WHERE state = 'active';

-- Create an index on roles for the admin type check
CREATE INDEX IF NOT EXISTS idx_roles_admin_types 
ON roles(type, state) 
WHERE state = 'active' 
AND type IN ('admin', 'family_coordinator', 'system_admin');

-- ============================================================================
-- SECURITY: Add comment explaining the solution
-- ============================================================================

COMMENT ON FUNCTION public.is_user_admin(UUID) IS 
'Security definer function to check admin status without RLS recursion. 
Used to break circular dependency between roles and user_roles policies.
Returns true if user has active admin, family_coordinator, or system_admin role.';

-- ============================================================================
-- VERIFICATION: Test the fix with a simple query
-- ============================================================================

-- This query should now work without infinite recursion
-- It's commented out as verification but shows what should work
-- SELECT id, type, name, description FROM roles WHERE state = 'active';

COMMIT;

-- ============================================================================
-- TESTING NOTES FOR POST-MIGRATION
-- ============================================================================

-- After running this migration, test that these operations work:
-- 1. Query roles table: SELECT * FROM roles;
-- 2. Query user_roles table: SELECT * FROM user_roles;  
-- 3. Family creation process should be able to query roles
-- 4. Admin users should still be able to manage roles/user_roles
--
-- The key improvement is that role reads no longer trigger recursive policy checks,
-- breaking the infinite loop while maintaining security.

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================

-- To rollback this migration, run:
-- DROP POLICY IF EXISTS "roles_admin_policy_safe" ON roles;
-- DROP POLICY IF EXISTS "user_roles_admin_policy_safe" ON user_roles;
-- DROP POLICY IF EXISTS "roles_family_operations_read" ON roles;
-- DROP FUNCTION IF EXISTS public.is_user_admin(UUID);
-- 
-- Then restore the original policies (see RBAC schema migration)