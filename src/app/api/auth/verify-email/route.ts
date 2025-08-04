import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyEmailSchema } from '@/lib/validations/auth';
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
    rateLimit: { endpoint: 'auth:verify-email' },
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
    const validatedData = verifyEmailSchema.parse(requestBody);

    const supabase = await createClient();

    // For Supabase Auth verification, we'll handle the token directly
    const verificationType = validatedData.type || 'signup';

    try {
      // Verify email using Supabase Auth
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: validatedData.token,
        type: verificationType === 'signup' ? 'signup' : 'email_change',
      });

      if (verifyError) {
        console.error('Supabase email verification error:', verifyError instanceof Error ? verifyError.message : "Unknown error");

        await rateLimiter.recordAttempt(
          'auth:verify-email',
          securityContext.ip_address,
          securityContext.user_agent,
          false
        );

        // Log failed verification
        await logAuditEvent(
          'email_verification_failed',
          'authentication',
          'Email verification failed',
          {
            eventData: {
              token_partial: validatedData.token.substring(0, 8),
              verification_type: verificationType,
              error: verifyError.message,
              ip_address: securityContext.ip_address,
            },
            severity: 'medium',
            success: false,
            securityContext,
          }
        );

        let errorMessage = 'Invalid or expired verification token';
        let errorCode = 'INVALID_VERIFICATION_TOKEN';

        if (verifyError.message.includes('expired')) {
          errorMessage = 'Verification token has expired';
          errorCode = 'TOKEN_EXPIRED';
        } else if (verifyError.message.includes('invalid')) {
          errorMessage = 'Invalid verification token';
          errorCode = 'INVALID_TOKEN';
        }

        throw new AuthError(errorMessage, errorCode, 400);
      }

      if (!verifyData?.user) {
        throw new AuthError('Email verification failed', 'VERIFICATION_FAILED', 400);
      }

      userId = verifyData.user.id;

      // Handle our custom verification tokens if needed
      if (validatedData.token.length === 64) { // Our custom token format
        try {
          const tokenResult = await verifyAndConsumeToken(
            validatedData.token,
            'email_verification'
          );

          if (!tokenResult.valid) {
            // Log custom token verification failure
            await logAuditEvent(
              'custom_email_verification_failed',
              'authentication',
              'Custom email verification token failed',
              {
                actorUserId: userId || undefined,
                eventData: {
                  token_partial: validatedData.token.substring(0, 8),
                  error: tokenResult.error,
                },
                severity: 'medium',
                success: false,
                securityContext,
              }
            );
          }
        } catch (customTokenError) {
          console.error('Custom token verification error:', customTokenError instanceof Error ? customTokenError.message : "Unknown error");
          // Don't fail the request if Supabase verification succeeded
        }
      }

      // Update user profile if this is first verification
      if (verificationType === 'signup') {
        try {
          // Check if user profile exists and update verification status
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('id', userId)
            .single();

          if (!profileError && profile) {
            // Profile exists, no need to create
          } else if (profileError?.code === 'PGRST116') {
            // Profile doesn't exist, create basic profile
            const { error: createProfileError } = await supabase
              .from('user_profiles')
              .insert({
                id: userId,
                preferred_language: 'en',
                timezone: 'UTC',
                notification_preferences: {},
                accessibility_preferences: {},
                two_factor_enabled: false,
              });

            if (createProfileError) {
              console.error('Error creating user profile after verification:', createProfileError instanceof Error ? createProfileError.message : "Unknown error");
              // Don't fail the request, verification was successful
            }
          }
        } catch (profileError) {
          console.error('Profile processing error during verification:', profileError instanceof Error ? profileError.message : "Unknown error");
          // Don't fail the request, verification was successful
        }
      }

      // Record successful attempt
      await rateLimiter.recordAttempt(
        'auth:verify-email',
        securityContext.ip_address,
        securityContext.user_agent,
        true
      );

      // Log successful verification
      await logAuditEvent(
        'email_verification_completed',
        'authentication',
        'Email verification completed successfully',
        {
          actorUserId: userId || undefined,
          eventData: {
            email: verifyData.user.email,
            verification_type: verificationType,
            is_first_verification: verificationType === 'signup',
          },
          securityContext,
        }
      );

      // Clear any failed attempts for this IP
      await rateLimiter.clearRateLimit('auth:verify-email', securityContext.ip_address);

      return createSuccessResponse(
        {
          email_verified: true,
          user: {
            id: verifyData.user.id,
            email: verifyData.user.email,
            email_confirmed_at: verifyData.user.email_confirmed_at,
          },
          session: verifyData.session ? {
            access_token: verifyData.session.access_token,
            refresh_token: verifyData.session.refresh_token,
            expires_at: verifyData.session.expires_at,
            expires_in: verifyData.session.expires_in,
            token_type: verifyData.session.token_type,
          } : null,
          verification_type: verificationType,
        },
        'Email verified successfully',
        200,
        corsOptions
      );

    } catch (verificationError) {
      console.error('Email verification processing error:', verificationError instanceof Error ? verificationError.message : "Unknown error");
      
      // Log detailed error
      await logAuditEvent(
        'email_verification_error',
        'authentication',
        'Error processing email verification',
        {
          actorUserId: userId || undefined,
          eventData: {
            error: verificationError instanceof Error ? verificationError.message : 'Unknown error',
            verification_type: verificationType,
          },
          severity: 'medium',
          success: false,
          securityContext,
        }
      );

      throw verificationError;
    }

  } catch (error) {
    console.error('Verify email error:', error);

    // Record failed attempt for rate limiting
    if (securityContext) {
      await rateLimiter.recordAttempt(
        'auth:verify-email',
        securityContext.ip_address,
        securityContext.user_agent,
        false
      );
    }

    // Log failed verification attempt
    if (securityContext) {
      await logAuditEvent(
        'email_verification_failed',
        'authentication',
        'Email verification attempt failed',
        {
          actorUserId: userId || undefined,
          eventData: {
            error: error instanceof Error ? error.message : 'Unknown error',
            token_provided: !!(requestBody as { token?: string })?.token,
            verification_type: (requestBody as { type?: string })?.type || 'signup',
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
      new AuthError('An unexpected error occurred during email verification', 'INTERNAL_ERROR', 500),
      corsOptions
    );
  }
}