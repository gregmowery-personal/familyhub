#!/usr/bin/env npx tsx
/**
 * Test full family creation flow after recursion fixes
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nhfwemygprcilprwxtfp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyNzY1NCwiZXhwIjoyMDY5ODAzNjU0fQ.fGllakrVheUaRNP6UDExG_0juJD9w3eh_3pEKiOVZr0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFamilyCreation() {
  console.log('🧪 Testing full family creation flow...\n');

  try {
    // Get a test user
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1 });
    
    if (!users || users.length === 0) {
      console.error('❌ No users found in system');
      return false;
    }

    const testUser = users[0];
    console.log(`👤 Using test user: ${testUser.email} (${testUser.id})\n`);

    // 1. Get family_coordinator role
    console.log('1️⃣ Looking for family_coordinator role...');
    const { data: coordinatorRole, error: roleError } = await supabase
      .from('roles')
      .select('id, type, name')
      .eq('type', 'family_coordinator')
      .single();

    if (roleError) {
      console.error('❌ Role query error:', roleError);
      return false;
    }
    console.log('✅ Found role:', coordinatorRole);

    // 2. Get Free tier
    console.log('\n2️⃣ Looking for Free subscription tier...');
    const { data: freeTier, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('id, name')
      .eq('name', 'free')
      .single();
    
    if (tierError) {
      console.error('❌ Tier query error:', tierError);
      return false;
    }
    console.log('✅ Found Free tier:', freeTier.id);

    // 3. Create family
    console.log('\n3️⃣ Creating family record...');
    const familyData = {
      name: `Test Family ${Date.now()}`,
      description: 'Created by test script',
      timezone: 'America/New_York',
      created_by: testUser.id,
      subscription_tier_id: freeTier.id,
      status: 'active'
    };
    console.log('   Family data:', familyData);

    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert(familyData)
      .select()
      .single();

    if (familyError) {
      console.error('❌ Family creation error:', familyError);
      return false;
    }
    console.log('✅ Family created:', family.id, family.name);

    // 4. Add creator as family coordinator
    console.log('\n4️⃣ Adding user as family coordinator...');
    const membershipData = {
      family_id: family.id,
      user_id: testUser.id,
      role_id: coordinatorRole.id,
      status: 'active',
      is_default_family: true,
      display_name: testUser.email?.split('@')[0]
    };
    console.log('   Membership data:', membershipData);

    const { error: membershipError } = await supabase
      .from('family_memberships')
      .insert(membershipData);

    if (membershipError) {
      console.error('❌ Membership creation error:', membershipError);
      
      // Clean up the family if membership fails
      await supabase.from('families').delete().eq('id', family.id);
      console.log('   Cleaned up family record');
      return false;
    }
    console.log('✅ User added as family coordinator');

    // 5. Verify the family was created
    console.log('\n5️⃣ Verifying family creation...');
    const { data: verifyFamily, error: verifyError } = await supabase
      .from('families')
      .select(`
        id,
        name,
        description,
        family_memberships!inner(
          user_id,
          roles(name, type)
        )
      `)
      .eq('id', family.id)
      .single();

    if (verifyError) {
      console.error('❌ Verification error:', verifyError);
      return false;
    }

    console.log('✅ Family verified:', {
      id: verifyFamily.id,
      name: verifyFamily.name,
      members: verifyFamily.family_memberships?.length || 0
    });

    console.log('\n🎉 SUCCESS! Full family creation flow works!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Role lookup: Working');
    console.log('   ✅ Tier lookup: Working');
    console.log('   ✅ Family creation: Working');
    console.log('   ✅ Membership creation: Working');
    console.log('   ✅ No recursion errors!');
    
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

testFamilyCreation().then(success => {
  process.exit(success ? 0 : 1);
});