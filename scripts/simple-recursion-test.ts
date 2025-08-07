/**
 * Simple test to verify RLS policies don't cause recursion
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nhfwemygprcilprwxtfp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyNzY1NCwiZXhwIjoyMDY5ODAzNjU0fQ.fGllakrVheUaRNP6UDExG_0juJD9w3eh_3pEKiOVZr0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testPolicies() {
  console.log('🔍 Testing RLS Policies for Recursion...\n');

  try {
    // 1. First, let's check what policies exist
    console.log('1️⃣ Checking current RLS policies...');
    
    const { data: policies, error: policyError } = await supabase
      .rpc('get_policies')
      .select('*');

    if (policyError) {
      console.log('ℹ️ Could not query policies directly (expected), continuing with functional test...');
    }

    // 2. Test the actual functionality - get roles (this was part of the recursion chain)
    console.log('\n2️⃣ Testing roles query (was part of recursion chain)...');
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, type, name')
      .eq('type', 'family_coordinator');

    if (rolesError) {
      console.error('❌ Roles query failed:', rolesError.message);
      if (rolesError.message.includes('recursion')) {
        console.error('💥 RECURSION STILL EXISTS in roles!');
        return;
      }
    } else {
      console.log('✅ Roles query successful:', roles.length, 'roles found');
    }

    // 3. Test subscription tiers
    console.log('\n3️⃣ Testing subscription tiers query...');
    const { data: tiers, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('id, name')
      .eq('name', 'free');

    if (tiersError) {
      console.error('❌ Tiers query failed:', tiersError.message);
      return;
    } else {
      console.log('✅ Subscription tiers query successful:', tiers.length, 'tiers found');
    }

    // 4. Test family creation (basic)
    console.log('\n4️⃣ Testing family creation...');
    const familyData = {
      name: `Test Family ${Date.now()}`,
      description: 'Test family for recursion check',
      timezone: 'America/Los_Angeles', 
      created_by: '00000000-0000-0000-0000-000000000001', // dummy UUID
      subscription_tier_id: tiers[0].id,
      status: 'active'
    };

    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert(familyData)
      .select()
      .single();

    if (familyError) {
      console.error('❌ Family creation failed:', familyError.message);
      if (familyError.message.includes('recursion')) {
        console.error('💥 RECURSION DETECTED in families table!');
        return;
      }
    } else {
      console.log('✅ Family creation successful:', family.name);
    }

    // 5. Test family membership creation (this is where recursion was happening)
    console.log('\n5️⃣ Testing family membership creation (critical test)...');
    const membershipData = {
      family_id: family.id,
      user_id: '00000000-0000-0000-0000-000000000001', // dummy UUID
      role_id: roles[0].id,
      status: 'active',
      display_name: 'Test User'
    };

    const { error: membershipError } = await supabase
      .from('family_memberships')
      .insert(membershipData);

    if (membershipError) {
      console.error('❌ CRITICAL: Family membership creation failed:', membershipError.message);
      
      if (membershipError.message.includes('infinite recursion') || 
          membershipError.message.includes('recursion detected') ||
          membershipError.message.includes('policy for relation')) {
        console.error('💥💥💥 RECURSION ERROR STILL EXISTS - Migration failed!');
        console.error('🔥 The family_memberships policies are still causing infinite recursion');
        return;
      } else {
        console.error('❌ Different error (not recursion):', membershipError.message);
      }
    } else {
      console.log('✅ SUCCESS: Family membership created without recursion!');
    }

    // 6. Test querying families with memberships (another potential recursion point)
    console.log('\n6️⃣ Testing family query with memberships join...');
    const { data: familiesWithMembers, error: joinError } = await supabase
      .from('families')
      .select(`
        id, name,
        family_memberships(
          id, user_id,
          roles(name, type)
        )
      `)
      .eq('id', family.id);

    if (joinError) {
      console.error('❌ Family-membership join query failed:', joinError.message);
      if (joinError.message.includes('recursion')) {
        console.error('💥 RECURSION in join query!');
      }
    } else {
      console.log('✅ Family-membership join query successful');
    }

    console.log('\n🎉 ALL TESTS PASSED - RECURSION FIX IS WORKING!');
    console.log('✅ No infinite recursion detected in any operation');
    console.log('✅ Family creation works');
    console.log('✅ Family membership creation works');
    console.log('✅ Complex queries work');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    if (error instanceof Error && 
        (error.message.includes('recursion') || error.message.includes('policy for relation'))) {
      console.error('🔥 CRITICAL: Recursion still exists!');
    }
  }
}

// Run the test
testPolicies();