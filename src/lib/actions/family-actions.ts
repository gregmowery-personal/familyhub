'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export interface CreateFamilyData {
  name: string;
  description?: string;
  timezone: string;
  primaryCaregiverEmail?: string;
}

export interface InviteMemberData {
  familyId: string;
  email: string;
  roleType: string;
  personalMessage?: string;
  relationship?: string;
  displayName?: string;
}

export interface FamilyMember {
  id: string;
  user_id: string;
  display_name: string | null;
  relationship: string | null;
  email: string;
  role: {
    id: string;
    name: string;
    type: string;
    priority: number;
  };
  status: string;
  joined_at: string;
}

export interface Family {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  subscription_status: string;
  timezone: string;
  invite_code: string;
  created_at: string;
  member_count?: number;
  subscription_tier?: {
    name: string;
    max_family_members: number;
  };
}

// Create a new family
export async function createFamily(data: CreateFamilyData) {
  console.log('🏠 [createFamily] Starting family creation with data:', {
    name: data.name,
    timezone: data.timezone,
    hasPrimaryCaregiverEmail: !!data.primaryCaregiverEmail
  });

  const supabase = await createClient();

  try {
    // Get the current user
    console.log('👤 [createFamily] Getting current user...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('❌ [createFamily] Auth error:', authError);
      return { success: false, error: `Authentication error: ${authError.message}` };
    }
    
    if (!user) {
      console.error('❌ [createFamily] No user found');
      return { success: false, error: 'Authentication required - no user found' };
    }
    
    console.log('✅ [createFamily] User authenticated:', user.id, user.email);

    // Get family_coordinator role
    console.log('🔍 [createFamily] Looking for family_coordinator role...');
    const { data: coordinatorRole, error: roleError } = await supabase
      .from('roles')
      .select('id, type, name')
      .eq('type', 'family_coordinator')
      .single();

    if (roleError) {
      console.error('❌ [createFamily] Role query error:', roleError);
      return { success: false, error: `Role error: ${roleError.message}` };
    }
    
    if (!coordinatorRole) {
      console.error('❌ [createFamily] No family_coordinator role found');
      return { success: false, error: 'Unable to assign role - family_coordinator not found' };
    }
    
    console.log('✅ [createFamily] Found role:', coordinatorRole);

    // Get Free tier
    console.log('🔍 [createFamily] Looking for Free subscription tier...');
    const { data: freeTier, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('id, name')
      .eq('name', 'free')
      .single();
    
    if (tierError) {
      console.error('❌ [createFamily] Tier query error:', tierError);
      return { success: false, error: `Subscription tier error: ${tierError.message}` };
    }
    
    if (!freeTier) {
      console.error('❌ [createFamily] No Free tier found');
      return { success: false, error: 'Unable to find Free subscription tier' };
    }
    
    console.log('✅ [createFamily] Found Free tier:', freeTier.id);

    // Create family
    console.log('🏗️ [createFamily] Creating family record...');
    const familyData = {
      name: data.name,
      description: data.description || null,
      timezone: data.timezone,
      created_by: user.id,
      subscription_tier_id: freeTier.id,
      status: 'active'
    };
    console.log('   Family data:', familyData);

    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert(familyData)
      .select()
      .single();

    if (familyError) {
      console.error('❌ [createFamily] Family creation error:', familyError);
      return { success: false, error: `Family creation failed: ${familyError.message}` };
    }
    
    console.log('✅ [createFamily] Family created:', family.id, family.name);

    // Add creator as family coordinator
    console.log('👥 [createFamily] Adding user as family coordinator...');
    const membershipData = {
      family_id: family.id,
      user_id: user.id,
      role_id: coordinatorRole.id,
      status: 'active',
      is_default_family: true,
      display_name: `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || user.email?.split('@')[0]
    };
    console.log('   Membership data:', membershipData);

    const { error: membershipError } = await supabase
      .from('family_memberships')
      .insert(membershipData);

    if (membershipError) {
      console.error('❌ [createFamily] Membership creation error:', membershipError);
      return { success: false, error: `Membership creation failed: ${membershipError.message}` };
    }
    
    console.log('✅ [createFamily] User added as family coordinator');

    // Set as default family in user preferences
    await supabase
      .from('user_family_preferences')
      .upsert({
        user_id: user.id,
        default_family_id: family.id
      });

    revalidatePath('/dashboard');
    return { 
      success: true, 
      family: family,
      message: 'Family created successfully!' 
    };

  } catch (error) {
    console.error('Create family error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// Get families for current user
export async function getUserFamilies() {
  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required', families: [] };
    }

    const { data: families, error } = await supabase
      .from('families')
      .select(`
        id,
        name,
        description,
        created_by,
        subscription_status,
        timezone,
        invite_code,
        created_at,
        subscription_tiers(name, max_family_members),
        family_memberships!inner(
          id,
          is_default_family,
          roles(id, name, type, priority)
        )
      `)
      .eq('family_memberships.user_id', user.id)
      .eq('family_memberships.status', 'active')
      .eq('status', 'active')
      .order('name');

    if (error) {
      return { success: false, error: error.message, families: [] };
    }

    // Add member count to each family
    const familiesWithCounts = await Promise.all(
      families.map(async (family) => {
        const { count } = await supabase
          .from('family_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('family_id', family.id)
          .eq('status', 'active');

        return {
          ...family,
          member_count: count || 0,
          subscription_tier: family.subscription_tiers
        };
      })
    );

    return { success: true, families: familiesWithCounts };

  } catch (error) {
    console.error('Get user families error:', error);
    return { success: false, error: 'Failed to fetch families', families: [] };
  }
}

// Get family members
export async function getFamilyMembers(familyId: string): Promise<{ success: boolean; members: FamilyMember[]; error?: string }> {
  const supabase = await createClient();

  try {
    const { data: members, error } = await supabase
      .from('family_memberships')
      .select(`
        id,
        user_id,
        display_name,
        relationship,
        status,
        joined_at,
        roles(id, name, type, priority),
        users:user_id(email)
      `)
      .eq('family_id', familyId)
      .eq('status', 'active')
      .order('roles.priority', { ascending: false });

    if (error) {
      return { success: false, members: [], error: error.message };
    }

    const formattedMembers: FamilyMember[] = (members || []).map(member => ({
      id: member.id,
      user_id: member.user_id,
      display_name: member.display_name,
      relationship: member.relationship,
      email: (member.users as any)?.email || '',
      role: {
        id: member.roles?.id || '',
        name: member.roles?.name || '',
        type: member.roles?.type || '',
        priority: member.roles?.priority || 0
      },
      status: member.status,
      joined_at: member.joined_at
    }));

    return { success: true, members: formattedMembers };

  } catch (error) {
    console.error('Get family members error:', error);
    return { success: false, members: [], error: 'Failed to fetch family members' };
  }
}

// Invite member to family
export async function inviteFamilyMember(data: InviteMemberData) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // Check if user has permission to invite members
    const { data: membership, error: membershipError } = await supabase
      .from('family_memberships')
      .select('roles(type)')
      .eq('family_id', data.familyId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (membershipError || !membership?.roles?.type) {
      return { success: false, error: 'Permission denied' };
    }

    if (!['family_coordinator', 'system_admin'].includes(membership.roles.type)) {
      return { success: false, error: 'Only family coordinators can invite members' };
    }

    // Check if email is already invited or is a member
    const { data: existing, error: existingError } = await supabase
      .from('family_invitations')
      .select('id')
      .eq('family_id', data.familyId)
      .eq('invited_email', data.email.toLowerCase())
      .in('status', ['pending', 'accepted']);

    if (existing && existing.length > 0) {
      return { success: false, error: 'This person is already invited or is a family member' };
    }

    // Get the role ID
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('type', data.roleType)
      .single();

    if (roleError || !role) {
      return { success: false, error: 'Invalid role specified' };
    }

    // Generate invitation token
    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('family_invitations')
      .insert({
        family_id: data.familyId,
        invited_email: data.email.toLowerCase(),
        invitation_token: invitationToken,
        suggested_role_id: role.id,
        personal_message: data.personalMessage,
        suggested_relationship: data.relationship,
        suggested_display_name: data.displayName,
        invited_by: user.id,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (inviteError) {
      return { success: false, error: inviteError.message };
    }

    // TODO: Send invitation email
    // This would integrate with your email service

    revalidatePath('/dashboard/family');
    return { 
      success: true, 
      invitation,
      message: `Invitation sent to ${data.email}` 
    };

  } catch (error) {
    console.error('Invite family member error:', error);
    return { success: false, error: 'Failed to send invitation' };
  }
}

// Switch default family
export async function switchDefaultFamily(familyId: string) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // Verify user is a member of this family
    const { data: membership, error: membershipError } = await supabase
      .from('family_memberships')
      .select('id')
      .eq('family_id', familyId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (membershipError || !membership) {
      return { success: false, error: 'You are not a member of this family' };
    }

    // Update all memberships to not be default
    await supabase
      .from('family_memberships')
      .update({ is_default_family: false })
      .eq('user_id', user.id);

    // Set the new default family
    const { error: updateError } = await supabase
      .from('family_memberships')
      .update({ is_default_family: true })
      .eq('family_id', familyId)
      .eq('user_id', user.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Update user preferences
    await supabase
      .from('user_family_preferences')
      .upsert({
        user_id: user.id,
        default_family_id: familyId
      });

    revalidatePath('/dashboard');
    return { success: true, message: 'Default family updated' };

  } catch (error) {
    console.error('Switch default family error:', error);
    return { success: false, error: 'Failed to switch default family' };
  }
}

// Get family dashboard data
export async function getFamilyDashboard(familyId: string) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get family details
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select(`
        *,
        subscription_tiers(name, max_family_members, features)
      `)
      .eq('id', familyId)
      .single();

    if (familyError) {
      return { success: false, error: familyError.message };
    }

    // Get member count
    const { count: memberCount } = await supabase
      .from('family_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('family_id', familyId)
      .eq('status', 'active');

    // Get recent activity (placeholder - would implement based on activity log table)
    const recentActivity = [
      {
        id: '1',
        type: 'member_joined',
        message: 'Sarah joined the family',
        timestamp: new Date().toISOString(),
        user_name: 'Sarah Johnson'
      }
    ];

    return {
      success: true,
      data: {
        family: {
          ...family,
          member_count: memberCount || 0
        },
        stats: {
          totalMembers: memberCount || 0,
          maxMembers: family.subscription_tiers?.max_family_members || 5,
          pendingInvitations: 0, // TODO: Count pending invitations
          recentActivity: recentActivity.length
        },
        recentActivity
      }
    };

  } catch (error) {
    console.error('Get family dashboard error:', error);
    return { success: false, error: 'Failed to load family dashboard' };
  }
}