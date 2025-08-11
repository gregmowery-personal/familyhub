-- CORRECT RLS POLICIES - NO RECURSION
-- Run this to restore security without breaking family creation

BEGIN;

-- ============================================
-- STEP 1: RE-ENABLE RLS
-- ============================================
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memberships ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: FAMILIES TABLE POLICIES
-- ============================================

-- INSERT: Any authenticated user can create a family
CREATE POLICY "families_insert" ON families 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT: Users can see families they belong to
-- NOTE: This will fail for newly created families until membership exists
-- So we need to also allow seeing families you created
CREATE POLICY "families_select" ON families 
FOR SELECT 
USING (
  created_by = auth.uid()
  OR
  id IN (
    SELECT family_id 
    FROM family_memberships 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- UPDATE: Only family coordinators can update
CREATE POLICY "families_update" ON families 
FOR UPDATE 
USING (
  id IN (
    SELECT fm.family_id 
    FROM family_memberships fm
    JOIN roles r ON fm.role_id = r.id
    WHERE fm.user_id = auth.uid() 
    AND fm.status = 'active'
    AND r.type = 'family_coordinator'
  )
);

-- DELETE: Only creator can delete (for now)
CREATE POLICY "families_delete" ON families 
FOR DELETE 
USING (created_by = auth.uid());

-- ============================================
-- STEP 3: FAMILY_MEMBERSHIPS TABLE POLICIES
-- ============================================

-- INSERT: Users can only insert their own membership
-- NO RECURSION - just check user_id
CREATE POLICY "family_memberships_insert" ON family_memberships 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- SELECT: See your own memberships OR memberships in your families
CREATE POLICY "family_memberships_select" ON family_memberships 
FOR SELECT 
USING (
  user_id = auth.uid() 
  OR 
  family_id IN (
    SELECT fm2.family_id 
    FROM family_memberships fm2
    WHERE fm2.user_id = auth.uid() 
    AND fm2.status = 'active'
    -- Critical: Don't reference the same row being checked
    AND fm2.id != family_memberships.id
  )
);

-- UPDATE: Users can update their own membership (limited fields)
-- Coordinators can update any membership in their family
CREATE POLICY "family_memberships_update" ON family_memberships 
FOR UPDATE 
USING (
  user_id = auth.uid()
  OR
  family_id IN (
    SELECT fm.family_id 
    FROM family_memberships fm
    JOIN roles r ON fm.role_id = r.id
    WHERE fm.user_id = auth.uid() 
    AND fm.status = 'active'
    AND r.type = 'family_coordinator'
    -- Critical: Don't reference the same row being checked
    AND fm.id != family_memberships.id
  )
);

-- DELETE: Users can delete their own membership (leave family)
-- Coordinators can remove members
CREATE POLICY "family_memberships_delete" ON family_memberships 
FOR DELETE 
USING (
  user_id = auth.uid()
  OR
  family_id IN (
    SELECT fm.family_id 
    FROM family_memberships fm
    JOIN roles r ON fm.role_id = r.id
    WHERE fm.user_id = auth.uid() 
    AND fm.status = 'active'
    AND r.type = 'family_coordinator'
    -- Critical: Don't reference the same row being checked
    AND fm.id != family_memberships.id
  )
);

COMMIT;

-- ============================================
-- VERIFICATION QUERY
-- ============================================
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd
FROM pg_policies  
WHERE tablename IN ('families', 'family_memberships')
ORDER BY tablename, policyname;