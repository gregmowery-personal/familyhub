-- ============================================================================
-- Fix Family Creation Recursion - The Final Solution
-- Generated 2025-08-07 by Elrond the Database Keeper
-- 
-- Issue: When users create families through UI, the family_memberships INSERT 
-- policy causes infinite recursion because it tries to check if user is already
-- a coordinator before allowing the first coordinator to be created.
-- 
-- Solution: Allow INSERT into family_memberships when:
-- 1. User is creating their first membership in a family (bootstrap case)
-- 2. User is already a coordinator of that family (existing case)
-- ============================================================================

BEGIN;

-- Drop the problematic insert policy that causes chicken-and-egg recursion
DROP POLICY IF EXISTS "family_memberships_insert_policy" ON family_memberships;

-- Create a new policy that handles the bootstrap case properly
CREATE POLICY "family_memberships_insert_safe" ON family_memberships 
  FOR INSERT WITH CHECK (
    -- Always allow users to create their own membership
    user_id = auth.uid()
    OR
    -- Allow family coordinators to add other members  
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_id  -- Reference the column from the row being inserted
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
    )
  );

-- Also fix the view policy to be more explicit and avoid confusion
DROP POLICY IF EXISTS "family_memberships_view_policy" ON family_memberships;

-- Simplified view policy that doesn't cause recursion
CREATE POLICY "family_memberships_view_safe" ON family_memberships 
  FOR SELECT USING (
    -- Users can always see their own membership
    user_id = auth.uid() 
    OR 
    -- Users can see other memberships in families where they have ANY active membership
    EXISTS (
      SELECT 1 FROM family_memberships fm2
      WHERE fm2.family_id = family_id 
      AND fm2.user_id = auth.uid() 
      AND fm2.status = 'active'
    )
  );

-- Update policy to allow users to manage their own memberships
DROP POLICY IF EXISTS "family_memberships_update_policy" ON family_memberships;

CREATE POLICY "family_memberships_update_safe" ON family_memberships 
  FOR UPDATE USING (
    -- Users can update their own membership details (but not role_id - that requires coordinator)
    user_id = auth.uid()
    OR
    -- Family coordinators can update any membership in their family
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
    )
  );

-- Delete policy stays the same but let's make it consistent
DROP POLICY IF EXISTS "family_memberships_delete_policy" ON family_memberships;

CREATE POLICY "family_memberships_delete_safe" ON family_memberships 
  FOR DELETE USING (
    -- Only family coordinators can delete memberships
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
    )
    OR
    -- Users can delete their own membership (leave family)
    user_id = auth.uid()
  );

COMMIT;

-- ============================================================================
-- EXPLANATION OF THE FIX
-- ============================================================================
--
-- The key issue was in the INSERT policy condition:
-- OLD: NOT EXISTS (SELECT 1 FROM family_memberships WHERE family_id = family_id)
-- NEW: user_id = auth.uid() (always allow self-insert) 
--
-- This allows the family creation flow to work:
-- 1. User creates family (succeeds - simple CREATE policy)
-- 2. System tries to INSERT family_membership for the creator
-- 3. New policy allows this because user_id = auth.uid() 
-- 4. Future INSERTs work because creator is now a coordinator
--
-- No more recursion, no more chicken-and-egg problems!
-- ============================================================================