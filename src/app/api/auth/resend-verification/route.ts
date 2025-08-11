import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
import { z } from 'zod';
import { SecurityContext } from '@/types/auth';
import crypto from 'crypto';

const resendSchema = z.object({
  email: z.string().email('Valid email address required'),
});

const corsOptions = {
  origins: ['http://localhost:3000', 'http://localhost:3001', 'https://familyhub.care'],
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
    rateLimit: { endpoint: 'auth:resend-verification' },
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
    const validatedData = resendSchema.parse(requestBody);
    const email = validatedData.email.toLowerCase().trim();

    const supabase = await createClient();

    // Check if user exists
    const { data: existingUser } = await supabase.auth.admin.listUsers({
      filter: `email.eq.${email}`
    });

    if (!existingUser?.users?.length) {
      throw new AuthError('No account found with this email address', 'USER_NOT_FOUND', 404);
    }

    const user = existingUser.users[0];
    
    // Check if already verified
    if (user.email_confirmed_at) {
      throw new AuthError('Email address is already verified', 'ALREADY_VERIFIED', 400);
    }

    // Delete any existing verification codes for this email
    await supabase
      .from('email_verifications')
      .delete()
      .eq('email', email)
      .eq('type', 'signup');

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minute expiry

    // Store new verification in database
    const { error: verificationError } = await supabase
      .from('email_verifications')
      .insert({
        user_id: user.id,
        email: email,
        token: verificationToken,
        verification_code: verificationCode,
        type: 'signup',
        expires_at: expiresAt.toISOString()
      });

    if (verificationError) {
      console.error('Failed to store verification code:', verificationError);
      throw new AuthError('Failed to generate verification code', 'VERIFICATION_GENERATION_FAILED', 500);
    }

    // Log verification code to console for testing
    console.log('\n🔄 RESENT EMAIL VERIFICATION CODE');
    console.log('=====================================');
    console.log(`📧 Email: ${email}`);
    console.log(`\n🔢 CODE: ${verificationCode}\n`);
    console.log(`⏱️  Expires in: 15 minutes`);
    console.log('=====================================\n');

    // Send verification email with new code
    try {
      await emailService.sendVerificationCode({
        email: email,
        name: user.user_metadata?.first_name,
        code: verificationCode
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail the request if email fails in prototype mode
    }

    // Record successful attempt
    await rateLimiter.recordAttempt(
      'auth:resend-verification',
      securityContext.ip_address,
      securityContext.user_agent,
      true,
      email
    );

    // Log successful resend
    await logAuditEvent(
      'verification_code_resent',
      'authentication',
      'Verification code resent successfully',
      {
        eventData: {
          email: email,
          ip_address: securityContext.ip_address,
        },
        severity: 'low',
        success: true,
        securityContext,
      }
    );

    return createSuccessResponse(
      { 
        message: 'Verification code sent successfully',
        expiresIn: 15 * 60 // 15 minutes in seconds
      },
      200
    );

  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return createValidationErrorResponse(error);
    }

    // Handle auth errors
    if (error instanceof AuthError) {
      // Log the error
      if (securityContext) {
        await logAuditEvent(
          'resend_verification_error',
          'authentication',
          error.message,
          {
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
    console.error('Unexpected error in resend verification:', error);
    
    if (securityContext) {
      await logAuditEvent(
        'resend_verification_system_error',
        'authentication',
        'System error during verification resend',
        {
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
      'An unexpected error occurred while resending verification code',
      500,
      'INTERNAL_SERVER_ERROR'
    );
  }
}