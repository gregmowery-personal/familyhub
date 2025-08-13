import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is a member of this family
    const { data: membership, error: membershipError } = await supabase
      .from('family_memberships')
      .select('id')
      .eq('family_id', id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { success: false, error: 'You are not a member of this family' },
        { status: 403 }
      );
    }

    // Get family members with their profiles and roles
    const { data: members, error: membersError } = await supabase
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
      .eq('family_id', id)
      .eq('status', 'active')
      .order('joined_at', { ascending: true });

    if (membersError) {
      return NextResponse.json(
        { success: false, error: membersError.message },
        { status: 500 }
      );
    }

    // Format the response
    const formattedMembers = (members || []).map(member => ({
      id: member.id,
      display_name: member.display_name,
      relationship: member.relationship,
      email: (member.users as any)?.email || 'Unknown',
      role: {
        id: (member.roles as any)?.id || '',
        name: (member.roles as any)?.name || 'Member',
        type: (member.roles as any)?.type || 'member'
      },
      joined_at: member.joined_at
    }));

    return NextResponse.json({
      success: true,
      members: formattedMembers
    });

  } catch (error) {
    console.error('Get family members error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch family members' },
      { status: 500 }
    );
  }
}