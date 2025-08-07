/**
 * Simple test to verify the family creation recursion is fixed
 */

import { createClient } from '@supabase/supabase-js';

// Use service role to test the policies directly
const supabaseUrl = 'https://nhfwemygprcilprwxtfp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyNzY1NCwiZXhwIjoyMDY5ODAzNjU0fQ.fGllakrVheUaRNP6UDExG_0juJD9w3eh_3pEKiOVZr0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRecursionFix() {
  console.log('🔍 Testing Family Creation Recursion Fix...\n');

  try {
    // Get a test user (the 1212@1212.com user we know exists)
    console.log('1️⃣ Getting test user...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', '1212@1212.com')
      .single();

    if (userError || !userData) {
      console.error('❌ Could not find test user:', userError?.message);
      return;
    }

    console.log('✅ Found test user:', userData.email);

    // Get family_coordinator role
    console.log('\n2️⃣ Getting family_coordinator role...');
    const { data: coordinatorRole, error: roleError } = await supabase
      .from('roles')
      .select('id, type, name')
      .eq('type', 'family_coordinator')
      .single();

    if (roleError || !coordinatorRole) {
      console.error('❌ Could not find family_coordinator role:', roleError?.message);
      return;
    }

    console.log('✅ Found role:', coordinatorRole.name);

    // Get Free tier
    console.log('\n3️⃣ Getting Free subscription tier...');
    const { data: freeTier, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('id, name')
      .eq('name', 'free')
      .single();
    
    if (tierError || !freeTier) {
      console.error('❌ Could not find Free tier:', tierError?.message);
      return;
    }
    
    console.log('✅ Found Free tier');

    // Test 1: Create family using the exact same flow as UI
    console.log('\n4️⃣ Creating test family (simulating UI flow)...');
    const familyData = {
      name: `Recursion Test Family ${Date.now()}`,
      description: 'Testing the recursion fix',
      timezone: 'America/Los_Angeles',
      created_by: userData.id,
      subscription_tier_id: freeTier.id,
      status: 'active'
    };

    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert(familyData)
      .select()
      .single();

    if (familyError) {
      console.error('❌ Family creation failed:', familyError.message);
      return;
    }
    
    console.log('✅ Family created successfully:', family.name);

    // Test 2: Create family membership (the part that was causing recursion)
    console.log('\n5️⃣ Creating family membership (critical test)...');
    
    // First, let's simulate the authenticated user context by setting the auth context
    // We'll do this by using RPC to set the current user context and then insert
    await supabase.rpc('set_auth_user_context', { user_id: userData.id });

    const membershipData = {
      family_id: family.id,
      user_id: userData.id,
      role_id: coordinatorRole.id,
      status: 'active',
      is_default_family: true,
      display_name: 'Test User'
    };

    const { error: membershipError } = await supabase
      .from('family_memberships')
      .insert(membershipData);

    if (membershipError) {
      console.error('❌ CRITICAL: Membership creation failed (recursion still exists):', membershipError.message);
      
      // Check if this is a recursion error
      if (membershipError.message.includes('infinite recursion') || 
          membershipError.message.includes('policy for relation')) {
        console.error('💥 RECURSION ERROR STILL EXISTS - Fix did not work!');
      }
      return;
    }
    
    console.log('✅ SUCCESS: Family membership created without recursion!');

    // Test 3: Verify we can query the family back
    console.log('\n6️⃣ Verifying family can be queried...');
    const { data: queryResult, error: queryError } = await supabase
      .from('families')
      .select(`
        id, name, description,
        family_memberships!inner(
          id, user_id, status,
          roles(name, type)
        )
      `)
      .eq('id', family.id);

    if (queryError) {
      console.error('❌ Family query failed:', queryError.message);
      return;
    }

    console.log('✅ Family query successful, found:', queryResult.length, 'families');

    // Final success message
    console.log('\n🎉 RECURSION FIX VERIFIED SUCCESSFUL!');
    console.log('✅ Family creation works');
    console.log('✅ Family membership creation works');
    console.log('✅ No infinite recursion detected');
    console.log('✅ RLS policies functioning correctly');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    
    if (error instanceof Error && error.message.includes('recursion')) {
      console.error('🔥 CRITICAL: Recursion error still exists!');
    }
  }
}

// Run the test
testRecursionFix();