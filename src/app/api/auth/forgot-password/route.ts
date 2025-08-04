import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { forgotPasswordSchema } from '@/lib/validations/auth';
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
  sanitizeEmail,
  generateSecureToken,
  generateTokenHash
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
    rateLimit: { endpoint: 'auth:forgot-password' },
    cors: corsOptions,
  });
  
  if (middlewareResponse) {
    return middlewareResponse;
  }

  let requestBody: unknown;
  let securityContext: SecurityContext | null = null;
  let email: string | null = null;

  try {
    // Parse request body
    requestBody = await request.json();
    securityContext = await getSecurityContext() as SecurityContext;

    // Validate input
    const validatedData = forgotPasswordSchema.parse(requestBody);
    email = sanitizeEmail(validatedData.email);

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Check if user exists (but don't reveal this information in response)
    const { data: userData, error: userError } = await adminClient.auth.admin.listUsers();
    
    let userExists = false;
    let userId: string | null = null;
    
    if (!userError && userData?.users) {
      const foundUser = userData.users.find(user => user.email === email);
      if (foundUser) {
        userExists = true;
        userId = foundUser.id;
      }
    }

    if (userExists && userId) {
      try {
        // Generate password reset token
        const resetToken = generateSecureToken(32);
        const tokenHash = generateTokenHash(resetToken);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Store reset token in database
        const { error: tokenError } = await supabase
          .from('auth_tokens')
          .insert({
            token_hash: tokenHash,
            token_type: 'password_reset',
            token_status: 'active',
            user_id: userId,
            email: email,
            expires_at: expiresAt.toISOString(),
            max_uses: 1,
            uses_count: 0,
            metadata: validatedData.redirect_url ? {
              redirect_url: validatedData.redirect_url
            } : null,
          });

        if (tokenError) {
          console.error('Error creating password reset token:', tokenError?.message || 'Unknown error');
          throw new AuthError('Failed to create password reset token', 'TOKEN_CREATION_FAILED', 500);
        }

        // Send password reset email using Supabase Auth
        const resetUrl = validatedData.redirect_url 
          ? `${validatedData.redirect_url}?token=${resetToken}&type=recovery`
          : `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password?token=${resetToken}`;

        const { error: emailError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: resetUrl,
        });

        if (emailError) {
          console.error('Error sending password reset email:', emailError?.message || 'Unknown error');
          // Don't throw error here, we'll still log the attempt
        }

        // Log successful password reset request
        await logAuditEvent(
          'password_reset_requested',
          'authentication',
          'Password reset requested successfully',
          {
            actorUserId: userId,
            eventData: {
              email,
              reset_token_id: tokenHash.substring(0, 8), // Log partial hash for tracking
              redirect_url: validatedData.redirect_url,
            },
            securityContext,
          }
        );

      } catch (resetError) {
        console.error('Password reset process error:', resetError instanceof Error ? resetError.message : 'Unknown error');
        
        // Log failed password reset
        await logAuditEvent(
          'password_reset_failed',
          'authentication',
          'Password reset request failed',
          {
            actorUserId: userId,
            eventData: {
              email,
              error: resetError instanceof Error ? resetError.message : 'Unknown error',
            },
            severity: 'medium',
            success: false,
            securityContext,
          }
        );

        throw resetError;
      }
    } else {
      // User doesn't exist, but don't reveal this information
      // Log the attempt for security monitoring
      await logAuditEvent(
        'password_reset_attempted_nonexistent',
        'security',
        'Password reset attempted for non-existent email',
        {
          eventData: {
            email,
            ip_address: securityContext.ip_address,
          },
          severity: 'low',
          securityContext,
        }
      );
    }

    // Record attempt for rate limiting
    await rateLimiter.recordAttempt(
      'auth:forgot-password',
      securityContext.ip_address,
      securityContext.user_agent,
      true, // Always record as success to prevent enumeration
      email
    );

    // Always return success to prevent email enumeration
    return createSuccessResponse(
      { 
        email_sent: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      },
      'Password reset email sent if account exists',
      200,
      corsOptions
    );

  } catch (error) {
    console.error('Forgot password error:', error);

    // Record failed attempt for rate limiting
    if (securityContext && email) {
      await rateLimiter.recordAttempt(
        'auth:forgot-password',
        securityContext.ip_address,
        securityContext.user_agent,
        false,
        email
      );
    }

    // Log failed attempt
    if (securityContext) {
      await logAuditEvent(
        'password_reset_error',
        'authentication',
        'Password reset request encountered error',
        {
          eventData: {
            email: email || (requestBody as { email?: string })?.email,
            error: error instanceof Error ? error.message : 'Unknown error',
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
      new AuthError('An unexpected error occurred while processing password reset', 'INTERNAL_ERROR', 500),
      corsOptions
    );
  }
}