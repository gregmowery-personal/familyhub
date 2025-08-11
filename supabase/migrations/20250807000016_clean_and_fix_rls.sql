-- Clean up ALL existing policies and apply correct ones
-- This is the final, working solution

BEGIN;

-- Ensure RLS is enabled
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memberships ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on both tables
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Drop all policies on families table
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'families' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON families', pol.policyname);
    END LOOP;
    
    -- Drop all policies on family_memberships table
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'family_memberships' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON family_memberships', pol.policyname);
    END LOOP;
END $$;

-- Create clean, simple policies for families table
CREATE POLICY "families_insert_v2" ON families 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "families_select_v2" ON families 
FOR SELECT 
USING (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 
    FROM family_memberships 
    WHERE family_memberships.family_id = families.id 
    AND family_memberships.user_id = auth.uid() 
    AND family_memberships.status = 'active'
  )
);

CREATE POLICY "families_update_v2" ON families 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM family_memberships fm
    JOIN roles r ON fm.role_id = r.id
    WHERE fm.family_id = families.id 
    AND fm.user_id = auth.uid() 
    AND fm.status = 'active'
    AND r.type = 'family_coordinator'
  )
);

CREATE POLICY "families_delete_v2" ON families 
FOR DELETE 
USING (created_by = auth.uid());

-- Create clean, simple policies for family_memberships table
CREATE POLICY "memberships_insert_v2" ON family_memberships 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "memberships_select_v2" ON family_memberships 
FOR SELECT 
USING (
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 
    FROM family_memberships fm2
    WHERE fm2.family_id = family_memberships.family_id 
    AND fm2.user_id = auth.uid() 
    AND fm2.status = 'active'
    AND fm2.id != family_memberships.id
  )
);

CREATE POLICY "memberships_update_v2" ON family_memberships 
FOR UPDATE 
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 
    FROM family_memberships fm
    JOIN roles r ON fm.role_id = r.id
    WHERE fm.family_id = family_memberships.family_id 
    AND fm.user_id = auth.uid() 
    AND fm.status = 'active'
    AND r.type = 'family_coordinator'
    AND fm.id != family_memberships.id
  )
);

CREATE POLICY "memberships_delete_v2" ON family_memberships 
FOR DELETE 
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 
    FROM family_memberships fm
    JOIN roles r ON fm.role_id = r.id
    WHERE fm.family_id = family_memberships.family_id 
    AND fm.user_id = auth.uid() 
    AND fm.status = 'active'
    AND r.type = 'family_coordinator'
    AND fm.id != family_memberships.id
  )
);

COMMIT;