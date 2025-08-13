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
    console.log('Checking membership for user:', user.id, 'in family:', id);
    
    const { data: membership, error: membershipError } = await supabase
      .from('family_memberships')
      .select('id')
      .eq('family_id', id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    console.log('Membership query result:', { membership, error: membershipError });

    if (membershipError || !membership) {
      console.error('Access denied - Error:', membershipError?.message);
      return NextResponse.json(
        { success: false, error: membershipError?.message || 'You are not a member of this family' },
        { status: 403 }
      );
    }

    // Get family details
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select(`
        id,
        name,
        description,
        timezone,
        created_at,
        created_by,
        status
      `)
      .eq('id', id)
      .single();

    if (familyError) {
      return NextResponse.json(
        { success: false, error: familyError.message },
        { status: 500 }
      );
    }

    // Get member count
    const { count: memberCount } = await supabase
      .from('family_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('family_id', id)
      .eq('status', 'active');

    return NextResponse.json({
      success: true,
      family: {
        ...family,
        member_count: memberCount || 0
      }
    });

  } catch (error) {
    console.error('Get family error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch family' },
      { status: 500 }
    );
  }
}