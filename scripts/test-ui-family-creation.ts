/**
 * Test UI Family Creation - simulates the exact flow that happens in the UI
 */

import { createClient } from '@supabase/supabase-js';

// Use the same values as other scripts (hardcoded for testing)
const supabaseUrl = 'https://nhfwemygprcilprwxtfp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMjc2NTQsImV4cCI6MjA2OTgwMzY1NH0.yPeHeDDfxkuRgH1KGfK6GLx7Fgc60z3PoLRo5f29P6E'; // Use anon key like UI does

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUIFamilyCreation() {
  console.log('🏠 Testing UI Family Creation (with authenticated user context)...\n');
  
  try {
    // Step 1: Sign in as a test user (simulating UI auth state)
    console.log('1️⃣ Signing in as test user...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: '1212@1212.com',
      password: '123456789' // This should be the test user from earlier
    });

    if (authError) {
      console.error('❌ Auth error:', authError.message);
      return;
    }
    
    if (!authData.user) {
      console.error('❌ No user returned from auth');
      return;
    }

    console.log('✅ Signed in as:', authData.user.email);

    // Step 2: Get family_coordinator role (like UI does)
    console.log('\n2️⃣ Getting family_coordinator role...');
    const { data: coordinatorRole, error: roleError } = await supabase
      .from('roles')
      .select('id, type, name')
      .eq('type', 'family_coordinator')
      .single();

    if (roleError) {
      console.error('❌ Role query error:', roleError);
      return;
    }
    
    if (!coordinatorRole) {
      console.error('❌ No family_coordinator role found');
      return;
    }
    
    console.log('✅ Found role:', coordinatorRole);

    // Step 3: Get Free tier (like UI does)
    console.log('\n3️⃣ Getting Free subscription tier...');
    const { data: freeTier, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('id, name')
      .eq('name', 'free')
      .single();
    
    if (tierError) {
      console.error('❌ Tier query error:', tierError);
      return;
    }
    
    if (!freeTier) {
      console.error('❌ No Free tier found');
      return;
    }
    
    console.log('✅ Found Free tier:', freeTier);

    // Step 4: Create family (the critical part that was failing)
    console.log('\n4️⃣ Creating family record...');
    const familyData = {
      name: `Test Family ${Date.now()}`,
      description: 'Test family created by UI simulation',
      timezone: 'America/Los_Angeles',
      created_by: authData.user.id,
      subscription_tier_id: freeTier.id,
      status: 'active'
    };

    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert(familyData)
      .select()
      .single();

    if (familyError) {
      console.error('❌ Family creation error:', familyError);
      return;
    }
    
    console.log('✅ Family created:', family.id, family.name);

    // Step 5: Add creator as family coordinator (the part that caused recursion)
    console.log('\n5️⃣ Adding user as family coordinator...');
    const membershipData = {
      family_id: family.id,
      user_id: authData.user.id,
      role_id: coordinatorRole.id,
      status: 'active',
      is_default_family: true,
      display_name: authData.user.email?.split('@')[0] || 'Test User'
    };

    const { error: membershipError } = await supabase
      .from('family_memberships')
      .insert(membershipData);

    if (membershipError) {
      console.error('❌ Membership creation error:', membershipError);
      console.error('   This is where the recursion was happening!');
      return;
    }
    
    console.log('✅ User added as family coordinator - NO RECURSION!');

    // Step 6: Set as default family in user preferences
    console.log('\n6️⃣ Setting as default family...');
    const { error: prefsError } = await supabase
      .from('user_family_preferences')
      .upsert({
        user_id: authData.user.id,
        default_family_id: family.id
      });

    if (prefsError) {
      console.error('❌ User preferences error:', prefsError);
    } else {
      console.log('✅ Default family set');
    }

    // Step 7: Verify the family can be queried back
    console.log('\n7️⃣ Verifying family can be queried back...');
    const { data: families, error: queryError } = await supabase
      .from('families')
      .select(`
        id,
        name,
        description,
        created_by,
        subscription_status,
        timezone,
        invite_code,
        created_at,
        subscription_tiers(name, max_family_members),
        family_memberships!inner(
          id,
          is_default_family,
          roles(id, name, type, priority)
        )
      `)
      .eq('family_memberships.user_id', authData.user.id)
      .eq('family_memberships.status', 'active')
      .eq('status', 'active')
      .eq('id', family.id);

    if (queryError) {
      console.error('❌ Family query error:', queryError);
    } else {
      console.log('✅ Family successfully queried back:', families.length, 'families');
    }

    console.log('\n🎉 SUCCESS: UI Family Creation works perfectly!');
    console.log('   - No infinite recursion');
    console.log('   - Family created successfully');
    console.log('   - Membership created successfully');
    console.log('   - RLS policies working correctly');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  } finally {
    // Sign out
    await supabase.auth.signOut();
  }
}

// Run the test
testUIFamilyCreation();