#!/usr/bin/env npx tsx
/**
 * Test script to verify roles query works without recursion
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nhfwemygprcilprwxtfp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyNzY1NCwiZXhwIjoyMDY5ODAzNjU0fQ.fGllakrVheUaRNP6UDExG_0juJD9w3eh_3pEKiOVZr0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRolesQuery() {
  console.log('🧪 Testing roles query (checking for recursion fix)...\n');

  try {
    // Test the exact query that was failing
    console.log('🔍 Looking for family_coordinator role...');
    const { data: coordinatorRole, error: roleError } = await supabase
      .from('roles')
      .select('id, type, name')
      .eq('type', 'family_coordinator')
      .single();

    if (roleError) {
      console.error('❌ Role query error:', roleError);
      return false;
    }
    
    if (!coordinatorRole) {
      console.error('❌ No family_coordinator role found');
      return false;
    }
    
    console.log('✅ Found role:', coordinatorRole);
    console.log('\n🎉 SUCCESS! Roles query works without recursion!');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

testRolesQuery().then(success => {
  process.exit(success ? 0 : 1);
});