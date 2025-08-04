import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resetPasswordSchema } from '@/lib/validations/auth';
import { 
  withAuth, 
  createErrorResponse, 
  createSuccessResponse, 
  createValidationErrorResponse 
} from '@/lib/auth/middleware';
import { 
  AuthError, 
  getSecurityContext,
  logAuditEvent,
  calculatePasswordStrength,
  verifyAndConsumeToken
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
    rateLimit: { endpoint: 'auth:reset-password' },
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
    const validatedData = resetPasswordSchema.parse(requestBody);

    // Check password strength
    const passwordStrength = calculatePasswordStrength(validatedData.password);
    if (passwordStrength < 5) {
      throw new AuthError(
        'Password is too weak. Please choose a stronger password.',
        'WEAK_PASSWORD',
        400
      );
    }

    const supabase = await createClient();

    // Verify and consume the reset token
    const tokenResult = await verifyAndConsumeToken(
      validatedData.token,
      'password_reset'
    );

    if (!tokenResult.valid) {
      await rateLimiter.recordAttempt(
        'auth:reset-password',
        securityContext.ip_address,
        securityContext.user_agent,
        false
      );

      // Log failed token verification
      await logAuditEvent(
        'password_reset_token_invalid',
        'security',
        'Invalid password reset token used',
        {
          eventData: {
            token_partial: validatedData.token.substring(0, 8),
            error: tokenResult.error,
            ip_address: securityContext.ip_address,
          },
          severity: 'high',
          success: false,
          securityContext,
        }
      );

      throw new AuthError(
        tokenResult.error || 'Invalid or expired reset token',
        'INVALID_RESET_TOKEN',
        400
      );
    }

    const tokenData = tokenResult.data as { user_id?: string; id?: string };
    userId = tokenData?.user_id || null;

    if (!userId) {
      throw new AuthError('Invalid reset token data', 'INVALID_TOKEN_DATA', 400);
    }

    try {
      // Get user information
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
      
      if (userError || !userData?.user) {
        console.error('Error getting user for password reset:', userError instanceof Error ? userError.message : "Unknown error");
        throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
      }

      const user = userData.user;

      // Update password using Supabase Admin API
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { password: validatedData.password }
      );

      if (updateError) {
        console.error('Error updating password:', updateError instanceof Error ? updateError.message : "Unknown error");
        
        await rateLimiter.recordAttempt(
          'auth:reset-password',
          securityContext.ip_address,
          securityContext.user_agent,
          false
        );

        // Log failed password update
        await logAuditEvent(
          'password_reset_update_failed',
          'authentication',
          'Password update failed during reset',
          {
            actorUserId: userId || undefined,
            eventData: {
              email: user.email,
              error: updateError.message,
            },
            severity: 'high',
            success: false,
            securityContext,
          }
        );

        let errorMessage = 'Failed to update password';
        let errorCode = 'PASSWORD_UPDATE_FAILED';

        if (updateError.message.includes('password')) {
          errorMessage = 'Password does not meet requirements';
          errorCode = 'INVALID_PASSWORD';
        }

        throw new AuthError(errorMessage, errorCode, 400);
      }

      // Invalidate all existing sessions for security (handled by password update)

      // Update session status in our database
      const { error: sessionError } = await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          last_activity_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (sessionError) {
        console.error('Error updating session status after password reset:', sessionError instanceof Error ? sessionError.message : "Unknown error");
        // Don't throw error, password was updated successfully
      }

      // Record successful attempt
      await rateLimiter.recordAttempt(
        'auth:reset-password',
        securityContext.ip_address,
        securityContext.user_agent,
        true
      );

      // Log successful password reset
      await logAuditEvent(
        'password_reset_completed',
        'authentication',
        'Password reset completed successfully',
        {
          actorUserId: userId || undefined,
          eventData: {
            email: user.email,
            password_strength: passwordStrength,
            sessions_invalidated: true,
          },
          securityContext,
        }
      );

      // Clear any failed attempts for this IP
      await rateLimiter.clearRateLimit('auth:reset-password', securityContext.ip_address);

      return createSuccessResponse(
        {
          password_updated: true,
          sessions_invalidated: true,
          message: 'Password updated successfully. Please log in with your new password.',
        },
        'Password reset completed successfully',
        200,
        corsOptions
      );

    } catch (resetError) {
      console.error('Password reset processing error:', resetError instanceof Error ? resetError.message : "Unknown error");
      
      // Log detailed error
      await logAuditEvent(
        'password_reset_processing_error',
        'authentication',
        'Error processing password reset',
        {
          actorUserId: userId || undefined,
          eventData: {
            error: resetError instanceof Error ? resetError.message : 'Unknown error',
            token_id: tokenData.id,
          },
          severity: 'high',
          success: false,
          securityContext,
        }
      );

      throw resetError;
    }

  } catch (error) {
    console.error('Reset password error:', error);

    // Record failed attempt for rate limiting
    if (securityContext) {
      await rateLimiter.recordAttempt(
        'auth:reset-password',
        securityContext.ip_address,
        securityContext.user_agent,
        false
      );
    }

    // Log failed reset attempt
    if (securityContext) {
      await logAuditEvent(
        'password_reset_failed',
        'authentication',
        'Password reset attempt failed',
        {
          actorUserId: userId || undefined,
          eventData: {
            error: error instanceof Error ? error.message : 'Unknown error',
            token_provided: !!(requestBody as { token?: string })?.token,
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
      new AuthError('An unexpected error occurred during password reset', 'INTERNAL_ERROR', 500),
      corsOptions
    );
  }
}