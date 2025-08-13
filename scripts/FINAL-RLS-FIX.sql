-- ============================================================================
-- FINAL FIX FOR RLS INFINITE RECURSION
-- Run this in Supabase SQL Editor
-- ============================================================================

BEGIN;

-- 1. Temporarily disable RLS to clean up
ALTER TABLE family_memberships DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies
DROP POLICY IF EXISTS "family_memberships_insert_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_view_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_update_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_delete_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_insert_safe" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_view_safe" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_select_policy" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_select_simple" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_insert_simple" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_update_simple" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_delete_simple" ON family_memberships;
DROP POLICY IF EXISTS "allow_view_own_membership" ON family_memberships;
DROP POLICY IF EXISTS "allow_view_family_members" ON family_memberships;
DROP POLICY IF EXISTS "allow_insert_own_membership" ON family_memberships;
DROP POLICY IF EXISTS "allow_coordinator_insert" ON family_memberships;
DROP POLICY IF EXISTS "allow_update_own_membership" ON family_memberships;
DROP POLICY IF EXISTS "allow_coordinator_update" ON family_memberships;
DROP POLICY IF EXISTS "allow_coordinator_delete" ON family_memberships;

-- 3. Create ONE simple SELECT policy that avoids recursion
CREATE POLICY "view_memberships" ON family_memberships
  FOR SELECT USING (
    -- Users can always see their own membership
    user_id = auth.uid()
    OR
    -- Users can see memberships in their families (non-recursive check)
    family_id IN (
      SELECT DISTINCT fm.family_id 
      FROM family_memberships fm
      WHERE fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

-- 4. Simple INSERT policy
CREATE POLICY "insert_memberships" ON family_memberships
  FOR INSERT WITH CHECK (
    -- Can insert your own membership (for family creation)
    user_id = auth.uid()
    OR
    -- Coordinators can add others (uses EXISTS to avoid recursion)
    EXISTS (
      SELECT 1 
      FROM family_memberships fm
      INNER JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_memberships.family_id
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND r.type = 'family_coordinator'
    )
  );

-- 5. Simple UPDATE policy  
CREATE POLICY "update_memberships" ON family_memberships
  FOR UPDATE USING (
    -- Can update your own membership
    user_id = auth.uid()
    OR
    -- Coordinators can update others
    EXISTS (
      SELECT 1 
      FROM family_memberships fm
      INNER JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_memberships.family_id
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND r.type = 'family_coordinator'
    )
  );

-- 6. Simple DELETE policy
CREATE POLICY "delete_memberships" ON family_memberships
  FOR DELETE USING (
    EXISTS (
      SELECT 1 
      FROM family_memberships fm
      INNER JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_memberships.family_id
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND r.type = 'family_coordinator'
    )
  );

-- 7. Re-enable RLS
ALTER TABLE family_memberships ENABLE ROW LEVEL SECURITY;

-- 8. Also fix families table policies
DROP POLICY IF EXISTS "families_select_policy" ON families;
DROP POLICY IF EXISTS "families_view_policy" ON families;
DROP POLICY IF EXISTS "families_select_simple" ON families;

CREATE POLICY "view_families" ON families
  FOR SELECT USING (
    id IN (
      SELECT family_id 
      FROM family_memberships
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

ALTER TABLE families ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Test query (should return 1 row)
SELECT COUNT(*) as test_count
FROM family_memberships
WHERE family_id = 'c36260a4-9e13-4d0b-98fd-551749e79e03'
AND user_id = '93029e4f-1d9d-4420-a657-6402a2d78f22'
AND status = 'active';