-- ============================================================================
-- ELROND'S DEFINITIVE FIX FOR RLS INFINITE RECURSION
-- "I was there when the policies were written. I was there when they failed."
-- ============================================================================
--
-- PROBLEM: Infinite recursion in family_memberships RLS policies
-- ROOT CAUSE: Policies on family_memberships that query family_memberships
-- SOLUTION: Use SECURITY DEFINER functions to break the recursion chain
--
-- Execute this in Supabase SQL Editor with service role privileges
-- ============================================================================

BEGIN;

-- Step 1: Examine current policies (for debugging)
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'family_memberships'
ORDER BY policyname;

-- Step 2: Temporarily disable RLS to clean up safely
ALTER TABLE family_memberships DISABLE ROW LEVEL SECURITY;

-- Step 3: Drop ALL existing policies on family_memberships (be thorough)
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

-- Step 4: Create helper functions that bypass RLS using SECURITY DEFINER
-- These functions run with the privileges of the function owner (definer)
-- This breaks the recursion chain by not being subject to RLS policies

CREATE OR REPLACE FUNCTION user_is_family_member(target_family_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- This function runs as SECURITY DEFINER, so it bypasses RLS
  -- Check if the current user is an active member of the target family
  RETURN EXISTS (
    SELECT 1 FROM family_memberships
    WHERE family_id = target_family_id
    AND user_id = auth.uid()
    AND status = 'active'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create new, NON-RECURSIVE policies using the helper functions

-- 1. SELECT Policy: Users can view memberships in families they belong to
CREATE POLICY "family_memberships_select_non_recursive" ON family_memberships
  FOR SELECT USING (
    -- Users can always see their own membership
    user_id = auth.uid()
    OR
    -- Users can see memberships in families they belong to (via helper function)
    user_is_family_member(family_id)
  );

-- 2. INSERT Policy: Users can create their own membership or coordinators can add others
CREATE POLICY "family_memberships_insert_non_recursive" ON family_memberships
  FOR INSERT WITH CHECK (
    -- Users can insert their own membership (for family creation)
    user_id = auth.uid()
    OR
    -- Family coordinators can add others
    user_is_family_coordinator(family_id)
  );

-- 3. UPDATE Policy: Users can update their own, coordinators can update any in their family
CREATE POLICY "family_memberships_update_non_recursive" ON family_memberships
  FOR UPDATE USING (
    -- Users can update their own membership
    user_id = auth.uid()
    OR
    -- Family coordinators can update any membership in their family
    user_is_family_coordinator(family_id)
  );

-- 4. DELETE Policy: Only coordinators can delete memberships
CREATE POLICY "family_memberships_delete_non_recursive" ON family_memberships
  FOR DELETE USING (
    -- Only family coordinators can delete memberships
    user_is_family_coordinator(family_id)
  );

-- Step 6: Also fix families table policies if needed
DROP POLICY IF EXISTS "families_select_policy" ON families;
DROP POLICY IF EXISTS "families_view_policy" ON families;
DROP POLICY IF EXISTS "families_select_simple" ON families;
DROP POLICY IF EXISTS "view_families" ON families;

-- Create a simple families policy using our helper function
CREATE POLICY "families_select_non_recursive" ON families
  FOR SELECT USING (
    -- Users can view families they are members of
    user_is_family_member(id)
  );

-- Step 7: Re-enable RLS
ALTER TABLE family_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

-- Step 8: Test the fix with the problematic query
-- This should now work without infinite recursion
SELECT 
  id,
  family_id,
  user_id,
  status,
  created_at
FROM family_memberships
WHERE family_id = 'c36260a4-9e13-4d0b-98fd-551749e79e03'
AND user_id = '93029e4f-1d9d-4420-a657-6402a2d78f22'
AND status = 'active';

-- Verify policies are created correctly
SELECT 
  policyname, 
  cmd, 
  permissive,
  qual
FROM pg_policies 
WHERE tablename = 'family_memberships'
ORDER BY policyname;

COMMIT;

-- Add helpful comments
COMMENT ON FUNCTION user_is_family_member(UUID) IS 
  'SECURITY DEFINER function to check family membership without RLS recursion';

COMMENT ON FUNCTION user_is_family_coordinator(UUID) IS 
  'SECURITY DEFINER function to check coordinator status without RLS recursion';

COMMENT ON POLICY "family_memberships_select_non_recursive" ON family_memberships IS 
  'Non-recursive SELECT policy using SECURITY DEFINER helper functions';

-- Final verification message
SELECT 'The shadow of infinite recursion has been banished from the halls of Rivendell!' as elrond_message;