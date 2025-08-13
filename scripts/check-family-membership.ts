import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkFamilyMembership() {
  const familyId = 'c36260a4-9e13-4d0b-98fd-551749e79e03';
  
  // Check family
  const { data: family, error: familyError } = await supabase
    .from('families')
    .select('*')
    .eq('id', familyId)
    .single();
    
  console.log('Family:', family);
  if (familyError) console.error('Family error:', familyError);
  
  // Check memberships
  const { data: memberships, error: membershipError } = await supabase
    .from('family_memberships')
    .select(`
      *,
      roles(type, name),
      users:user_id(email)
    `)
    .eq('family_id', familyId);
    
  console.log('\nMemberships:', memberships);
  if (membershipError) console.error('Membership error:', membershipError);
  
  // Check if the creator is a member
  if (family?.created_by) {
    const creatorMembership = memberships?.find(m => m.user_id === family.created_by);
    if (!creatorMembership) {
      console.log('\n⚠️ WARNING: Family creator is not a member!');
      console.log('Creator ID:', family.created_by);
      
      // Try to add them
      console.log('\nAttempting to add creator as member...');
      
      // Get family_coordinator role
      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('type', 'family_coordinator')
        .single();
        
      if (role) {
        const { data: newMembership, error: addError } = await supabase
          .from('family_memberships')
          .insert({
            family_id: familyId,
            user_id: family.created_by,
            role_id: role.id,
            status: 'active',
            is_default_family: true,
            display_name: 'Family Coordinator'
          })
          .select()
          .single();
          
        if (addError) {
          console.error('Failed to add creator:', addError);
        } else {
          console.log('✅ Successfully added creator as member:', newMembership);
        }
      }
    } else {
      console.log('\n✅ Creator is already a member');
    }
  }
}

checkFamilyMembership().catch(console.error);