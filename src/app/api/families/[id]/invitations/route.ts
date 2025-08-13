import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - List pending invitations for a family
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
      .select('roles(type)')
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

    // For now, return mock data since we don't have the invitation table yet
    const mockInvitations: any[] = [];

    return NextResponse.json({
      success: true,
      invitations: mockInvitations
    });

  } catch (error) {
    console.error('Get invitations error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}

// POST - Send a new invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has permission to invite members
    const { data: membership, error: membershipError } = await supabase
      .from('family_memberships')
      .select('roles(type)')
      .eq('family_id', id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Check if user is admin or family_coordinator
    const roleType = (membership.roles as any)?.type;
    if (!['family_coordinator', 'system_admin'].includes(roleType)) {
      return NextResponse.json(
        { success: false, error: 'Only family coordinators can invite members' },
        { status: 403 }
      );
    }

    // Validate input
    const { email, roleType: inviteRoleType, relationship, personalMessage } = body;
    
    if (!email || !inviteRoleType) {
      return NextResponse.json(
        { success: false, error: 'Email and role are required' },
        { status: 400 }
      );
    }

    // For now, return success with mock data
    const mockInvitation = {
      id: crypto.randomUUID(),
      family_id: id,
      email: email.toLowerCase(),
      roleType: inviteRoleType,
      relationship,
      personalMessage,
      sentAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending'
    };

    return NextResponse.json({
      success: true,
      invitation: mockInvitation,
      message: `Invitation sent to ${email}`
    });

  } catch (error) {
    console.error('Send invitation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}