/**
 * EMERGENCY FIX: Add family_coordinator role to database
 * Run immediately with: npx tsx scripts/emergency-fix-roles.ts
 */

import { createClient } from '@supabase/supabase-js';

// Use environment variables or hardcoded values
const supabaseUrl = 'https://nhfwemygprcilprwxtfp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyNzY1NCwiZXhwIjoyMDY5ODAzNjU0fQ.fGllakrVheUaRNP6UDExG_0juJD9w3eh_3pEKiOVZr0';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function emergencyFix() {
  console.log('🚨 EMERGENCY FIX: Adding family_coordinator role...\n');

  try {
    // Step 1: Check current roles
    console.log('📋 Current roles in database:');
    const { data: currentRoles } = await supabase
      .from('roles')
      .select('type, name, priority')
      .order('priority', { ascending: false });
    
    console.table(currentRoles?.map(r => ({ type: r.type, priority: r.priority })));

    // Step 2: Try to create family_coordinator role
    console.log('\n🔧 Attempting to create family_coordinator role...');
    
    const { data, error } = await supabase
      .from('roles')
      .insert({
        type: 'family_coordinator',
        name: 'Family Coordinator',
        description: 'Primary coordinator for a specific family with management permissions',
        priority: 150,
        is_system: true,
        state: 'active'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23514') {
        console.error('\n❌ CONSTRAINT VIOLATION: The database won\'t accept family_coordinator');
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 MANUAL ACTION REQUIRED - Copy and run this SQL in Supabase SQL Editor:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        const sqlFix = `-- EMERGENCY FIX: Add family_coordinator role
-- Run this in Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/nhfwemygprcilprwxtfp/sql/new

BEGIN;

-- Step 1: Drop the old constraint
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_type_check;

-- Step 2: Add new constraint that includes family_coordinator
ALTER TABLE roles 
ADD CONSTRAINT roles_type_check 
CHECK (type IN (
  'admin',              -- System administrator (priority 1000)
  'family_coordinator', -- Family manager (priority 150) <- ADDING THIS!
  'caregiver',          -- Primary caregiver (priority 800)
  'viewer',             -- Read-only access (priority 600)
  'care_recipient',     -- Person receiving care (priority 400)
  'child',              -- Minor family member (priority 300)
  'helper',             -- Extended family/friends (priority 200)
  'emergency_contact',  -- Emergency contacts (priority 100)
  'bot_agent'           -- AI/automated agents (priority 50)
));

-- Step 3: Create the family_coordinator role
INSERT INTO roles (type, name, description, priority, is_system, state)
VALUES (
  'family_coordinator',
  'Family Coordinator',
  'Primary coordinator for a specific family with management permissions',
  150,
  true,
  'active'
);

-- Step 4: Verify it worked
SELECT type, name, priority 
FROM roles 
WHERE type IN ('admin', 'family_coordinator')
ORDER BY priority DESC;

COMMIT;

-- Expected output:
-- type                | name                  | priority
-- admin               | System Administrator  | 1000
-- family_coordinator  | Family Coordinator    | 150`;

        console.log(sqlFix);
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('👆 COPY THE SQL ABOVE AND RUN IT IN SUPABASE SQL EDITOR');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        console.log('🔗 Direct link to SQL Editor:');
        console.log('   https://supabase.com/dashboard/project/nhfwemygprcilprwxtfp/sql/new\n');
        
        process.exit(1);
      } else if (error.code === '23505') {
        console.log('✅ family_coordinator role already exists!');
      } else {
        throw error;
      }
    } else {
      console.log('✅ SUCCESS! family_coordinator role created!');
      console.log('   Role details:', data);
    }

    // Step 3: Verify final state
    console.log('\n📋 Final roles in database:');
    const { data: finalRoles } = await supabase
      .from('roles')
      .select('type, name, priority')
      .order('priority', { ascending: false });
    
    console.table(finalRoles);
    
    const hasFamilyCoordinator = finalRoles?.some(r => r.type === 'family_coordinator');
    if (hasFamilyCoordinator) {
      console.log('\n✅ SUCCESS: family_coordinator role is now in the database!');
      console.log('🎉 Family creation should now work properly!');
    } else {
      console.log('\n⚠️  family_coordinator role still missing - please run the SQL above');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the fix
emergencyFix();