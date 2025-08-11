-- EMERGENCY FIX FOR FAMILY CREATION RECURSION
-- Run this in Supabase SQL Editor NOW

BEGIN;

-- Drop ALL existing family_memberships policies to start fresh
DROP POLICY IF EXISTS "family_memberships_insert_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_coordinator_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_family_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_self_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_view_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_update_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_delete_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_insert_safe" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_view_safe" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_select_safe" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_update_safe" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_delete_safe" ON family_memberships;

-- CREATE THE CRITICAL INSERT POLICY
-- This is the KEY fix - allows users to insert their own membership
CREATE POLICY "family_memberships_insert_allow_self" ON family_memberships 
FOR INSERT WITH CHECK (
  -- Users can ALWAYS create their own membership (no recursion check!)
  user_id = auth.uid()
);

-- CREATE SELECT POLICY
CREATE POLICY "family_memberships_select_allow" ON family_memberships 
FOR SELECT USING (
  -- Users can see their own memberships
  user_id = auth.uid() 
  OR 
  -- Users can see memberships in families they belong to
  family_id IN (
    SELECT family_id FROM family_memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- CREATE UPDATE POLICY
CREATE POLICY "family_memberships_update_allow" ON family_memberships 
FOR UPDATE USING (
  -- Users can update their own membership (except role)
  user_id = auth.uid()
  OR
  -- Coordinators can update any membership in their family
  family_id IN (
    SELECT fm.family_id FROM family_memberships fm
    JOIN roles r ON fm.role_id = r.id
    WHERE fm.user_id = auth.uid() 
    AND fm.status = 'active'
    AND r.type = 'family_coordinator'
  )
);

-- CREATE DELETE POLICY  
CREATE POLICY "family_memberships_delete_allow" ON family_memberships 
FOR DELETE USING (
  -- Users can leave (delete their own membership)
  user_id = auth.uid()
  OR
  -- Coordinators can remove members
  family_id IN (
    SELECT fm.family_id FROM family_memberships fm
    JOIN roles r ON fm.role_id = r.id
    WHERE fm.user_id = auth.uid() 
    AND fm.status = 'active'
    AND r.type = 'family_coordinator'
  )
);

COMMIT;

-- Verify the policies were created
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies  
WHERE tablename = 'family_memberships'
ORDER BY policyname;