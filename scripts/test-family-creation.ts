#!/usr/bin/env npx tsx
/**
 * Test script to verify family creation logging
 * Run with: npx tsx scripts/test-family-creation.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nhfwemygprcilprwxtfp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyNzY1NCwiZXhwIjoyMDY5ODAzNjU0fQ.fGllakrVheUaRNP6UDExG_0juJD9w3eh_3pEKiOVZr0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFamilyCreation() {
  console.log('🧪 Testing family creation flow...\n');

  try {
    // 1. Check roles table
    console.log('1️⃣ Checking roles table...');
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, type, name, priority')
      .order('priority', { ascending: false });

    if (rolesError) {
      console.error('❌ Error fetching roles:', rolesError);
      return;
    }

    console.log('✅ Available roles:');
    roles?.forEach(role => {
      console.log(`   - ${role.type}: ${role.name} (priority: ${role.priority})`);
    });

    // Check for family_coordinator role
    const coordinatorRole = roles?.find(r => r.type === 'family_coordinator');
    if (!coordinatorRole) {
      console.error('❌ Missing family_coordinator role!');
      return;
    }
    console.log('✅ family_coordinator role exists:', coordinatorRole.id);

    // 2. Check subscription tiers
    console.log('\n2️⃣ Checking subscription tiers...');
    const { data: tiers, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('id, name, display_name, max_family_members')
      .order('sort_order');

    if (tiersError) {
      console.error('❌ Error fetching subscription tiers:', tiersError);
      return;
    }

    console.log('✅ Available subscription tiers:');
    tiers?.forEach(tier => {
      console.log(`   - ${tier.name}: ${tier.display_name} (max members: ${tier.max_family_members})`);
    });

    const freeTier = tiers?.find(t => t.name === 'free');
    if (!freeTier) {
      console.error('❌ Missing free subscription tier!');
      return;
    }
    console.log('✅ Free tier exists:', freeTier.id);

    // 3. Check families table structure
    console.log('\n3️⃣ Checking families table structure...');
    const { data: familyTest, error: familyError } = await supabase
      .from('families')
      .select('id, name, description, created_by, subscription_tier_id, status')
      .limit(1);

    if (familyError) {
      console.error('❌ Error accessing families table:', familyError);
      return;
    }
    console.log('✅ Families table accessible');

    // 4. Check family_memberships table structure
    console.log('\n4️⃣ Checking family_memberships table structure...');
    const { data: membershipTest, error: membershipError } = await supabase
      .from('family_memberships')
      .select('id, family_id, user_id, role_id, status')
      .limit(1);

    if (membershipError) {
      console.error('❌ Error accessing family_memberships table:', membershipError);
      return;
    }
    console.log('✅ Family_memberships table accessible');

    // 5. Test user lookup
    console.log('\n5️⃣ Checking for test users...');
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 5 });
    
    if (users && users.length > 0) {
      console.log(`✅ Found ${users.length} users in the system`);
      users.forEach(user => {
        console.log(`   - ${user.email} (${user.id})`);
      });
    } else {
      console.log('⚠️ No users found in the system');
    }

    // 6. Check for existing families
    console.log('\n6️⃣ Checking for existing families...');
    const { data: families, error: familiesError } = await supabase
      .from('families')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (familiesError) {
      console.error('❌ Error fetching families:', familiesError);
    } else if (families && families.length > 0) {
      console.log(`✅ Found ${families.length} existing families:`);
      families.forEach(family => {
        console.log(`   - ${family.name} (${family.id})`);
      });
    } else {
      console.log('ℹ️ No families exist yet');
    }

    console.log('\n🎉 DIAGNOSTIC COMPLETE!');
    console.log('\n📋 Summary:');
    console.log(`   ✅ Database connection: Working`);
    console.log(`   ${coordinatorRole ? '✅' : '❌'} family_coordinator role: ${coordinatorRole ? 'Present' : 'Missing'}`);
    console.log(`   ${freeTier ? '✅' : '❌'} Free subscription tier: ${freeTier ? 'Present' : 'Missing'}`);
    console.log(`   ✅ Tables accessible: families, family_memberships`);
    console.log(`   ${users && users.length > 0 ? '✅' : '⚠️'} Users in system: ${users?.length || 0}`);
    
    console.log('\n💡 Next steps:');
    console.log('   1. Try creating a family through the UI');
    console.log('   2. Check browser console for detailed logs');
    console.log('   3. Look for errors in the server logs');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFamilyCreation().then(() => {
  process.exit(0);
});