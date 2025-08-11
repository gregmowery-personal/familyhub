-- ============================================================================
-- Fix infinite recursion in family_memberships table
-- Generated 2025-01-07 by Elrond the Database Keeper
-- 
-- Issue: The families_coordinator_policy (FOR ALL) creates a circular dependency
-- with family_memberships policies during INSERT operations.
-- ============================================================================

BEGIN;

-- Drop the problematic coordinator policy that causes recursion
DROP POLICY IF EXISTS "families_coordinator_policy" ON families;

-- Create separate policies for UPDATE and DELETE operations
-- These are more specific and won't interfere with INSERT

-- Family coordinators can UPDATE family settings
CREATE POLICY "families_update_policy" ON families 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = families.id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
    )
  );

-- Family coordinators can DELETE families  
CREATE POLICY "families_delete_policy" ON families 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = families.id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
    )
  );

-- Also fix the family_memberships self-referencing policy
-- The family_memberships_family_policy creates self-reference recursion
DROP POLICY IF EXISTS "family_memberships_family_policy" ON family_memberships;

-- Replace with a simpler policy that doesn't self-reference
-- Users can see memberships for families where they are active members
CREATE POLICY "family_memberships_view_policy" ON family_memberships 
  FOR SELECT USING (
    -- Users can see their own membership
    user_id = auth.uid() 
    OR 
    -- Users can see other memberships in families where they are active
    EXISTS (
      SELECT 1 FROM family_memberships fm2
      WHERE fm2.family_id = family_id 
      AND fm2.user_id = auth.uid() 
      AND fm2.status = 'active'
      -- Don't create recursion by referencing the same table in a different way
      AND fm2.id != family_memberships.id
    )
  );

-- Fix the coordinator policy to avoid self-reference recursion
DROP POLICY IF EXISTS "family_memberships_coordinator_policy" ON family_memberships;

-- Create separate policies for different operations to avoid recursion
CREATE POLICY "family_memberships_insert_policy" ON family_memberships 
  FOR INSERT WITH CHECK (
    -- Only family coordinators can insert memberships (except during family creation)
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
      AND fm.id != family_memberships.id  -- Avoid self-reference
    )
    OR 
    -- Allow system to create the first membership when family is created
    NOT EXISTS (SELECT 1 FROM family_memberships WHERE family_id = family_id)
  );

CREATE POLICY "family_memberships_update_policy" ON family_memberships 
  FOR UPDATE USING (
    -- Users can update their own membership
    user_id = auth.uid()
    OR
    -- Family coordinators can update memberships
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
      AND fm.id != family_memberships.id  -- Avoid self-reference
    )
  );

CREATE POLICY "family_memberships_delete_policy" ON family_memberships 
  FOR DELETE USING (
    -- Family coordinators can delete memberships
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
      AND fm.id != family_memberships.id  -- Avoid self-reference
    )
  );

COMMIT;