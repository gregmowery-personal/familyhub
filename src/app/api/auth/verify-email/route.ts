import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { verifyEmailSchema } from '@/lib/validations/auth';
import { emailService } from '@/lib/email/prototype-email-service';
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
    const adminClient = createAdminClient();

    // For Supabase Auth verification, we'll handle the token directly
    const verificationType = validatedData.type || 'signup';
    
    let verificationSuccessful = false;
    let userEmail: string | null = null;
    let firstName: string | null = null;

    // First, try our custom verification table
    try {
      let customVerification;
      
      // Check if using code or token
      if (validatedData.code) {
        // Verify by 6-digit code
        const { data } = await supabase
          .from('email_verifications')
          .select('*')
          .eq('verification_code', validatedData.code)
          .eq('type', verificationType)
          .is('verified_at', null)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        customVerification = data;
      } else if (validatedData.token) {
        // Verify by token (backward compatibility)
        const { data } = await supabase
          .from('email_verifications')
          .select('*')
          .eq('token', validatedData.token)
          .eq('type', verificationType)
          .single();
        customVerification = data;
      }
        
      if (customVerification) {
        // Check if already verified
        if (customVerification.verified_at) {
          throw new AuthError('Email already verified', 'ALREADY_VERIFIED', 400);
        }
        
        // Check if token is expired
        if (new Date(customVerification.expires_at) < new Date()) {
          throw new AuthError('Verification token has expired', 'TOKEN_EXPIRED', 400);
        }
        
        // Mark as verified
        const { error: updateError } = await supabase
          .from('email_verifications')
          .update({ verified_at: new Date().toISOString() })
          .eq('id', customVerification.id);
          
        if (updateError) {
          console.error('Failed to update verification status:', updateError);
        }
        
        // Mark user's email as confirmed in Supabase Auth
        const { error: confirmError } = await adminClient.auth.admin.updateUserById(
          customVerification.user_id,
          { 
            email_confirm: true 
          }
        );
        
        if (confirmError) {
          console.error('Failed to confirm email in Supabase Auth:', confirmError);
        }
        
        // Get user details
        const { data: userData } = await adminClient.auth.admin.getUserById(customVerification.user_id);
        
        if (userData?.user) {
          userId = userData.user.id;
          userEmail = userData.user.email || customVerification.email;
          
          // Log successful verification
          console.log('\n✅ EMAIL VERIFIED SUCCESSFULLY');
          console.log('=====================================');
          console.log(`📧 Email: ${userEmail}`);
          if (validatedData.code) {
            console.log(`🔑 Verification Code Used: ${validatedData.code}`);
          }
          console.log(`🕑 Verified at: ${new Date().toISOString()}`);
          console.log(`📧 Supabase email confirmed: ${!confirmError ? 'Yes' : 'Failed'}`);
          console.log('=====================================\n');
          
          verificationSuccessful = true;
        }
      }
    } catch (customError) {
      // If custom verification fails, try Supabase Auth
      if (customError instanceof AuthError) {
        throw customError;
      }
    }

    // If custom verification didn't work and we have a token, try Supabase Auth
    if (!verificationSuccessful && validatedData.token) {
      try {
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: validatedData.token,
          type: verificationType === 'signup' ? 'signup' : 'email_change',
        });

        if (verifyError) {
          console.error('Supabase email verification error:', verifyError.message);

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

        if (verifyData?.user) {
          userId = verifyData.user.id;
          userEmail = verifyData.user.email || null;
          verificationSuccessful = true;
        }
      } catch (otpError) {
        if (otpError instanceof AuthError) {
          throw otpError;
        }
        throw new AuthError('Email verification failed', 'VERIFICATION_FAILED', 400);
      }
    }

    if (!verificationSuccessful || !userId) {
      throw new AuthError('Email verification failed', 'VERIFICATION_FAILED', 400);
    }

    // Update user profile if this is first verification
    if (verificationType === 'signup') {
      try {
        // Check if user profile exists
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, first_name')
          .eq('id', userId)
          .single();

        if (!profileError && profile) {
          firstName = profile.first_name;
          // Profile exists, send welcome email
          try {
            const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`;
            await emailService.sendWelcomeEmail({
              email: userEmail || '',
              name: firstName || undefined,
              dashboardUrl
            });
          } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
            // Don't fail verification if email fails in prototype
          }
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
            console.error('Error creating user profile after verification:', createProfileError.message);
            // Don't fail the request, verification was successful
          }
          
          // Send welcome email for new profile
          try {
            const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`;
            await emailService.sendWelcomeEmail({
              email: userEmail || '',
              dashboardUrl
            });
          } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
          }
        }
      } catch (profileError) {
        console.error('Profile processing error during verification:', profileError);
        // Don't fail the request, verification was successful
      }
    }

    // Record successful attempt
    await rateLimiter.recordAttempt(
      'auth:verify-email',
      securityContext.ip_address,
      securityContext.user_agent,
      true,
      userEmail || undefined
    );

    // Log successful verification
    await logAuditEvent(
      'email_verification_successful',
      'authentication',
      'Email successfully verified',
      {
        actorUserId: userId,
        eventData: {
          verification_type: verificationType,
          email: userEmail || 'unknown',
        },
        severity: 'low',
        success: true,
        securityContext,
      }
    );

    // Generate session tokens for the verified user
    let sessionData = null;
    if (userId && userEmail) {
      try {
        // Generate a one-time login link to get session tokens
        const { data: linkResponse, error: linkError } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: userEmail
        });
        
        if (linkError) {
          throw linkError;
        }
        
        if (linkResponse?.properties?.action_link) {
          const actionUrl = new URL(linkResponse.properties.action_link);
          const accessToken = actionUrl.searchParams.get('access_token');
          const refreshToken = actionUrl.searchParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            // Test the tokens by creating a temporary client
            const testClient = await createClient();
            const { data: sessionTest } = await testClient.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (sessionTest?.session) {
              sessionData = {
                access_token: accessToken,
                refresh_token: refreshToken
              };
              
              console.log('🔑 Valid session tokens generated for verified user');
            }
          }
        }
      } catch (sessionError) {
        console.error('Failed to generate session for verified user:', sessionError);
        // Don't fail verification if session creation fails - just log the issue
      }
    }

    return createSuccessResponse(
      { 
        verified: true, 
        message: 'Email successfully verified',
        session: sessionData
      },
      200
    );

  } catch (error) {
    // Handle validation errors
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }

    // Handle auth errors
    if (error instanceof AuthError) {
      // Log the error
      if (securityContext) {
        await logAuditEvent(
          'email_verification_error',
          'authentication',
          error.message,
          {
            actorUserId: userId || undefined,
            eventData: {
              error_code: error.code,
              error_message: error.message,
            },
            severity: 'medium',
            success: false,
            securityContext,
          }
        );
      }

      return createErrorResponse(
        error.message,
        error.statusCode,
        error.code
      );
    }

    // Handle unexpected errors
    console.error('Unexpected error in email verification:', error);
    
    if (securityContext) {
      await logAuditEvent(
        'email_verification_system_error',
        'authentication',
        'System error during email verification',
        {
          actorUserId: userId || undefined,
          eventData: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          severity: 'high',
          success: false,
          securityContext,
        }
      );
    }

    return createErrorResponse(
      'An unexpected error occurred during email verification',
      500,
      'INTERNAL_SERVER_ERROR'
    );
  }
}