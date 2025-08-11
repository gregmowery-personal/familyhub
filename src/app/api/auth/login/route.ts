import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { loginSchema } from '@/lib/validations/auth';
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
  sanitizeEmail
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
    rateLimit: { endpoint: 'auth:login' },
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
    const validatedData = loginSchema.parse(requestBody);
    email = sanitizeEmail(validatedData.email);

    const supabase = await createClient();

    // Check for suspicious activity
    const suspiciousActivity = await rateLimiter.checkSuspiciousActivity(
      securityContext.ip_address,
      securityContext.user_agent
    );

    if (suspiciousActivity.isSuspicious) {
      // Log suspicious activity
      await logAuditEvent(
        'suspicious_login_activity',
        'security',
        'Suspicious login activity detected',
        {
          eventData: {
            ip_address: securityContext.ip_address,
            risk_score: suspiciousActivity.riskScore,
            reasons: suspiciousActivity.reasons,
          },
          severity: 'high',
          securityContext,
        }
      );

      // Temporarily block the IP if risk is very high
      if (suspiciousActivity.riskScore >= 80) {
        await rateLimiter.blockIP(
          securityContext.ip_address,
          `Suspicious activity: ${suspiciousActivity.reasons.join(', ')}`,
          60 // 1 hour block
        );
        
        throw new AuthError(
          'Account temporarily locked due to suspicious activity',
          'ACCOUNT_LOCKED',
          423
        );
      }
    }

    // Step 1: Check if user exists
    const adminClient = createAdminClient();
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const foundUser = existingUsers?.users?.find(user => user.email === email);
    
    if (!foundUser) {
      throw new AuthError(
        'No account found with this email address',
        'USER_NOT_FOUND',
        404
      );
    }
    
    // Step 2: Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Step 3: Store verification code in database
    const { error: codeError } = await supabase
      .from('email_verifications')
      .upsert({
        user_id: foundUser.id,
        email: email,
        token: crypto.randomUUID(),
        verification_code: verificationCode,
        type: 'login',
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'user_id,type'
      });
    
    if (codeError) {
      console.error('Failed to store verification code:', codeError);
      throw new AuthError(
        'Failed to generate verification code',
        'CODE_GENERATION_FAILED',
        500
      );
    }
    
    // Step 4: Log email to console (instead of sending)
    console.log('\n📧 EMAIL VERIFICATION CODE');
    console.log('=====================================');
    console.log(`To: ${email}`);
    console.log(`Subject: Your FamilyHub Login Code`);
    console.log('\n🔢 VERIFICATION CODE:', verificationCode);
    console.log(`\n⏱️  Expires in: 10 minutes`);
    console.log('=====================================\n');
    
    // Record successful code generation
    await rateLimiter.recordAttempt(
      'auth:login',
      securityContext.ip_address,
      securityContext.user_agent,
      true,
      email
    );

    // Log successful code sent
    await logAuditEvent(
      'user_login_code_sent',
      'authentication',
      'Login verification code sent',
      {
        eventData: {
          email,
        },
        securityContext,
      }
    );

    // Since we're doing passwordless, return that code was sent
    return createSuccessResponse(
      {
        message: 'Verification code sent to your email',
        email: email,
        expiresIn: 600 // 10 minutes
      },
      'Verification code sent',
      200,
      corsOptions
    );

  } catch (error) {
    console.error('Login error:', error);

    // Record failed attempt for rate limiting
    if (securityContext && email) {
      await rateLimiter.recordAttempt(
        'auth:login',
        securityContext.ip_address,
        securityContext.user_agent,
        false,
        email
      );
    }

    // Log failed login attempt
    if (securityContext) {
      await logAuditEvent(
        'user_login_failed',
        'authentication',
        'User login attempt failed',
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
      new AuthError('An unexpected error occurred during login', 'INTERNAL_ERROR', 500),
      corsOptions
    );
  }
}