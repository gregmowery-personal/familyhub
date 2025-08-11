import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { signupSchema } from '@/lib/validations/auth';
import { emailService } from '@/lib/email/prototype-email-service';
import crypto from 'crypto';
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
  isDisposableEmail,
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
    rateLimit: { endpoint: 'auth:signup' },
    cors: corsOptions,
  });
  
  if (middlewareResponse) {
    return middlewareResponse;
  }

  let requestBody: unknown;
  let securityContext: SecurityContext | null = null;

  try {
    // Parse request body
    requestBody = await request.json();
    securityContext = await getSecurityContext() as SecurityContext;

    // Validate input
    const validatedData = signupSchema.parse(requestBody);
    
    // Additional security checks
    const email = sanitizeEmail(validatedData.email);
    
    // Check for disposable email
    if (isDisposableEmail(email)) {
      await rateLimiter.recordAttempt(
        'auth:signup',
        securityContext.ip_address,
        securityContext.user_agent,
        false,
        email
      );
      
      throw new AuthError(
        'Please use a valid email address',
        'DISPOSABLE_EMAIL_BLOCKED',
        400
      );
    }

    // Password check removed - going passwordless

    const supabase = await createClient();

    // Handle family invitation token if provided
    let familyInvitation = null as { family_id: string; role: string; invited_by: string; email?: string; metadata?: { invited_role?: string; relationship?: string } } | null;
    if (validatedData.family_invitation_token) {
      const tokenResult = await verifyAndConsumeToken(
        validatedData.family_invitation_token,
        'family_invitation'
      );
      
      if (!tokenResult.valid) {
        throw new AuthError(
          tokenResult.error || 'Invalid invitation token',
          'INVALID_INVITATION_TOKEN',
          400
        );
      }
      
      familyInvitation = tokenResult.data as { family_id: string; role: string; invited_by: string; email?: string; metadata?: { invited_role?: string; relationship?: string } };
      
      // Ensure the invitation email matches the signup email
      if (familyInvitation.email && familyInvitation.email !== email) {
        throw new AuthError(
          'Email address does not match the invitation',
          'EMAIL_MISMATCH',
          400
        );
      }
    }

    // Check if user already exists (reuse adminClient below)
    const adminClient = createAdminClient();
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const foundUser = existingUsers?.users?.find(user => user.email === email);
    if (foundUser) {
      await rateLimiter.recordAttempt(
        'auth:signup',
        securityContext.ip_address,
        securityContext.user_agent,
        false,
        email
      );
      
      throw new AuthError(
        'An account with this email address already exists',
        'USER_ALREADY_EXISTS',
        409
      );
    }

    // Create user with Supabase Auth using admin client (passwordless)
    // CRITICAL: We must use admin API to avoid sending Supabase emails
    // We use a random secure password that the user will never know or use
    const tempPassword = crypto.randomBytes(32).toString('hex');
    
    // Use admin API to create user WITHOUT sending any emails
    // CRITICAL: Set email_confirm to TRUE to prevent confirmation emails
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword, // This is never used - we're passwordless
      email_confirm: true, // Set to TRUE to skip confirmation emails entirely
      user_metadata: {
        first_name: validatedData.first_name || null,
        last_name: validatedData.last_name || null,
        phone_number: validatedData.phone_number || null,
      },
    });

    if (authError) {
      await rateLimiter.recordAttempt(
        'auth:signup',
        securityContext.ip_address,
        securityContext.user_agent,
        false,
        email
      );

      console.error('Supabase auth error:', authError?.message || 'Unknown error');
      
      // Map Supabase errors to user-friendly messages
      let errorMessage = 'Failed to create account';
      let errorCode = 'SIGNUP_FAILED';
      
      if (authError.message.includes('email')) {
        errorMessage = 'Invalid email address';
        errorCode = 'INVALID_EMAIL';
      } else if (authError.message.includes('password')) {
        errorMessage = 'Password does not meet requirements';
        errorCode = 'INVALID_PASSWORD';
      }
      
      throw new AuthError(errorMessage, errorCode, 400);
    }

    if (!authData.user) {
      throw new AuthError('Failed to create user account', 'USER_CREATION_FAILED', 500);
    }

    // Use the userId from authData
    const userId = authData.user.id;
    
    // Generate recovery code (XXXXX-XXXXX format)
    const generateRecoveryCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 10; i++) {
        if (i === 5) code += '-';
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return code;
    };
    const recoveryCode = generateRecoveryCode();
    
    // Store recovery code in database
    const { error: recoveryError } = await supabase
      .from('recovery_codes')
      .insert({
        user_id: userId,
        code_hash: crypto.createHash('sha256').update(recoveryCode).digest('hex'),
        code_hint: recoveryCode.slice(-3),
        is_active: true,
        expires_at: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString() // 2 years
      });
    
    if (recoveryError) {
      console.error('Failed to store recovery code:', recoveryError);
    }
    
    // Generate simple 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationToken = crypto.randomUUID(); // Keep for backward compatibility
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minute expiry for better security
    
    // Store verification in database
    try {
      const { error: verificationError } = await supabase
        .from('email_verifications')
        .insert({
          user_id: userId,
          email: email,
          token: verificationToken,
          verification_code: verificationCode,
          type: 'signup',
          expires_at: expiresAt.toISOString()
        });
        
      if (verificationError) {
        console.error('Failed to store verification code:', verificationError);
      }
      
      // Log verification code to console for testing
      console.log('\n✉️  EMAIL VERIFICATION CODE');
      console.log('=====================================');
      console.log(`📧 Email: ${email}`);
      console.log(`\n🔢 VERIFICATION CODE: ${verificationCode}\n`);
      console.log(`🔐 RECOVERY CODE: ${recoveryCode}`);
      console.log(`\n⏱️  Verification expires in: 15 minutes`);
      console.log(`⏱️  Recovery code expires in: 2 years`);
      console.log('=====================================\n');
      
      // Send verification email with prominent code display
      await emailService.sendVerificationCode({
        email: email,
        name: validatedData.first_name,
        code: verificationCode
      });
    } catch (emailError) {
      console.error('Failed to handle verification:', emailError);
      // Don't fail signup if email/verification fails in prototype
    }

    try {
      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          first_name: validatedData.first_name || null,
          last_name: validatedData.last_name || null,
          phone_number: validatedData.phone_number || null,
          preferred_language: 'en',
          timezone: 'UTC',
          notification_preferences: {},
          accessibility_preferences: {},
          two_factor_enabled: false,
        });

      if (profileError) {
        console.error('Error creating user profile:', profileError?.message || 'Unknown error');
        // Don't throw here, as the user was created successfully
      }

      // Handle family invitation if present
      if (familyInvitation) {
        try {
          // Get the appropriate role for the user
          const { data: roleData } = await supabase
            .from('roles')
            .select('id')
            .eq('type', familyInvitation.metadata?.invited_role || 'viewer')
            .single();

          // Add user to family
          const { error: familyMemberError } = await supabase
            .from('family_memberships')
            .insert({
              family_id: familyInvitation.family_id,
              user_id: userId,
              role_id: roleData?.id || '00000000-0000-0000-0000-000000000000', // Will need proper fallback
              relationship: familyInvitation.metadata?.relationship || null,
              display_name: null,
              status: 'active'
            });

          if (familyMemberError) {
            console.error('Error adding user to family:', familyMemberError?.message || 'Unknown error');
          } else {
            // Log successful family join
            await logAuditEvent(
              'family_member_added',
              'family',
              `User joined family via invitation`,
              {
                actorUserId: userId,
                targetFamilyId: familyInvitation.family_id,
                eventData: {
                  role: familyInvitation.metadata?.invited_role || 'adult',
                  relationship: familyInvitation.metadata?.relationship,
                  invitation_token: validatedData.family_invitation_token,
                },
                securityContext,
              }
            );
          }
        } catch (familyError) {
          console.error('Error processing family invitation:', familyError instanceof Error ? familyError.message : "Unknown error");
          // Don't throw here, user creation was successful
        }
      }

      // Record successful signup attempt
      await rateLimiter.recordAttempt(
        'auth:signup',
        securityContext.ip_address,
        securityContext.user_agent,
        true,
        email
      );

      // Log successful signup
      await logAuditEvent(
        'user_signup',
        'authentication',
        'User account created successfully',
        {
          actorUserId: userId,
          eventData: {
            email,
            has_family_invitation: !!familyInvitation,
          },
          securityContext,
        }
      );

      // Prepare response data
      const responseData = {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          email_confirmed_at: authData.user.email_confirmed_at,
          created_at: authData.user.created_at,
        },
        session: authData.session,
        needs_email_verification: !authData.user.email_confirmed_at,
        family_joined: !!familyInvitation,
        recovery_code: recoveryCode, // Include recovery code for user to save
        verification_code_sent: true,
      };

      return createSuccessResponse(
        responseData,
        familyInvitation 
          ? 'Account created successfully and added to family. Please check your email to verify your account.'
          : 'Account created successfully. Please check your email to verify your account.',
        201,
        corsOptions
      );

    } catch (postSignupError) {
      console.error('Post-signup processing error:', postSignupError instanceof Error ? postSignupError.message : "Unknown error");
      
      // User was created successfully, so don't fail the request
      // but log the error for investigation
      await logAuditEvent(
        'signup_post_processing_error',
        'authentication',
        'Error in post-signup processing',
        {
          actorUserId: userId,
          eventData: {
            error: postSignupError instanceof Error ? postSignupError.message : 'Unknown error',
          },
          severity: 'medium',
          success: false,
          securityContext,
        }
      );

      return createSuccessResponse(
        {
          user: {
            id: authData.user.id,
            email: authData.user.email,
            email_confirmed_at: authData.user.email_confirmed_at,
            created_at: authData.user.created_at,
          },
          session: authData.session,
          needs_email_verification: !authData.user.email_confirmed_at,
          family_joined: false,
        },
        'Account created successfully. Please check your email to verify your account.',
        201,
        corsOptions
      );
    }

  } catch (error) {
    console.error('Signup error:', error);

    // Record failed attempt for rate limiting
    if (securityContext && (requestBody as { email?: string })?.email) {
      await rateLimiter.recordAttempt(
        'auth:signup',
        securityContext.ip_address,
        securityContext.user_agent,
        false,
        (requestBody as { email?: string }).email
      );
    }

    // Log failed signup attempt
    if (securityContext) {
      await logAuditEvent(
        'user_signup_failed',
        'authentication',
        'User signup attempt failed',
        {
          eventData: {
            email: (requestBody as { email?: string })?.email,
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
      new AuthError('An unexpected error occurred during signup', 'INTERNAL_ERROR', 500),
      corsOptions
    );
  }
}