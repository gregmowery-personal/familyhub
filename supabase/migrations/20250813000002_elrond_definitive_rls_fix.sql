-- ============================================================================
-- ELROND'S DEFINITIVE RLS FIX - SECURITY DEFINER APPROACH
-- Date: 2025-08-13
-- Author: Elrond, Lord of Rivendell
-- 
-- "I was there when the policies were written. I was there when they failed."
-- 
-- PROBLEM: Infinite recursion in family_memberships RLS policies
-- ROOT CAUSE: Policies on family_memberships that directly query family_memberships
-- SOLUTION: Use SECURITY DEFINER functions to break the recursion chain
-- ============================================================================

BEGIN;

-- Step 1: Clean slate - disable RLS and drop ALL existing policies
ALTER TABLE family_memberships DISABLE ROW LEVEL SECURITY;

-- Drop all family_memberships policies
DO $$ 
DECLARE 
    policy_rec RECORD;
BEGIN
    FOR policy_rec IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'family_memberships'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_rec.policyname || '" ON family_memberships';
        RAISE NOTICE 'Dropped policy: %', policy_rec.policyname;
    END LOOP;
END $$;

-- Step 2: Create SECURITY DEFINER helper functions
-- These functions run with elevated privileges and bypass RLS,
-- breaking the recursion chain that caused infinite loops

CREATE OR REPLACE FUNCTION user_is_family_member(target_family_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- This function runs as SECURITY DEFINER, bypassing RLS
  -- Check if the current user is an active member of the target family
  RETURN EXISTS (
    SELECT 1 FROM family_memberships
    WHERE family_id = target_family_id
    AND user_id = auth.uid()
    AND status = 'active'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

CREATE OR REPLACE FUNCTION user_is_family_coordinator(target_family_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the current user is a coordinator in the target family
  RETURN EXISTS (
    SELECT 1 
    FROM family_memberships fm
    INNER JOIN roles r ON fm.role_id = r.id
    WHERE fm.family_id = target_family_id
    AND fm.user_id = auth.uid()
    AND fm.status = 'active'
    AND r.type IN ('family_coordinator', 'system_admin')
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

-- Step 3: Create NON-RECURSIVE policies using the helper functions

-- SELECT Policy: Users can view memberships in families they belong to
CREATE POLICY "family_memberships_select_secure" ON family_memberships
  FOR SELECT USING (
    -- Users can always see their own membership
    user_id = auth.uid()
    OR
    -- Users can see memberships in families they belong to (via helper function)
    user_is_family_member(family_id)
  );

-- INSERT Policy: Users can create their own membership or coordinators can add others  
CREATE POLICY "family_memberships_insert_secure" ON family_memberships
  FOR INSERT WITH CHECK (
    -- Users can insert their own membership (for family creation)
    user_id = auth.uid()
    OR
    -- Family coordinators can add others
    user_is_family_coordinator(family_id)
  );

-- UPDATE Policy: Users can update their own, coordinators can update any in their family
CREATE POLICY "family_memberships_update_secure" ON family_memberships
  FOR UPDATE USING (
    -- Users can update their own membership
    user_id = auth.uid()
    OR
    -- Family coordinators can update any membership in their family
    user_is_family_coordinator(family_id)
  );

-- DELETE Policy: Only coordinators can delete memberships
CREATE POLICY "family_memberships_delete_secure" ON family_memberships
  FOR DELETE USING (
    -- Only family coordinators can delete memberships
    user_is_family_coordinator(family_id)
  );

-- Step 4: Fix families table policies using the same approach
DROP POLICY IF EXISTS "families_select_policy" ON families;
DROP POLICY IF EXISTS "families_view_policy" ON families;  
DROP POLICY IF EXISTS "families_select_simple" ON families;
DROP POLICY IF EXISTS "view_families" ON families;
DROP POLICY IF EXISTS "families_select_non_recursive" ON families;

CREATE POLICY "families_select_secure" ON families
  FOR SELECT USING (
    -- Users can view families they are members of
    user_is_family_member(id)
  );

-- Step 5: Re-enable RLS
ALTER TABLE family_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

-- Step 6: Grant appropriate permissions on the helper functions
GRANT EXECUTE ON FUNCTION user_is_family_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_is_family_coordinator(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_is_family_member(UUID) TO anon;
GRANT EXECUTE ON FUNCTION user_is_family_coordinator(UUID) TO anon;

-- Step 7: Add security comments
COMMENT ON FUNCTION user_is_family_member(UUID) IS 
  'SECURITY DEFINER function to check family membership without RLS recursion. Used by RLS policies.';

COMMENT ON FUNCTION user_is_family_coordinator(UUID) IS 
  'SECURITY DEFINER function to check coordinator status without RLS recursion. Used by RLS policies.';

COMMENT ON POLICY "family_memberships_select_secure" ON family_memberships IS 
  'Non-recursive SELECT policy using SECURITY DEFINER helper functions to avoid infinite recursion';

COMMENT ON POLICY "family_memberships_insert_secure" ON family_memberships IS 
  'Non-recursive INSERT policy using SECURITY DEFINER helper functions';

COMMENT ON POLICY "family_memberships_update_secure" ON family_memberships IS 
  'Non-recursive UPDATE policy using SECURITY DEFINER helper functions';

COMMENT ON POLICY "family_memberships_delete_secure" ON family_memberships IS 
  'Non-recursive DELETE policy using SECURITY DEFINER helper functions';

COMMIT;

-- Verification: Test the problematic query that was causing infinite recursion
-- This should now work without issues
SELECT 
  'Testing the fix - this query should work without recursion' as test_message,
  COUNT(*) as matching_records
FROM family_memberships
WHERE family_id = 'c36260a4-9e13-4d0b-98fd-551749e79e03'
  AND user_id = '93029e4f-1d9d-4420-a657-6402a2d78f22'
  AND status = 'active';

-- Display the new policies for verification
SELECT 
  'Elrond has banished the shadow of infinite recursion!' as success_message,
  policyname,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No restrictions'
  END as restriction_type
FROM pg_policies 
WHERE tablename = 'family_memberships'
ORDER BY cmd, policyname;