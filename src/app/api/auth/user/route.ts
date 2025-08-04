import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  withAuth, 
  createErrorResponse, 
  createSuccessResponse 
} from '@/lib/auth/middleware';
import { 
  AuthError, 
  getSecurityContext,
  logAuditEvent,
  getServerUser,
  getUserProfile,
  getUserFamilies
} from '@/lib/auth/utils';
import { Family, SecurityContext } from '@/types/auth';

const corsOptions = {
  origins: ['http://localhost:3000', 'https://familyhub.care'],
  methods: ['GET', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization'],
};

export async function OPTIONS(request: NextRequest) {
  const middlewareResponse = await withAuth(request, { cors: corsOptions });
  return middlewareResponse || new Response(null, { status: 200 });
}

export async function GET(request: NextRequest) {
  // Apply middleware
  const middlewareResponse = await withAuth(request, {
    cors: corsOptions,
  });
  
  if (middlewareResponse) {
    return middlewareResponse;
  }

  let securityContext: SecurityContext | null = null;

  try {
    securityContext = await getSecurityContext() as SecurityContext;
    
    // Get current authenticated user
    const currentUser = await getServerUser();
    
    if (!currentUser) {
      return createErrorResponse(
        new AuthError('Authentication required', 'AUTHENTICATION_REQUIRED', 401),
        corsOptions
      );
    }

    const userId = currentUser.id;
    const supabase = await createClient();

    try {
      // Get comprehensive user data
      const [profile, families] = await Promise.all([
        getUserProfile(userId),
        getUserFamilies(userId)
      ]);

      // Get enhanced family data with member counts
      const familiesWithDetails = await Promise.all(
        families.map(async (family: Family & { role?: string; is_family_admin?: boolean }) => {
          const { data: memberCount } = await supabase
            .from('family_members')
            .select('id', { count: 'exact' })
            .eq('family_id', family.id)
            .is('deleted_at', null);

          return {
            ...family,
            member_count: memberCount || 0,
          };
        })
      );

      // Get active sessions count
      const { data: activeSessions } = await supabase
        .from('user_sessions')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Log user profile access
      await logAuditEvent(
        'user_profile_accessed',
        'user_data',
        'User profile data accessed',
        {
          actorUserId: userId,
          eventData: {
            email: currentUser.email,
            family_count: families.length,
            active_sessions: activeSessions || 0,
          },
          severity: 'low',
          securityContext,
        }
      );

      // Prepare comprehensive response data
      const responseData = {
        user: {
          id: currentUser.id,
          email: currentUser.email,
          phone: currentUser.phone,
          email_confirmed_at: currentUser.email_confirmed_at,
          phone_confirmed_at: currentUser.phone_confirmed_at,
          created_at: currentUser.created_at,
          updated_at: currentUser.updated_at,
        },
        profile: profile ? {
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          display_name: profile.display_name,
          phone_number: profile.phone_number,
          profile_image_url: profile.profile_image_url,
          preferred_language: profile.preferred_language,
          timezone: profile.timezone,
          notification_preferences: profile.notification_preferences,
          accessibility_preferences: profile.accessibility_preferences,
          two_factor_enabled: profile.two_factor_enabled,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
        } : null,
        families: familiesWithDetails.map(family => ({
          id: family.id,
          name: family.name,
          family_type: family.family_type,
          timezone: family.timezone,
          role: family.role,
          is_family_admin: family.is_family_admin,
          member_count: family.member_count,
        })),
        session_info: {
          active_sessions_count: activeSessions || 0,
        },
        account_status: {
          email_verified: !!currentUser.email_confirmed_at,
          phone_verified: !!currentUser.phone_confirmed_at,
          profile_complete: !!(profile?.first_name && profile?.last_name),
          has_families: families.length > 0,
          two_factor_enabled: profile?.two_factor_enabled || false,
        },
      };

      return createSuccessResponse(
        responseData,
        'User profile retrieved successfully',
        200,
        corsOptions
      );

    } catch (dataError) {
      console.error('Error fetching user profile data:', dataError instanceof Error ? dataError.message : "Unknown error");
      
      // Log error
      await logAuditEvent(
        'user_profile_access_error',
        'user_data',
        'Error accessing user profile data',
        {
          actorUserId: userId,
          eventData: {
            error: dataError instanceof Error ? dataError.message : 'Unknown error',
          },
          severity: 'medium',
          success: false,
          securityContext,
        }
      );

      // Return basic user info even if profile fetch fails
      return createSuccessResponse(
        {
          user: {
            id: currentUser.id,
            email: currentUser.email,
            phone: currentUser.phone,
            email_confirmed_at: currentUser.email_confirmed_at,
            phone_confirmed_at: currentUser.phone_confirmed_at,
            created_at: currentUser.created_at,
            updated_at: currentUser.updated_at,
          },
          profile: null,
          families: [],
          session_info: {
            active_sessions_count: 0,
          },
          account_status: {
            email_verified: !!currentUser.email_confirmed_at,
            phone_verified: !!currentUser.phone_confirmed_at,
            profile_complete: false,
            has_families: false,
            two_factor_enabled: false,
          },
          partial_data: true,
          error: 'Could not fetch complete profile data',
        },
        'User data retrieved with limited information',
        200,
        corsOptions
      );
    }

  } catch (error) {
    console.error('User profile error:', error);

    // Log error
    if (securityContext) {
      await logAuditEvent(
        'user_profile_error',
        'user_data',
        'User profile request failed',
        {
          eventData: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          severity: 'medium',
          success: false,
          securityContext,
        }
      );
    }

    if (error instanceof AuthError) {
      return createErrorResponse(error, corsOptions);
    }

    return createErrorResponse(
      new AuthError('Failed to retrieve user profile', 'USER_PROFILE_ERROR', 500),
      corsOptions
    );
  }
}