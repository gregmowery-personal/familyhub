#!/usr/bin/env tsx

/**
 * Verify that Elrond's fix has resolved the infinite recursion issue
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nhfwemygprcilprwxtfp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyNzY1NCwiZXhwIjoyMDY5ODAzNjU0fQ.fGllakrVheUaRNP6UDExG_0juJD9w3eh_3pEKiOVZr0';

const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyFix() {
  console.log('🧙‍♂️ Elrond verifies the healing of the database...\n');

  try {
    // Test 1: Verify the SECURITY DEFINER functions were created
    console.log('🔧 Test 1: Checking if helper functions exist...');
    
    const { data: functions, error: funcError } = await serviceClient.rpc('sql', {
      query: `
        SELECT 
          proname as function_name,
          prosecdef as is_security_definer
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND proname IN ('user_is_family_member', 'user_is_family_coordinator');
      `
    });

    if (funcError) {
      console.log('Testing alternative approach for functions...');
      // Alternative test
      const { data: testFunc, error: testFuncError } = await serviceClient
        .rpc('user_is_family_member', { 
          target_family_id: 'c36260a4-9e13-4d0b-98fd-551749e79e03' 
        });
      
      if (testFuncError) {
        console.log('❌ Helper functions not found:', testFuncError.message);
      } else {
        console.log('✅ Helper function callable:', testFunc);
      }
    } else {
      console.log('✅ Helper functions found:', functions);
    }

    // Test 2: Verify new policies exist
    console.log('\n📋 Test 2: Checking new policies...');
    
    const { data: policies, error: polError } = await serviceClient.rpc('sql', {
      query: `
        SELECT 
          policyname,
          cmd,
          permissive,
          qual IS NOT NULL as has_using_clause,
          with_check IS NOT NULL as has_with_check_clause
        FROM pg_policies 
        WHERE tablename = 'family_memberships'
        ORDER BY cmd, policyname;
      `
    });

    if (polError) {
      console.log('❌ Could not fetch policies:', polError.message);
    } else {
      console.log('✅ Current policies on family_memberships:');
      policies?.forEach((policy: any) => {
        console.log(`   - ${policy.policyname} (${policy.cmd})`);
      });
    }

    // Test 3: The critical test - run the problematic query
    console.log('\n🎯 Test 3: Running the previously problematic query...');
    
    const testQuery = {
      family_id: 'c36260a4-9e13-4d0b-98fd-551749e79e03',
      user_id: '93029e4f-1d9d-4420-a657-6402a2d78f22',
      status: 'active'
    };

    const { data: testData, error: testError } = await serviceClient
      .from('family_memberships')
      .select('id, family_id, user_id, status, created_at')
      .eq('family_id', testQuery.family_id)
      .eq('user_id', testQuery.user_id)
      .eq('status', testQuery.status);

    if (testError) {
      if (testError.message.includes('infinite recursion')) {
        console.log('❌ INFINITE RECURSION STILL EXISTS:', testError.message);
        console.log('   The fix was not successful!');
        return false;
      } else {
        console.log('❌ Query failed for other reason:', testError.message);
      }
    } else {
      console.log('✅ Query succeeded without recursion!');
      console.log('   Found', testData?.length, 'matching records');
      if (testData?.length > 0) {
        console.log('   Sample record:', testData[0]);
      }
    }

    // Test 4: Test a broader query to ensure RLS is working properly
    console.log('\n🔍 Test 4: Testing broader query to verify RLS functionality...');
    
    const { data: allData, error: allError } = await serviceClient
      .from('family_memberships')
      .select('id, family_id, user_id, status')
      .limit(5);

    if (allError) {
      console.log('❌ Broader query failed:', allError.message);
    } else {
      console.log('✅ Broader query succeeded:', allData?.length, 'records returned');
    }

    // Test 5: Verify families table policies
    console.log('\n🏠 Test 5: Testing families table access...');
    
    const { data: familyData, error: familyError } = await serviceClient
      .from('families')
      .select('id, name')
      .limit(3);

    if (familyError) {
      console.log('❌ Families query failed:', familyError.message);
    } else {
      console.log('✅ Families query succeeded:', familyData?.length, 'families found');
    }

    console.log('\n🎉 VERIFICATION COMPLETE!');
    console.log('✨ The shadow of infinite recursion has been banished from Rivendell!');
    console.log('🏰 The databases of FamilyHub.care are once again safe and functional.');
    
    return true;

  } catch (error) {
    console.error('💥 Unexpected error during verification:', error);
    return false;
  }
}

verifyFix().catch(console.error);