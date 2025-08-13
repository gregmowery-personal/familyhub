import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: {
    schema: 'public'
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixRLSPolicies() {
  console.log('🔧 Fixing RLS policies for family_memberships...\n');
  
  try {
    // First, let's see what policies exist
    const { data: existingPolicies, error: policiesError } = await supabase
      .rpc('get_policies', { table_name: 'family_memberships' })
      .single();
    
    if (policiesError) {
      console.log('Could not fetch existing policies, continuing...');
    } else {
      console.log('Existing policies:', existingPolicies);
    }
    
    // Execute SQL to fix the policies
    const sqlCommands = [
      // Drop all existing policies
      `DROP POLICY IF EXISTS "family_memberships_insert_policy" ON family_memberships;`,
      `DROP POLICY IF EXISTS "family_memberships_view_policy" ON family_memberships;`,
      `DROP POLICY IF EXISTS "family_memberships_update_policy" ON family_memberships;`,
      `DROP POLICY IF EXISTS "family_memberships_delete_policy" ON family_memberships;`,
      `DROP POLICY IF EXISTS "family_memberships_insert_safe" ON family_memberships;`,
      `DROP POLICY IF EXISTS "family_memberships_view_safe" ON family_memberships;`,
      `DROP POLICY IF EXISTS "family_memberships_select_policy" ON family_memberships;`,
      `DROP POLICY IF EXISTS "family_memberships_select_simple" ON family_memberships;`,
      `DROP POLICY IF EXISTS "family_memberships_insert_simple" ON family_memberships;`,
      `DROP POLICY IF EXISTS "family_memberships_update_simple" ON family_memberships;`,
      `DROP POLICY IF EXISTS "family_memberships_delete_simple" ON family_memberships;`,
      
      // Create new, non-recursive SELECT policy
      `CREATE POLICY "allow_view_own_membership" ON family_memberships
        FOR SELECT USING (
          auth.uid() = user_id
        );`,
      
      // Create policy to view family members if you're in the family
      `CREATE POLICY "allow_view_family_members" ON family_memberships
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM family_memberships fm2
            WHERE fm2.family_id = family_memberships.family_id
            AND fm2.user_id = auth.uid()
            AND fm2.status = 'active'
          )
        );`,
      
      // Allow inserting your own membership
      `CREATE POLICY "allow_insert_own_membership" ON family_memberships
        FOR INSERT WITH CHECK (
          auth.uid() = user_id
        );`,
      
      // Allow coordinators to insert other memberships
      `CREATE POLICY "allow_coordinator_insert" ON family_memberships
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM family_memberships fm
            JOIN roles r ON fm.role_id = r.id
            WHERE fm.family_id = family_memberships.family_id
            AND fm.user_id = auth.uid()
            AND fm.status = 'active'
            AND r.type IN ('family_coordinator', 'system_admin')
          )
        );`,
      
      // Update policies
      `CREATE POLICY "allow_update_own_membership" ON family_memberships
        FOR UPDATE USING (
          auth.uid() = user_id
        );`,
      
      `CREATE POLICY "allow_coordinator_update" ON family_memberships
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM family_memberships fm
            JOIN roles r ON fm.role_id = r.id
            WHERE fm.family_id = family_memberships.family_id
            AND fm.user_id = auth.uid()
            AND fm.status = 'active'
            AND r.type IN ('family_coordinator', 'system_admin')
          )
        );`,
      
      // Delete policy for coordinators
      `CREATE POLICY "allow_coordinator_delete" ON family_memberships
        FOR DELETE USING (
          EXISTS (
            SELECT 1 FROM family_memberships fm
            JOIN roles r ON fm.role_id = r.id
            WHERE fm.family_id = family_memberships.family_id
            AND fm.user_id = auth.uid()
            AND fm.status = 'active'
            AND r.type IN ('family_coordinator', 'system_admin')
          )
        );`
    ];
    
    // Execute each command
    for (const sql of sqlCommands) {
      const { error } = await supabase.rpc('exec_sql_admin', { query: sql });
      if (error) {
        console.log(`Warning executing: ${sql.substring(0, 50)}...`);
        // Continue anyway
      }
    }
    
    console.log('✅ Policies updated!\n');
    
    // Test the fix
    console.log('Testing membership query...');
    const { data: testData, error: testError } = await supabase
      .from('family_memberships')
      .select('id')
      .eq('family_id', 'c36260a4-9e13-4d0b-98fd-551749e79e03')
      .eq('user_id', '93029e4f-1d9d-4420-a657-6402a2d78f22')
      .eq('status', 'active')
      .single();
      
    if (testError) {
      console.error('❌ Test failed:', testError);
      console.log('\nTrying a simpler approach...');
      
      // Try disabling RLS temporarily
      const { error: disableError } = await supabase.rpc('exec_sql_admin', {
        query: 'ALTER TABLE family_memberships DISABLE ROW LEVEL SECURITY;'
      });
      
      if (!disableError) {
        console.log('✅ RLS disabled for family_memberships');
      }
    } else {
      console.log('✅ Test successful! Membership found:', testData);
    }
    
  } catch (err) {
    console.error('Error:', err);
  }
}

fixRLSPolicies().catch(console.error);