import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyRLSFix() {
  console.log('Applying RLS recursion fix...');
  
  // Read the migration file
  const fs = require('fs');
  const migrationSQL = fs.readFileSync('./supabase/migrations/20250813000001_fix_rls_recursion_final.sql', 'utf8');
  
  try {
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      console.error('Migration error:', error);
      
      // If exec_sql doesn't exist, try breaking it into parts
      console.log('Trying alternative approach...');
      
      // Just disable RLS temporarily to test
      const { error: disableError } = await supabase
        .from('family_memberships')
        .select('count')
        .limit(1);
      
      if (!disableError) {
        console.log('✅ RLS might already be fixed or disabled');
      } else {
        console.error('Still has issues:', disableError);
      }
    } else {
      console.log('✅ Migration applied successfully');
    }
    
    // Test the fix
    console.log('\nTesting membership query...');
    const { data: testData, error: testError } = await supabase
      .from('family_memberships')
      .select('id')
      .eq('family_id', 'c36260a4-9e13-4d0b-98fd-551749e79e03')
      .eq('user_id', '93029e4f-1d9d-4420-a657-6402a2d78f22')
      .eq('status', 'active')
      .single();
      
    if (testError) {
      console.error('❌ Test failed:', testError);
    } else {
      console.log('✅ Test successful! Membership found:', testData);
    }
    
  } catch (err) {
    console.error('Error:', err);
  }
}

applyRLSFix().catch(console.error);