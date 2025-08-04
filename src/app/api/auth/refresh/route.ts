import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { refreshTokenSchema } from '@/lib/validations/auth';
import { 
  withAuth, 
  createErrorResponse, 
  createSuccessResponse, 
  createValidationErrorResponse 
} from '@/lib/auth/middleware';
import { 
  AuthError, 
  getSecurityContext,
  logAuditEvent
} from '@/lib/auth/utils';
import { rateLimiter } from '@/lib/auth/rate-limit';
import { ZodError } from 'zod';
import { SecurityContext } from '@/types/auth';

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
    rateLimit: { endpoint: 'auth:refresh' },
    cors: corsOptions,
  });
  
  if (middlewareResponse) {
    return middlewareResponse;
  }

  let requestBody: unknown;
  let securityContext: SecurityContext | null = null;
  let userId: string | null = null;

  try {
    // Parse request body
    requestBody = await request.json();
    securityContext = await getSecurityContext() as SecurityContext;

    // Validate input
    const validatedData = refreshTokenSchema.parse(requestBody);

    const supabase = await createClient();

    try {
      // Refresh the session using Supabase Auth
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: validatedData.refresh_token,
      });

      if (refreshError) {
        console.error('Supabase token refresh error:', refreshError instanceof Error ? refreshError.message : "Unknown error");

        await rateLimiter.recordAttempt(
          'auth:refresh',
          securityContext.ip_address,
          securityContext.user_agent,
          false
        );

        // Log failed refresh attempt
        await logAuditEvent(
          'token_refresh_failed',
          'authentication',
          'Token refresh failed',
          {
            eventData: {
              error: refreshError.message,
              ip_address: securityContext.ip_address,
              refresh_token_partial: validatedData.refresh_token.substring(0, 8),
            },
            severity: 'medium',
            success: false,
            securityContext,
          }
        );

        let errorMessage = 'Invalid or expired refresh token';
        let errorCode = 'INVALID_REFRESH_TOKEN';

        if (refreshError.message.includes('expired')) {
          errorMessage = 'Refresh token has expired';
          errorCode = 'TOKEN_EXPIRED';
        } else if (refreshError.message.includes('invalid')) {
          errorMessage = 'Invalid refresh token';
          errorCode = 'INVALID_TOKEN';
        } else if (refreshError.message.includes('revoked')) {
          errorMessage = 'Refresh token has been revoked';
          errorCode = 'TOKEN_REVOKED';
        }

        throw new AuthError(errorMessage, errorCode, 401);
      }

      if (!refreshData?.session || !refreshData?.user) {
        throw new AuthError('Token refresh failed', 'REFRESH_FAILED', 401);
      }

      userId = refreshData.user.id;

      // Update session activity in our database
      try {
        const { error: sessionUpdateError } = await supabase
          .from('user_sessions')
          .update({
            last_activity_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('is_active', true);

        if (sessionUpdateError) {
          console.error('Error updating session activity during refresh:', sessionUpdateError instanceof Error ? sessionUpdateError.message : "Unknown error");
          // Don't throw error, token refresh was successful
        }
      } catch (sessionError) {
        console.error('Session update error during refresh:', sessionError instanceof Error ? sessionError.message : 'Unknown error');
        // Don't throw error, token refresh was successful
      }

      // Record successful attempt
      await rateLimiter.recordAttempt(
        'auth:refresh',
        securityContext.ip_address,
        securityContext.user_agent,
        true
      );

      // Log successful token refresh
      await logAuditEvent(
        'token_refresh_completed',
        'authentication',
        'Token refresh completed successfully',
        {
          actorUserId: userId || undefined,
          eventData: {
            email: refreshData.user.email,
            new_expires_at: refreshData.session.expires_at,
          },
          severity: 'low',
          securityContext,
        }
      );

      // Prepare response data
      const responseData = {
        session: {
          access_token: refreshData.session.access_token,
          refresh_token: refreshData.session.refresh_token,
          expires_at: refreshData.session.expires_at,
          expires_in: refreshData.session.expires_in,
          token_type: refreshData.session.token_type,
        },
        user: {
          id: refreshData.user.id,
          email: refreshData.user.email,
          email_confirmed_at: refreshData.user.email_confirmed_at,
          phone_confirmed_at: refreshData.user.phone_confirmed_at,
          created_at: refreshData.user.created_at,
          updated_at: refreshData.user.updated_at,
        },
      };

      return createSuccessResponse(
        responseData,
        'Token refreshed successfully',
        200,
        corsOptions
      );

    } catch (refreshProcessError) {
      console.error('Token refresh processing error:', refreshProcessError instanceof Error ? refreshProcessError.message : "Unknown error");
      
      // Log detailed error
      await logAuditEvent(
        'token_refresh_processing_error',
        'authentication',
        'Error processing token refresh',
        {
          actorUserId: userId || undefined,
          eventData: {
            error: refreshProcessError instanceof Error ? refreshProcessError.message : 'Unknown error',
          },
          severity: 'medium',
          success: false,
          securityContext,
        }
      );

      throw refreshProcessError;
    }

  } catch (error) {
    console.error('Token refresh error:', error);

    // Record failed attempt for rate limiting
    if (securityContext) {
      await rateLimiter.recordAttempt(
        'auth:refresh',
        securityContext.ip_address,
        securityContext.user_agent,
        false
      );
    }

    // Log failed refresh attempt
    if (securityContext) {
      await logAuditEvent(
        'token_refresh_failed',
        'authentication',
        'Token refresh attempt failed',
        {
          actorUserId: userId || undefined,
          eventData: {
            error: error instanceof Error ? error.message : 'Unknown error',
            has_refresh_token: !!(requestBody as { refresh_token?: string })?.refresh_token,
          },
          severity: 'medium',
          success: false,
          securityContext,
        }
      );
    }

    // Handle different error types
    if (error instanceof ZodError) {
      const errors: Record<string, string[]> = {};
      error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      });
      return createValidationErrorResponse(errors, corsOptions);
    }

    if (error instanceof AuthError) {
      return createErrorResponse(error, corsOptions);
    }

    return createErrorResponse(
      new AuthError('An unexpected error occurred during token refresh', 'INTERNAL_ERROR', 500),
      corsOptions
    );
  }
}