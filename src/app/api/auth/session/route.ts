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
  getUserProfile,
  getUserFamilies
} from '@/lib/auth/utils';
import { SecurityContext, Family } from '@/types/auth';

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
  // Apply middleware (no rate limiting for session checks)
  const middlewareResponse = await withAuth(request, {
    cors: corsOptions,
  });
  
  if (middlewareResponse) {
    return middlewareResponse;
  }

  let securityContext: SecurityContext | null = null;

  try {
    securityContext = await getSecurityContext() as SecurityContext;
    
    const supabase = await createClient();
    
    // Get current authenticated user (more secure than getSession)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Error getting user:', authError?.message || "Unknown error");
      
      if (authError) {
        await logAuditEvent(
          'session_check_error',
          'authentication',
          'Error checking session',
          {
            eventData: {
              error: authError.message,
            },
            severity: 'low',
            success: false,
            securityContext,
          }
        );
      }
      
      return createSuccessResponse(
        {
          authenticated: false,
          session: null,
          user: null,
          profile: null,
          families: [],
        },
        'No active session',
        200,
        corsOptions
      );
    }

    // No active user
    if (!user) {
      return createSuccessResponse(
        {
          authenticated: false,
          session: null,
          user: null,
          profile: null,
          families: [],
        },
        'No active session',
        200,
        corsOptions
      );
    }

    const userId = user.id;

    // Now that we've verified the user, get the session for response data
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return createSuccessResponse(
        {
          authenticated: false,
          session: null,
          user: null,
          profile: null,
          families: [],
        },
        'No active session',
        200,
        corsOptions
      );
    }

    try {
      // Get additional user data
      const [profile, families] = await Promise.all([
        getUserProfile(userId),
        getUserFamilies(userId)
      ]);

      // Update last activity in our session tracking
      const { error: updateError } = await supabase
        .from('user_sessions')
        .update({
          last_activity_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (updateError) {
        console.error('Error updating session activity:', updateError instanceof Error ? updateError.message : "Unknown error");
        // Don't throw error, session is still valid
      }

      // Log session check (only for first check or periodic checks to avoid spam)
      const sessionAge = session.expires_at ? Date.now() - new Date(session.expires_at).getTime() : 0;
      const shouldLog = sessionAge < 300000; // Only log if session is less than 5 minutes old
      
      if (shouldLog) {
        await logAuditEvent(
          'session_verified',
          'authentication',
          'Session verified successfully',
          {
            actorUserId: userId,
            eventData: {
              email: session.user.email,
              session_age: sessionAge,
              family_count: families.length,
            },
            severity: 'low',
            securityContext,
          }
        );
      }

      // Prepare response data
      const responseData = {
        authenticated: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          expires_in: session.expires_in,
          token_type: session.token_type,
        },
        user: {
          id: session.user.id,
          email: session.user.email,
          email_confirmed_at: session.user.email_confirmed_at,
          phone_confirmed_at: session.user.phone_confirmed_at,
          created_at: session.user.created_at,
          updated_at: session.user.updated_at,
        },
        profile,
        families: families.map((family: Family & { user_role?: string; is_family_admin?: boolean }) => ({
          id: family.id,
          name: family.name,
          family_type: family.family_type,
          timezone: family.timezone,
          role: family.user_role,
          is_family_admin: family.is_family_admin,
        })),
      };

      return createSuccessResponse(
        responseData,
        'Session active',
        200,
        corsOptions
      );

    } catch (dataError) {
      console.error('Error fetching user data:', dataError instanceof Error ? dataError.message : "Unknown error");
      
      // Log error but still return basic session info
      await logAuditEvent(
        'session_data_error',
        'authentication',
        'Error fetching session data',
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

      // Return basic session info without additional data
      return createSuccessResponse(
        {
          authenticated: true,
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            expires_in: session.expires_in,
            token_type: session.token_type,
          },
          user: {
            id: session.user.id,
            email: session.user.email,
            email_confirmed_at: session.user.email_confirmed_at,
            phone_confirmed_at: session.user.phone_confirmed_at,
            created_at: session.user.created_at,
            updated_at: session.user.updated_at,
          },
          profile: null,
          families: [],
          partial_data: true,
        },
        'Session active with limited data',
        200,
        corsOptions
      );
    }

  } catch (error) {
    console.error('Session check error:', error);

    // Log session check error
    if (securityContext) {
      await logAuditEvent(
        'session_check_error',
        'authentication',
        'Session check failed',
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

    // For session checks, default to returning no session rather than error
    return createSuccessResponse(
      {
        authenticated: false,
        session: null,
        user: null,
        profile: null,
        families: [],
        error: 'Session check failed',
      },
      'Unable to verify session',
      200,
      corsOptions
    );
  }
}