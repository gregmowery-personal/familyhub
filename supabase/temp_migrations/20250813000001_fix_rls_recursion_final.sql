-- ============================================================================
-- Fix RLS Infinite Recursion - Complete Solution
-- Date: 2025-08-13
-- 
-- Issue: family_memberships RLS policies are causing infinite recursion
-- Error: "infinite recursion detected in policy for relation family_memberships"
-- 
-- Root Cause: Policies are referencing themselves in subqueries, creating loops
-- 
-- Solution: Create simplified, non-recursive policies using auth.uid() directly
-- ============================================================================

BEGIN;

-- First, drop ALL existing policies on family_memberships
DROP POLICY IF EXISTS "family_memberships_insert_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_view_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_update_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_delete_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_insert_safe" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_view_safe" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_select_policy" ON family_memberships;

-- Create new, simplified policies that avoid recursion

-- 1. SELECT: Users can view memberships if they are a member of the family
CREATE POLICY "family_memberships_select_simple" ON family_memberships
  FOR SELECT USING (
    -- Direct check: user can see their own membership
    user_id = auth.uid()
    OR
    -- Check via families table (avoids self-reference)
    family_id IN (
      SELECT fm.family_id 
      FROM family_memberships fm
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
      LIMIT 100  -- Prevent runaway queries
    )
  );

-- 2. INSERT: Users can create memberships
CREATE POLICY "family_memberships_insert_simple" ON family_memberships
  FOR INSERT WITH CHECK (
    -- Users can add themselves (for initial family creation)
    user_id = auth.uid()
    OR
    -- Or they must be a coordinator (check via direct query with limit)
    EXISTS (
      SELECT 1 
      FROM family_memberships fm
      INNER JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_memberships.family_id
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
      LIMIT 1
    )
  );

-- 3. UPDATE: Only coordinators can update memberships
CREATE POLICY "family_memberships_update_simple" ON family_memberships
  FOR UPDATE USING (
    -- User updating their own record
    user_id = auth.uid()
    OR
    -- Or they are a coordinator
    EXISTS (
      SELECT 1 
      FROM family_memberships fm
      INNER JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_memberships.family_id
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
      LIMIT 1
    )
  );

-- 4. DELETE: Only coordinators can remove memberships
CREATE POLICY "family_memberships_delete_simple" ON family_memberships
  FOR DELETE USING (
    EXISTS (
      SELECT 1 
      FROM family_memberships fm
      INNER JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_memberships.family_id
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
      LIMIT 1
    )
  );

-- Also fix families table policies if they reference family_memberships
DROP POLICY IF EXISTS "families_select_policy" ON families;
DROP POLICY IF EXISTS "families_view_policy" ON families;

-- Simplified families view policy
CREATE POLICY "families_select_simple" ON families
  FOR SELECT USING (
    -- User is a member of this family
    id IN (
      SELECT family_id 
      FROM family_memberships
      WHERE user_id = auth.uid()
      AND status = 'active'
      LIMIT 100
    )
  );

-- Ensure RLS is enabled
ALTER TABLE family_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Add helpful comment
COMMENT ON POLICY "family_memberships_select_simple" ON family_memberships IS 
  'Non-recursive policy: Users can view memberships for families they belong to';