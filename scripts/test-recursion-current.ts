#!/usr/bin/env tsx

/**
 * Test the current state of the RLS recursion issue
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nhfwemygprcilprwxtfp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyNzY1NCwiZXhwIjoyMDY5ODAzNjU0fQ.fGllakrVheUaRNP6UDExG_0juJD9w3eh_3pEKiOVZr0';

// Test with service role (bypasses RLS)
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Test with anon role (subject to RLS)
const anonClient = createClient(SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMjc2NTQsImV4cCI6MjA2OTgwMzY1NH0.O1gNcNKmvzZ-tAhqL_5FzGJp7nZ8Z-QbhVN8bTcLZ0Y');

async function testRecursion() {
  console.log('🧙‍♂️ Testing current state of RLS policies...\n');

  const testQuery = {
    family_id: 'c36260a4-9e13-4d0b-98fd-551749e79e03',
    user_id: '93029e4f-1d9d-4420-a657-6402a2d78f22',
    status: 'active'
  };

  // Test 1: With service role (should always work)
  console.log('🔐 Test 1: Query with service role (bypasses RLS)...');
  try {
    const { data: serviceData, error: serviceError } = await serviceClient
      .from('family_memberships')
      .select('id, family_id, user_id, status')
      .eq('family_id', testQuery.family_id)
      .eq('user_id', testQuery.user_id)
      .eq('status', testQuery.status);

    if (serviceError) {
      console.log('❌ Service role query failed:', serviceError.message);
    } else {
      console.log('✅ Service role query succeeded:', serviceData?.length, 'records found');
    }
  } catch (error) {
    console.log('💥 Service role query threw exception:', error);
  }

  // Test 2: With anon role (subject to RLS - this might fail with recursion)
  console.log('\n🔓 Test 2: Query with anon role (subject to RLS)...');
  try {
    const { data: anonData, error: anonError } = await anonClient
      .from('family_memberships')
      .select('id, family_id, user_id, status')
      .eq('family_id', testQuery.family_id)
      .eq('user_id', testQuery.user_id)
      .eq('status', testQuery.status);

    if (anonError) {
      if (anonError.message.includes('infinite recursion')) {
        console.log('❌ INFINITE RECURSION DETECTED:', anonError.message);
        console.log('   → The RLS policies are still causing recursion!');
        return false;
      } else {
        console.log('❌ Anon query failed (not recursion):', anonError.message);
      }
    } else {
      console.log('✅ Anon query succeeded:', anonData?.length, 'records found');
      console.log('   → No recursion detected!');
    }
  } catch (error) {
    console.log('💥 Anon query threw exception:', error);
  }

  // Test 3: Simulate authenticated user query
  console.log('\n🔑 Test 3: Simulating authenticated user query...');
  try {
    // Set a mock session for the target user
    await anonClient.auth.setSession({
      access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxOTY4NjQwODAwLCJpYXQiOjE2NTMwNDA4MDAsImlzcyI6Imh0dHBzOi8vbmhmd2VteWdwcmNpbHByd3h0ZnAuc3VwYWJhc2UuY28vYXV0aC92MSIsInN1YiI6IjkzMDI5ZTRmLTFkOWQtNDQyMC1hNjU3LTY0MDJhMmQ3OGYyMiIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnt9LCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.mock-signature',
      refresh_token: 'mock-refresh-token'
    });

    const { data: authData, error: authError } = await anonClient
      .from('family_memberships')
      .select('id, family_id, user_id, status')
      .eq('family_id', testQuery.family_id)
      .eq('user_id', testQuery.user_id)
      .eq('status', testQuery.status);

    if (authError) {
      if (authError.message.includes('infinite recursion')) {
        console.log('❌ INFINITE RECURSION DETECTED with auth user:', authError.message);
        return false;
      } else {
        console.log('❌ Auth user query failed (not recursion):', authError.message);
      }
    } else {
      console.log('✅ Auth user query succeeded:', authData?.length, 'records found');
    }
  } catch (error) {
    console.log('💥 Auth user query threw exception:', error);
  }

  console.log('\n📊 Summary:');
  console.log('   Service role queries work (as expected)');
  console.log('   If anon/auth queries also work, the recursion issue is resolved');
  console.log('   If they fail with "infinite recursion", we need to apply the fix');

  return true;
}

testRecursion().catch(console.error);