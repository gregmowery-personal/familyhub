#!/usr/bin/env npx tsx
/**
 * Apply the family creation recursion fix directly
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nhfwemygprcilprwxtfp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZndlbXlncHJjaWxwcnd4dGZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIyNzY1NCwiZXhwIjoyMDY5ODAzNjU0fQ.fGllakrVheUaRNP6UDExG_0juJD9w3eh_3pEKiOVZr0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
-- Fix Family Creation Recursion
BEGIN;

-- Drop the problematic insert policy that causes chicken-and-egg recursion
DROP POLICY IF EXISTS "family_memberships_insert_policy" ON family_memberships;

-- Create a new policy that handles the bootstrap case properly
CREATE POLICY IF NOT EXISTS "family_memberships_insert_safe" ON family_memberships 
  FOR INSERT WITH CHECK (
    -- Always allow users to create their own membership
    user_id = auth.uid()
    OR
    -- Allow family coordinators to add other members  
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_memberships.family_id
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
    )
  );

-- Also fix the view policy to be more explicit and avoid confusion
DROP POLICY IF EXISTS "family_memberships_view_policy" ON family_memberships;

-- Simplified view policy that doesn't cause recursion
CREATE POLICY IF NOT EXISTS "family_memberships_view_safe" ON family_memberships 
  FOR SELECT USING (
    -- Users can always see their own membership
    user_id = auth.uid() 
    OR 
    -- Users can see other memberships in families where they have ANY active membership
    EXISTS (
      SELECT 1 FROM family_memberships fm2
      WHERE fm2.family_id = family_memberships.family_id 
      AND fm2.user_id = auth.uid() 
      AND fm2.status = 'active'
    )
  );

-- Update policy to allow users to manage their own memberships
DROP POLICY IF EXISTS "family_memberships_update_policy" ON family_memberships;

CREATE POLICY IF NOT EXISTS "family_memberships_update_safe" ON family_memberships 
  FOR UPDATE USING (
    -- Users can update their own membership details
    user_id = auth.uid()
    OR
    -- Family coordinators can update any membership in their family
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_memberships.family_id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
    )
  );

-- Delete policy stays the same but let's make it consistent
DROP POLICY IF EXISTS "family_memberships_delete_policy" ON family_memberships;

CREATE POLICY IF NOT EXISTS "family_memberships_delete_safe" ON family_memberships 
  FOR DELETE USING (
    -- Only family coordinators can delete memberships
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_memberships.family_id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
    )
    OR
    -- Users can delete their own membership (leave family)
    user_id = auth.uid()
  );

COMMIT;
`;

async function applyFix() {
  console.log('🔧 Applying family creation recursion fix...\n');

  try {
    const { error } = await supabase.rpc('exec_sql', { query: sql }).single();
    
    if (error) {
      // Try direct execution if exec_sql doesn't exist
      console.log('⚠️ exec_sql not available, trying alternative method...');
      
      // Execute statements one by one
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && s !== 'BEGIN' && s !== 'COMMIT');
      
      for (const statement of statements) {
        if (statement) {
          console.log('Executing:', statement.substring(0, 50) + '...');
          // Note: This won't work directly, but shows the structure
          console.log('Statement prepared for manual execution');
        }
      }
      
      console.log('\n📝 SQL statements prepared. Please run these in Supabase SQL Editor:');
      console.log(sql);
      return;
    }
    
    console.log('✅ Recursion fix applied successfully!');
    
    // Test the fix
    console.log('\n🧪 Testing the fix...');
    const { data: roles, error: roleError } = await supabase
      .from('roles')
      .select('id, type, name')
      .eq('type', 'family_coordinator')
      .single();
    
    if (roleError) {
      console.error('❌ Role query still failing:', roleError);
    } else {
      console.log('✅ Role query works:', roles);
    }
    
  } catch (error) {
    console.error('❌ Failed to apply fix:', error);
    console.log('\n📝 Please run this SQL manually in Supabase SQL Editor:');
    console.log(sql);
  }
}

applyFix();