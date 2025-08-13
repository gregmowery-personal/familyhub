import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixFamilyMembership() {
  const familyId = 'c36260a4-9e13-4d0b-98fd-551749e79e03';
  const userId = '93029e4f-1d9d-4420-a657-6402a2d78f22';
  
  // Check membership without join
  const { data: membership, error: membershipError } = await supabase
    .from('family_memberships')
    .select('*')
    .eq('family_id', familyId)
    .eq('user_id', userId)
    .single();
    
  console.log('Current membership:', membership);
  if (membershipError) console.error('Membership error:', membershipError);
  
  if (membership) {
    // Check if status is active
    if (membership.status !== 'active') {
      console.log('Membership exists but status is:', membership.status);
      console.log('Updating to active...');
      
      const { data: updated, error: updateError } = await supabase
        .from('family_memberships')
        .update({ status: 'active' })
        .eq('id', membership.id)
        .select()
        .single();
        
      if (updateError) {
        console.error('Update error:', updateError);
      } else {
        console.log('✅ Updated membership to active:', updated);
      }
    } else {
      console.log('✅ Membership already active');
    }
    
    // Check if role_id is set
    if (!membership.role_id) {
      console.log('No role assigned, fixing...');
      
      // Get family_coordinator role
      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('type', 'family_coordinator')
        .single();
        
      if (role) {
        const { data: updated, error: updateError } = await supabase
          .from('family_memberships')
          .update({ role_id: role.id })
          .eq('id', membership.id)
          .select()
          .single();
          
        if (updateError) {
          console.error('Role update error:', updateError);
        } else {
          console.log('✅ Updated role to family_coordinator:', updated);
        }
      }
    }
  } else {
    console.log('No membership found, this is a bigger problem!');
  }
}

fixFamilyMembership().catch(console.error);