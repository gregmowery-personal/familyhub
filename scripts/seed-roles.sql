-- Seed script to ensure proper roles exist
-- Run this with: psql $DATABASE_URL -f scripts/seed-roles.sql
-- Or through Supabase SQL editor

BEGIN;

-- Check if we need to update the admin role to family_coordinator
DO $$
BEGIN
  -- If admin role exists, update it to family_coordinator
  IF EXISTS (SELECT 1 FROM roles WHERE type = 'admin') THEN
    UPDATE roles 
    SET 
      type = 'family_coordinator',
      name = 'Family Coordinator',
      description = 'Primary family coordinator with comprehensive management permissions',
      priority = 100
    WHERE type = 'admin';
    
    RAISE NOTICE 'Updated admin role to family_coordinator';
  END IF;
  
  -- If family_coordinator doesn't exist, create it
  IF NOT EXISTS (SELECT 1 FROM roles WHERE type = 'family_coordinator') THEN
    INSERT INTO roles (id, type, name, description, priority, is_system)
    VALUES (
      gen_random_uuid(),
      'family_coordinator',
      'Family Coordinator',
      'Primary family coordinator with comprehensive management permissions',
      100,
      true
    );
    
    RAISE NOTICE 'Created family_coordinator role';
  END IF;
END $$;

-- Ensure all standard roles exist
INSERT INTO roles (id, type, name, description, priority, is_system)
VALUES 
  (gen_random_uuid(), 'caregiver', 'Caregiver', 'Primary caregiver with significant management capabilities', 90, true),
  (gen_random_uuid(), 'care_recipient', 'Care Recipient', 'Person receiving care with appropriate access to their information', 70, true),
  (gen_random_uuid(), 'helper', 'Helper', 'Trusted family member or friend assisting with coordination', 60, true),
  (gen_random_uuid(), 'emergency_contact', 'Emergency Contact', 'Emergency contact with limited access for urgent situations', 50, true),
  (gen_random_uuid(), 'child', 'Child', 'Minor family member with age-appropriate restricted access', 40, true),
  (gen_random_uuid(), 'viewer', 'Viewer', 'Read-only access to shared family information', 30, true)
ON CONFLICT (type) DO NOTHING;

-- Verify roles
SELECT type, name, priority, is_system 
FROM roles 
ORDER BY priority DESC;

COMMIT;