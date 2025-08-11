-- FINAL COMPREHENSIVE FIX - RUN THIS NOW IN SUPABASE SQL EDITOR
-- This fixes BOTH families and family_memberships policies

BEGIN;

-- ============================================
-- STEP 1: DROP ALL PROBLEMATIC POLICIES
-- ============================================

-- Drop ALL families policies that might check family_memberships
DROP POLICY IF EXISTS "families_member_policy" ON families;
DROP POLICY IF EXISTS "families_coordinator_policy" ON families;
DROP POLICY IF EXISTS "families_coordinator_update" ON families;
DROP POLICY IF EXISTS "families_coordinator_delete" ON families;
DROP POLICY IF EXISTS "families_create_policy" ON families;

-- Drop ALL family_memberships policies
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
DROP POLICY IF EXISTS "family_memberships_insert_allow_self" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_select_allow" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_update_allow" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_delete_allow" ON family_memberships;

-- ============================================
-- STEP 2: CREATE SIMPLE FAMILIES POLICIES
-- ============================================

-- CRITICAL: Simple INSERT policy for families with NO checks to family_memberships
CREATE POLICY "families_insert_simple" ON families 
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- SELECT policy for families (only check memberships for SELECT, not INSERT)
CREATE POLICY "families_select_simple" ON families 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM family_memberships fm
    WHERE fm.family_id = families.id 
    AND fm.user_id = auth.uid() 
    AND fm.status = 'active'
  )
);

-- UPDATE policy for families
CREATE POLICY "families_update_simple" ON families 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM family_memberships fm
    JOIN roles r ON fm.role_id = r.id
    WHERE fm.family_id = families.id 
    AND fm.user_id = auth.uid() 
    AND fm.status = 'active'
    AND r.type = 'family_coordinator'
  )
);

-- DELETE policy for families
CREATE POLICY "families_delete_simple" ON families 
FOR DELETE USING (
  created_by = auth.uid()
);

-- ============================================
-- STEP 3: CREATE SIMPLE FAMILY_MEMBERSHIPS POLICIES
-- ============================================

-- CRITICAL: Simple INSERT policy - just check user_id
CREATE POLICY "memberships_insert_simple" ON family_memberships 
FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

-- SELECT policy
CREATE POLICY "memberships_select_simple" ON family_memberships 
FOR SELECT USING (
  user_id = auth.uid() 
  OR 
  family_id IN (
    SELECT family_id FROM family_memberships fm2
    WHERE fm2.user_id = auth.uid() 
    AND fm2.status = 'active'
  )
);

-- UPDATE policy
CREATE POLICY "memberships_update_simple" ON family_memberships 
FOR UPDATE USING (
  user_id = auth.uid()
);

-- DELETE policy
CREATE POLICY "memberships_delete_simple" ON family_memberships 
FOR DELETE USING (
  user_id = auth.uid()
);

COMMIT;

-- ============================================
-- STEP 4: VERIFY THE FIX
-- ============================================

-- Check what policies exist now
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd,
  qual
FROM pg_policies  
WHERE tablename IN ('families', 'family_memberships')
ORDER BY tablename, policyname;