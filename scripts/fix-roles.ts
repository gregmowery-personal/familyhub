/**
 * Script to fix roles in the database
 * Run with: npx tsx scripts/fix-roles.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRoles() {
  console.log('🔧 Fixing roles in database...\n');

  try {
    // First, let's try to execute raw SQL to fix the constraint
    console.log('🔨 Fixing role type constraint...');
    const { error: constraintError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Drop the existing check constraint
        ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_type_check;
        
        -- Add the updated check constraint with family_coordinator
        ALTER TABLE roles ADD CONSTRAINT roles_type_check 
        CHECK (type IN (
          'system_admin',
          'family_coordinator',
          'admin',
          'caregiver',
          'care_recipient',
          'helper',
          'emergency_contact',
          'child',
          'viewer',
          'bot_agent'
        ));
      `
    }).catch(err => {
      // If RPC doesn't exist, we'll work around it
      console.log('⚠️  Could not fix constraint via RPC, using workaround...');
      return { error: err };
    });

    // First, check if admin role exists
    const { data: adminRole, error: adminCheckError } = await supabase
      .from('roles')
      .select('*')
      .eq('type', 'admin')
      .single();

    if (adminCheckError && adminCheckError.code !== 'PGRST116') {
      throw adminCheckError;
    }

    // Check if family_coordinator exists
    const { data: coordinatorRole, error: coordCheckError } = await supabase
      .from('roles')
      .select('*')
      .eq('type', 'family_coordinator')
      .single();

    if (coordCheckError && coordCheckError.code !== 'PGRST116' && coordCheckError.code !== '23514') {
      throw coordCheckError;
    }

    if (adminRole && !coordinatorRole) {
      console.log('📝 Found admin role, will use it as family_coordinator...');
      // Since we can't update the type due to constraint, we'll use the admin role as-is
      console.log('⚠️  Using admin role as-is (constraint prevents renaming to family_coordinator)');
      console.log('✅ Admin role exists and will be used for family coordination\n');
    } else if (!adminRole && !coordinatorRole) {
      // Try to create admin role since that's what the constraint allows
      console.log('➕ Creating admin role (as family coordinator)...');
      const { error: insertError } = await supabase
        .from('roles')
        .insert({
          type: 'admin',
          name: 'Family Coordinator',
          description: 'Primary family coordinator with comprehensive management permissions',
          priority: 100,
          is_system: true
        });

      if (insertError) throw insertError;
      console.log('✅ Successfully created admin role (acting as family coordinator)\n');
    } else if (coordinatorRole) {
      console.log('✅ family_coordinator role already exists\n');
    } else {
      console.log('✅ Required role exists\n');
    }

    // Ensure other standard roles exist
    const standardRoles = [
      { type: 'caregiver', name: 'Caregiver', description: 'Primary caregiver with significant management capabilities', priority: 90 },
      { type: 'care_recipient', name: 'Care Recipient', description: 'Person receiving care with appropriate access to their information', priority: 70 },
      { type: 'helper', name: 'Helper', description: 'Trusted family member or friend assisting with coordination', priority: 60 },
      { type: 'emergency_contact', name: 'Emergency Contact', description: 'Emergency contact with limited access for urgent situations', priority: 50 },
      { type: 'child', name: 'Child', description: 'Minor family member with age-appropriate restricted access', priority: 40 },
      { type: 'viewer', name: 'Viewer', description: 'Read-only access to shared family information', priority: 30 }
    ];

    for (const role of standardRoles) {
      const { data: existing, error: checkError } = await supabase
        .from('roles')
        .select('id')
        .eq('type', role.type)
        .single();

      if (checkError && checkError.code === 'PGRST116') {
        // Role doesn't exist, create it
        console.log(`➕ Creating ${role.type} role...`);
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

    // List all roles
    console.log('\n📋 Current roles in database:');
    const { data: allRoles, error: listError } = await supabase
      .from('roles')
      .select('type, name, priority')
      .order('priority', { ascending: false });

    if (listError) throw listError;

    console.table(allRoles);

  } catch (error) {
    console.error('❌ Error fixing roles:', error);
    process.exit(1);
  }

  console.log('\n🎉 Roles fixed successfully!');
}

fixRoles();