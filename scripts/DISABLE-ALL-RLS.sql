-- NUCLEAR OPTION - TEMPORARILY DISABLE RLS TO TEST
-- This will confirm if RLS is the issue

BEGIN;

-- DISABLE RLS on both tables temporarily
ALTER TABLE families DISABLE ROW LEVEL SECURITY;
ALTER TABLE family_memberships DISABLE ROW LEVEL SECURITY;

COMMIT;

-- To re-enable later:
-- ALTER TABLE families ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE family_memberships ENABLE ROW LEVEL SECURITY;