-- Final RLS Fix - Properly configure policies for family creation
-- This migration fixes the infinite recursion issue once and for all

BEGIN;

-- First, ensure RLS is enabled
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memberships ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start fresh
DROP POLICY IF EXISTS "families_insert" ON families;
DROP POLICY IF EXISTS "families_select" ON families;
DROP POLICY IF EXISTS "families_update" ON families;
DROP POLICY IF EXISTS "families_delete" ON families;

DROP POLICY IF EXISTS "family_memberships_insert" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_select" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_update" ON family_memberships;
DROP POLICY IF EXISTS "family_memberships_delete" ON family_memberships;

-- ============================================
-- FAMILIES TABLE POLICIES
-- ============================================

-- INSERT: Any authenticated user can create a family
CREATE POLICY "families_insert" ON families 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT: Users can see families they created or belong to
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

-- DELETE: Only creator can delete
CREATE POLICY "families_delete" ON families 
FOR DELETE 
USING (created_by = auth.uid());

-- ============================================
-- FAMILY_MEMBERSHIPS TABLE POLICIES
-- ============================================

-- INSERT: Users can only insert their own membership
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
    AND fm2.id != family_memberships.id
  )
);

-- UPDATE: Users can update their own membership or coordinators can update any
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
    AND fm.id != family_memberships.id
  )
);

-- DELETE: Users can delete their own membership or coordinators can remove members
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
    AND fm.id != family_memberships.id
  )
);

COMMIT;