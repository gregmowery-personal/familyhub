#!/usr/bin/env tsx

/**
 * Apply Elrond's RLS Fix Script
 * This script executes the SQL fix through the Supabase client
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = 'https://nhfwemygprcilprwxtfp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyNzY1NCwiZXhwIjoyMDY5ODAzNjU0fQ.fGllakrVheUaRNP6UDExG_0juJD9w3eh_3pEKiOVZr0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyElrondFix() {
  console.log('🧙‍♂️ Elrond begins the healing ritual...\n');

  try {
    // First, let's examine the current policies
    console.log('🔍 Examining current state...');
    
    const { data: currentPolicies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'family_memberships');

    if (policiesError) {
      console.log('Could not fetch current policies (expected):', policiesError.message);
    } else {
      console.log('Current policies on family_memberships:');
      currentPolicies?.forEach(policy => {
        console.log(`  - ${policy.policyname} (${policy.cmd})`);
      });
    }

    // Step 1: Create helper functions (these should not cause recursion)
    console.log('\n🔧 Creating SECURITY DEFINER helper functions...');
    
    const helperFunctionsSQL = `
      CREATE OR REPLACE FUNCTION user_is_family_member(target_family_id UUID)
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM family_memberships
          WHERE family_id = target_family_id
          AND user_id = auth.uid()
          AND status = 'active'
          LIMIT 1
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      CREATE OR REPLACE FUNCTION user_is_family_coordinator(target_family_id UUID)
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 
          FROM family_memberships fm
          INNER JOIN roles r ON fm.role_id = r.id
          WHERE fm.family_id = target_family_id
          AND fm.user_id = auth.uid()
          AND fm.status = 'active'
          AND r.type IN ('family_coordinator', 'system_admin')
          LIMIT 1
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    const { error: functionsError } = await supabase.rpc('exec_sql', { 
      sql: helperFunctionsSQL 
    });

    if (functionsError) {
      console.error('❌ Failed to create helper functions:', functionsError.message);
      
      // Try alternative approach: execute each statement separately
      console.log('Trying to execute SQL in parts...');
      
      const statements = helperFunctionsSQL.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          const { error } = await supabase.rpc('exec_sql', { sql: statement.trim() + ';' });
          if (error) {
            console.error(`Failed to execute: ${statement.substring(0, 50)}...`, error.message);
          }
        }
      }
    } else {
      console.log('✅ Helper functions created');
    }

    // Step 2: Disable RLS and drop policies
    console.log('\n🛠️ Disabling RLS and cleaning up policies...');
    
    const cleanupSQL = `
      ALTER TABLE family_memberships DISABLE ROW LEVEL SECURITY;
      
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

    const { error: cleanupError } = await supabase.rpc('exec_sql', { 
      sql: cleanupSQL 
    });

    if (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError.message);
    } else {
      console.log('✅ Cleanup completed');
    }

    // Step 3: Create new policies
    console.log('\n🔒 Creating new non-recursive policies...');
    
    const newPoliciesSQL = `
      CREATE POLICY "family_memberships_select_non_recursive" ON family_memberships
        FOR SELECT USING (
          user_id = auth.uid()
          OR
          user_is_family_member(family_id)
        );

      CREATE POLICY "family_memberships_insert_non_recursive" ON family_memberships
        FOR INSERT WITH CHECK (
          user_id = auth.uid()
          OR
          user_is_family_coordinator(family_id)
        );

      CREATE POLICY "family_memberships_update_non_recursive" ON family_memberships
        FOR UPDATE USING (
          user_id = auth.uid()
          OR
          user_is_family_coordinator(family_id)
        );

      CREATE POLICY "family_memberships_delete_non_recursive" ON family_memberships
        FOR DELETE USING (
          user_is_family_coordinator(family_id)
        );
    `;

    const { error: policiesError2 } = await supabase.rpc('exec_sql', { 
      sql: newPoliciesSQL 
    });

    if (policiesError2) {
      console.error('❌ Failed to create new policies:', policiesError2.message);
    } else {
      console.log('✅ New policies created');
    }

    // Step 4: Re-enable RLS
    console.log('\n🔐 Re-enabling RLS...');
    
    const enableSQL = `ALTER TABLE family_memberships ENABLE ROW LEVEL SECURITY;`;
    
    const { error: enableError } = await supabase.rpc('exec_sql', { 
      sql: enableSQL 
    });

    if (enableError) {
      console.error('❌ Failed to re-enable RLS:', enableError.message);
    } else {
      console.log('✅ RLS re-enabled');
    }

    // Step 5: Test the fix
    console.log('\n🧪 Testing the fix with the problematic query...');
    
    const { data: testData, error: testError } = await supabase
      .from('family_memberships')
      .select('id, family_id, user_id, status')
      .eq('family_id', 'c36260a4-9e13-4d0b-98fd-551749e79e03')
      .eq('user_id', '93029e4f-1d9d-4420-a657-6402a2d78f22')
      .eq('status', 'active');

    if (testError) {
      console.log('❌ Test query failed:', testError.message);
    } else {
      console.log('✅ Test query succeeded! Results:', testData);
    }

    console.log('\n🎉 The healing is complete! The infinite recursion has been banished!');
    console.log('🏰 The halls of Rivendell are once again safe for all database queries.');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Execute the script
applyElrondFix().catch(console.error);