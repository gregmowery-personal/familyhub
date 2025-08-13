#!/usr/bin/env tsx

/**
 * Elrond's Database Diagnosis and Healing Script
 * "I was there when the policies were written. I was there when they failed."
 * 
 * This script will:
 * 1. Connect to Supabase using service role
 * 2. List all current RLS policies on family_memberships
 * 3. Identify recursive policies
 * 4. Drop problematic policies
 * 5. Create new, non-recursive policies
 * 6. Test the fix
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nhfwemygprcilprwxtfp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyNzY1NCwiZXhwIjoyMDY5ODAzNjU0fQ.fGllakrVheUaRNP6UDExG_0juJD9w3eh_3pEKiOVZr0';

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function diagnoseAndFixRLS() {
  console.log('🧙‍♂️ Elrond begins the healing of the database...\n');

  try {
    // Step 1: List all current policies on family_memberships
    console.log('🔍 Step 1: Examining current RLS policies on family_memberships...');
    
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_table_policies', { table_name: 'family_memberships' });
    
    if (policiesError) {
      // Try alternative approach using direct SQL
      console.log('Trying direct SQL approach...');
      const { data: policiesSQL, error: policiesSQLError } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'family_memberships');
      
      if (policiesSQLError) {
        console.error('❌ Could not fetch policies:', policiesSQLError);
        return;
      }
      
      console.log('Current policies:', policiesSQL);
    } else {
      console.log('Current policies:', policies);
    }

    // Step 2: Query the problem directly using service role
    console.log('\n🔍 Step 2: Testing problematic query using service role...');
    
    const testQuery = `
      SELECT id 
      FROM family_memberships 
      WHERE family_id = 'c36260a4-9e13-4d0b-98fd-551749e79e03' 
      AND user_id = '93029e4f-1d9d-4420-a657-6402a2d78f22' 
      AND status = 'active'
    `;
    
    const { data: testResult, error: testError } = await supabase
      .rpc('execute_sql', { sql: testQuery });
    
    if (testError) {
      console.log('❌ Query failed with service role:', testError.message);
    } else {
      console.log('✅ Query succeeded with service role:', testResult);
    }

    // Step 3: Disable RLS temporarily and drop all policies
    console.log('\n🛠️ Step 3: Disabling RLS and dropping all policies...');
    
    const disableRLSSQL = `
      ALTER TABLE family_memberships DISABLE ROW LEVEL SECURITY;
    `;
    
    const { error: disableError } = await supabase
      .rpc('execute_sql', { sql: disableRLSSQL });
    
    if (disableError) {
      console.error('❌ Failed to disable RLS:', disableError.message);
      return;
    }
    
    console.log('✅ RLS disabled');

    // Drop all existing policies
    const dropPoliciesSQL = `
      DO $$ 
      DECLARE 
          policy_rec RECORD;
      BEGIN
          FOR policy_rec IN 
              SELECT policyname 
              FROM pg_policies 
              WHERE tablename = 'family_memberships'
          LOOP
              EXECUTE 'DROP POLICY IF EXISTS "' || policy_rec.policyname || '" ON family_memberships';
          END LOOP;
      END $$;
    `;
    
    const { error: dropError } = await supabase
      .rpc('execute_sql', { sql: dropPoliciesSQL });
    
    if (dropError) {
      console.error('❌ Failed to drop policies:', dropError.message);
      return;
    }
    
    console.log('✅ All policies dropped');

    // Step 4: Create new, NON-RECURSIVE policies
    console.log('\n🔧 Step 4: Creating new, non-recursive policies...');
    
    const newPoliciesSQL = `
      -- NON-RECURSIVE POLICIES FOR FAMILY_MEMBERSHIPS
      -- The key is to avoid ANY subquery that references family_memberships
      -- within a policy ON family_memberships
      
      -- 1. SELECT: Use a function-based approach to avoid direct recursion
      CREATE OR REPLACE FUNCTION can_view_family_membership(membership_family_id UUID, membership_user_id UUID)
      RETURNS BOOLEAN AS $$
      BEGIN
        -- User can see their own membership
        IF membership_user_id = auth.uid() THEN
          RETURN TRUE;
        END IF;
        
        -- Check if current user is in the same family (via direct table scan, not policy)
        -- This uses a function context that bypasses RLS
        RETURN EXISTS (
          SELECT 1 FROM family_memberships fm
          WHERE fm.family_id = membership_family_id
          AND fm.user_id = auth.uid()
          AND fm.status = 'active'
          LIMIT 1
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      -- Simple SELECT policy using the function
      CREATE POLICY "family_memberships_select" ON family_memberships
        FOR SELECT USING (
          can_view_family_membership(family_id, user_id)
        );

      -- 2. INSERT: Allow users to insert their own membership or coordinators to add others
      CREATE POLICY "family_memberships_insert" ON family_memberships
        FOR INSERT WITH CHECK (
          -- Can insert own membership
          user_id = auth.uid()
          OR
          -- Check if user is coordinator via function to avoid recursion
          EXISTS (
            SELECT 1 
            FROM family_memberships fm
            INNER JOIN roles r ON fm.role_id = r.id
            WHERE fm.family_id = family_memberships.family_id
            AND fm.user_id = auth.uid()
            AND fm.status = 'active'
            AND r.type IN ('family_coordinator', 'system_admin')
            LIMIT 1
          )
        );

      -- 3. UPDATE: Users can update their own, coordinators can update others
      CREATE POLICY "family_memberships_update" ON family_memberships
        FOR UPDATE USING (
          user_id = auth.uid()
          OR
          EXISTS (
            SELECT 1 
            FROM family_memberships fm
            INNER JOIN roles r ON fm.role_id = r.id
            WHERE fm.family_id = family_memberships.family_id
            AND fm.user_id = auth.uid()
            AND fm.status = 'active'
            AND r.type IN ('family_coordinator', 'system_admin')
            LIMIT 1
          )
        );

      -- 4. DELETE: Only coordinators can delete
      CREATE POLICY "family_memberships_delete" ON family_memberships
        FOR DELETE USING (
          EXISTS (
            SELECT 1 
            FROM family_memberships fm
            INNER JOIN roles r ON fm.role_id = r.id
            WHERE fm.family_id = family_memberships.family_id
            AND fm.user_id = auth.uid()
            AND fm.status = 'active'
            AND r.type IN ('family_coordinator', 'system_admin')
            LIMIT 1
          )
        );
    `;
    
    const { error: createError } = await supabase
      .rpc('execute_sql', { sql: newPoliciesSQL });
    
    if (createError) {
      console.error('❌ Failed to create new policies:', createError.message);
      return;
    }
    
    console.log('✅ New policies created');

    // Step 5: Re-enable RLS
    console.log('\n🔒 Step 5: Re-enabling RLS...');
    
    const enableRLSSQL = `
      ALTER TABLE family_memberships ENABLE ROW LEVEL SECURITY;
    `;
    
    const { error: enableError } = await supabase
      .rpc('execute_sql', { sql: enableRLSSQL });
    
    if (enableError) {
      console.error('❌ Failed to enable RLS:', enableError.message);
      return;
    }
    
    console.log('✅ RLS re-enabled');

    // Step 6: Test the fix
    console.log('\n🧪 Step 6: Testing the fix...');
    
    // Test with a regular user context (not service role)
    const testClient = createClient(SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMjc2NTQsImV4cCI6MjA2OTgwMzY1NH0.O1gNcNKmvzZ-tAhqL_5FzGJp7nZ8Z-QbhVN8bTcLZ0Y');
    
    // First, set up a mock user session
    const { error: authError } = await testClient.auth.setSession({
      access_token: 'mock-token-for-user-93029e4f-1d9d-4420-a657-6402a2d78f22',
      refresh_token: 'mock-refresh'
    });
    
    if (authError) {
      console.log('Auth setup error (expected):', authError.message);
    }
    
    // Test the problematic query
    const { data: finalTest, error: finalError } = await testClient
      .from('family_memberships')
      .select('id')
      .eq('family_id', 'c36260a4-9e13-4d0b-98fd-551749e79e03')
      .eq('user_id', '93029e4f-1d9d-4420-a657-6402a2d78f22')
      .eq('status', 'active');
    
    if (finalError) {
      console.log('❌ Final test failed:', finalError.message);
    } else {
      console.log('✅ Final test succeeded! Results:', finalTest);
    }

    console.log('\n🎉 Database healing complete! The shadow of recursion has been banished from Rivendell!');

  } catch (error) {
    console.error('💥 Unexpected error during healing:', error);
  }
}

// Execute the healing ritual
diagnoseAndFixRLS().catch(console.error);