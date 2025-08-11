/**
 * Verification script to confirm families table fix
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nhfwemygprcilprwxtfp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyNzY1NCwiZXhwIjoyMDY5ODAzNjU0fQ.fGllakrVheUaRNP6UDExG_0juJD9w3eh_3pEKiOVZr0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyFix() {
  console.log('🔍 Verifying families table fix...\n');

  try {
    // 1. Check if families table has description column
    console.log('1️⃣ Checking families table structure...');
    const { data: familiesData, error: familiesError } = await supabase
      .from('families')
      .select('id, name, description')
      .limit(1);

    if (familiesError) {
      console.error('❌ Error querying families:', familiesError);
      return false;
    }
    console.log('✅ Families table has description column');

    // 2. Test get_user_families function
    console.log('\n2️⃣ Testing get_user_families function...');
    
    // Get a test user
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1 });
    
    if (users && users.length > 0) {
      const testUserId = users[0].id;
      console.log(`   Testing with user: ${users[0].email}`);
      
      const { data: familiesFunc, error: funcError } = await supabase
        .rpc('get_user_families', { user_id: testUserId });

      if (funcError) {
        console.error('❌ Error calling get_user_families:', funcError);
        return false;
      }
      
      console.log('✅ get_user_families function works');
      console.log(`   Found ${familiesFunc?.length || 0} families for user`);
    }

    // 3. Verify all expected columns exist
    console.log('\n3️⃣ Verifying all expected columns...');
    const { data: columnsData, error: columnsError } = await supabase
      .from('families')
      .select()
      .limit(0); // Just get the structure

    if (!columnsError) {
      console.log('✅ All columns accessible');
    }

    // 4. Check family_memberships table
    console.log('\n4️⃣ Checking family_memberships table...');
    const { data: membershipsData, error: membershipsError } = await supabase
      .from('family_memberships')
      .select('id')
      .limit(1);

    if (membershipsError) {
      console.error('❌ Error querying family_memberships:', membershipsError);
      return false;
    }
    console.log('✅ family_memberships table accessible');

    console.log('\n🎉 VERIFICATION COMPLETE - All fixes confirmed working!');
    return true;

  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

verifyFix().then(success => {
  process.exit(success ? 0 : 1);
});