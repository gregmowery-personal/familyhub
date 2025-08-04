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
  getServerUser
} from '@/lib/auth/utils';
import { SecurityContext, AuthUser } from '@/types/auth';

const corsOptions = {
  origins: ['http://localhost:3000', 'https://familyhub.care'],
  methods: ['POST', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization'],
};

export async function OPTIONS(request: NextRequest) {
  const middlewareResponse = await withAuth(request, { cors: corsOptions });
  return middlewareResponse || new Response(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  // Apply middleware
  const middlewareResponse = await withAuth(request, {
    cors: corsOptions,
  });
  
  if (middlewareResponse) {
    return middlewareResponse;
  }

  let securityContext: SecurityContext | null = null;
  let currentUser: AuthUser | null = null;

  try {
    securityContext = await getSecurityContext() as SecurityContext;
    
    // Get current user (optional for logout)
    currentUser = await getServerUser() as AuthUser;
    
    const supabase = await createClient();

    // If user is authenticated, perform authenticated logout
    if (currentUser) {
      try {
        // Invalidate current session in Supabase
        const { error: signOutError } = await supabase.auth.signOut();
        
        if (signOutError) {
          console.error('Supabase sign out error:', signOutError instanceof Error ? signOutError.message : "Unknown error");
          // Don't throw error, continue with cleanup
        }

        // Update user session status in our database
        const { error: sessionError } = await supabase
          .from('user_sessions')
          .update({
            is_active: false,
            last_activity_at: new Date().toISOString(),
          })
          .eq('user_id', currentUser.id)
          .eq('is_active', true);

        if (sessionError) {
          console.error('Error updating session status:', sessionError instanceof Error ? sessionError.message : "Unknown error");
          // Don't throw error, logout can still succeed
        }

        // Log successful logout
        await logAuditEvent(
          'user_logout',
          'authentication',
          'User logged out successfully',
          {
            actorUserId: currentUser.id,
            eventData: {
              email: currentUser.email,
              logout_method: 'explicit',
            },
            securityContext,
          }
        );

        return createSuccessResponse(
          { logged_out: true },
          'Logged out successfully',
          200,
          corsOptions
        );

      } catch (authLogoutError) {
        console.error('Authenticated logout error:', authLogoutError instanceof Error ? authLogoutError.message : 'Unknown error');
        
        // Log failed logout attempt
        await logAuditEvent(
          'user_logout_failed',
          'authentication',
          'User logout attempt failed',
          {
            actorUserId: currentUser.id,
            eventData: {
              email: currentUser.email,
              error: authLogoutError instanceof Error ? authLogoutError.message : 'Unknown error',
            },
            severity: 'low',
            success: false,
            securityContext,
          }
        );

        // Even if there's an error, try to clear the session client-side
        return createSuccessResponse(
          { logged_out: true, partial: true },
          'Logout completed with some errors. Please clear your browser cache.',
          200,
          corsOptions
        );
      }
    } else {
      // No authenticated user, but still clear any potential session
      try {
        const { error: signOutError } = await supabase.auth.signOut();
        
        if (signOutError) {
          console.error('Unauthenticated sign out error:', signOutError instanceof Error ? signOutError.message : "Unknown error");
        }
      } catch (error) {
        console.error('Error during unauthenticated logout:', error);
      }

      // Log anonymous logout attempt
      await logAuditEvent(
        'anonymous_logout',
        'authentication',
        'Anonymous logout attempt',
        {
          eventData: {
            logout_method: 'explicit',
            had_session: false,
          },
          severity: 'low',
          securityContext,
        }
      );

      return createSuccessResponse(
        { logged_out: true },
        'Logged out successfully',
        200,
        corsOptions
      );
    }

  } catch (error) {
    console.error('Logout error:', error);

    // Log failed logout attempt
    if (securityContext) {
      await logAuditEvent(
        'logout_error',
        'authentication',
        'Logout process encountered an error',
        {
          actorUserId: currentUser?.id,
          eventData: {
            email: currentUser?.email,
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

    // For logout, we generally want to succeed even if there are errors
    // This ensures the client can clear its session state
    return createSuccessResponse(
      { logged_out: true, partial: true },
      'Logout completed with some errors. Please clear your browser cache.',
      200,
      corsOptions
    );
  }
}