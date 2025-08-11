/**
 * Script to properly setup roles in the database
 * Run with: npx tsx scripts/setup-roles.ts
 * 
 * This ensures we have both:
 * - admin: System administrator for the website
 * - family_coordinator: Manager of a specific family
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nhfwemygprcilprwxtfp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyNzY1NCwiZXhwIjoyMDY5ODAzNjU0fQ.fGllakrVheUaRNP6UDExG_0juJD9w3eh_3pEKiOVZr0';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupRoles() {
  console.log('🔧 Setting up roles in database...\n');

  try {
    // First check what roles currently exist
    console.log('📋 Checking existing roles...');
    const { data: existingRoles, error: checkError } = await supabase
      .from('roles')
      .select('type, name, priority')
      .order('priority', { ascending: false });

    if (checkError) {
      console.error('Error checking roles:', checkError);
    } else {
      console.log('Current roles:', existingRoles?.map(r => r.type).join(', ') || 'none');
    }

    // Check if we have admin role
    const { data: adminRole } = await supabase
      .from('roles')
      .select('*')
      .eq('type', 'admin')
      .single();

    if (!adminRole) {
      console.log('\n➕ Creating admin role (system administrator)...');
      const { error: adminError } = await supabase
        .from('roles')
        .insert({
          type: 'admin',
          name: 'System Administrator',
          description: 'Full system access with all permissions for the entire website',
          priority: 1000,
          is_system: true
        });

      if (adminError) {
        console.error('❌ Failed to create admin role:', adminError.message);
        console.log('   This might be due to database constraints.');
      } else {
        console.log('✅ Created admin role');
      }
    } else {
      console.log('✅ Admin role exists');
    }

    // Check if we have family_coordinator role
    const { data: coordinatorRole } = await supabase
      .from('roles')
      .select('*')
      .eq('type', 'family_coordinator')
      .single();

    if (!coordinatorRole) {
      console.log('\n➕ Creating family_coordinator role...');
      
      // Since the constraint might not allow family_coordinator yet,
      // we'll document this as a required manual step
      const { error: coordError } = await supabase
        .from('roles')
        .insert({
          type: 'family_coordinator',
          name: 'Family Coordinator',
          description: 'Primary coordinator for a specific family with management permissions within that family',
          priority: 100,
          is_system: true
        });

      if (coordError) {
        if (coordError.code === '23514') {
          console.error('\n❌ Cannot create family_coordinator role due to database constraint.');
          console.log('\n📝 MANUAL ACTION REQUIRED:');
          console.log('   The database check constraint needs to be updated to allow "family_coordinator".');
          console.log('\n   Please run this SQL in your Supabase SQL editor:');
          console.log('   ----------------------------------------');
          console.log(`
-- Drop the existing constraint
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_type_check;

-- Add updated constraint that includes family_coordinator
ALTER TABLE roles ADD CONSTRAINT roles_type_check 
CHECK (type IN (
  'system_admin',
  'admin',
  'family_coordinator',
  'caregiver',
  'care_recipient',
  'helper',
  'emergency_contact',
  'child',
  'viewer',
  'bot_agent'
));

-- Then create the family_coordinator role
INSERT INTO roles (type, name, description, priority, is_system)
VALUES (
  'family_coordinator',
  'Family Coordinator',
  'Primary coordinator for a specific family',
  100,
  true
);
          `);
          console.log('   ----------------------------------------');
          console.log('\n   After running this SQL, the family creation should work.');
        } else {
          console.error('❌ Failed to create family_coordinator role:', coordError.message);
        }
      } else {
        console.log('✅ Created family_coordinator role');
      }
    } else {
      console.log('✅ Family coordinator role exists');
    }

    // Create other standard roles
    const standardRoles = [
      { type: 'caregiver', name: 'Caregiver', description: 'Primary caregiver with significant management capabilities', priority: 90 },
      { type: 'care_recipient', name: 'Care Recipient', description: 'Person receiving care with appropriate access', priority: 70 },
      { type: 'helper', name: 'Helper', description: 'Trusted family member or friend assisting with coordination', priority: 60 },
      { type: 'emergency_contact', name: 'Emergency Contact', description: 'Emergency contact with limited access', priority: 50 },
      { type: 'child', name: 'Child', description: 'Minor family member with age-appropriate restricted access', priority: 40 },
      { type: 'viewer', name: 'Viewer', description: 'Read-only access to shared family information', priority: 30 }
    ];

    console.log('\n📝 Ensuring other standard roles exist...');
    for (const role of standardRoles) {
      const { data: existing } = await supabase
        .from('roles')
        .select('id')
        .eq('type', role.type)
        .single();

      if (!existing) {
        const { error: insertError } = await supabase
          .from('roles')
          .insert({
            ...role,
            is_system: true
          });

        if (insertError) {
          console.error(`❌ Failed to create ${role.type}:`, insertError.message);
        } else {
          console.log(`✅ Created ${role.type} role`);
        }
      }
    }

    // Final check - list all roles
    console.log('\n📋 Final role check:');
    const { data: allRoles } = await supabase
      .from('roles')
      .select('type, name, priority')
      .order('priority', { ascending: false });

    if (allRoles) {
      console.table(allRoles);
      
      // Check if family_coordinator is missing
      const hasFamilyCoordinator = allRoles.some(r => r.type === 'family_coordinator');
      if (!hasFamilyCoordinator) {
        console.log('\n⚠️  WARNING: family_coordinator role is still missing!');
        console.log('   Please follow the manual SQL instructions above.');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

setupRoles();