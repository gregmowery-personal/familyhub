import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loginSchema } from '@/lib/validations/auth';
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
  createUserSession,
  getUserProfile,
  getUserFamilies
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

    // Attempt to sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: validatedData.password,
    });

    if (authError) {
      await rateLimiter.recordAttempt(
        'auth:login',
        securityContext.ip_address,
        securityContext.user_agent,
        false,
        email
      );

      console.error('Supabase auth error:', authError instanceof Error ? authError.message : "Unknown error");
      
      // Log failed login attempt
      await logAuditEvent(
        'user_login_failed',
        'authentication',
        'User login attempt failed',
        {
          eventData: {
            email,
            error: authError.message,
            ip_address: securityContext.ip_address,
          },
          severity: 'medium',
          success: false,
          securityContext,
        }
      );

      // Map Supabase errors to user-friendly messages
      let errorMessage = 'Invalid email or password';
      let errorCode = 'INVALID_CREDENTIALS';
      
      if (authError.message.includes('email_not_confirmed')) {
        errorMessage = 'Please verify your email address before signing in';
        errorCode = 'EMAIL_NOT_VERIFIED';
      } else if (authError.message.includes('invalid_credentials')) {
        errorMessage = 'Invalid email or password';
        errorCode = 'INVALID_CREDENTIALS';
      } else if (authError.message.includes('too_many_requests')) {
        errorMessage = 'Too many login attempts. Please try again later.';
        errorCode = 'TOO_MANY_REQUESTS';
      }
      
      throw new AuthError(errorMessage, errorCode, 401);
    }

    if (!authData.user || !authData.session) {
      throw new AuthError('Login failed', 'LOGIN_FAILED', 401);
    }

    const userId = authData.user.id;

    try {
      // Get user profile
      const profile = await getUserProfile(userId);
      
      // Get user families
      const families = await getUserFamilies(userId);

      // Create enhanced user session record
      const sessionId = await createUserSession(
        userId,
        authData.session.access_token,
        validatedData.device_info,
        securityContext
      );

      // Record successful login attempt
      await rateLimiter.recordAttempt(
        'auth:login',
        securityContext.ip_address,
        securityContext.user_agent,
        true,
        email
      );

      // Clear any previous failed attempts for this IP
      await rateLimiter.clearRateLimit('auth:login', securityContext.ip_address);

      // Log successful login
      await logAuditEvent(
        'user_login',
        'authentication',
        'User logged in successfully',
        {
          actorUserId: userId,
          eventData: {
            email,
            session_id: sessionId,
            device_info: validatedData.device_info,
            family_count: families.length,
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
          phone_confirmed_at: authData.user.phone_confirmed_at,
          created_at: authData.user.created_at,
          updated_at: authData.user.updated_at,
        },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
          expires_in: authData.session.expires_in,
          token_type: authData.session.token_type,
        },
        profile,
        families: families.map((family: { id: string; name: string; family_type: string; timezone: string; user_role: string; is_family_admin: boolean }) => ({
          id: family.id,
          name: family.name,
          family_type: family.family_type,
          timezone: family.timezone,
          role: family.user_role,
          is_family_admin: family.is_family_admin,
        })),
        session_id: sessionId,
      };

      return createSuccessResponse(
        responseData,
        'Login successful',
        200,
        corsOptions
      );

    } catch (postLoginError) {
      console.error('Post-login processing error:', postLoginError instanceof Error ? postLoginError.message : 'Unknown error');
      
      // Login was successful, so don't fail the request
      // but log the error for investigation
      await logAuditEvent(
        'login_post_processing_error',
        'authentication',
        'Error in post-login processing',
        {
          actorUserId: userId,
          eventData: {
            error: postLoginError instanceof Error ? postLoginError.message : 'Unknown error',
          },
          severity: 'medium',
          success: false,
          securityContext,
        }
      );

      // Return basic success response
      return createSuccessResponse(
        {
          user: {
            id: authData.user.id,
            email: authData.user.email,
            email_confirmed_at: authData.user.email_confirmed_at,
            phone_confirmed_at: authData.user.phone_confirmed_at,
            created_at: authData.user.created_at,
            updated_at: authData.user.updated_at,
          },
          session: {
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
            expires_at: authData.session.expires_at,
            expires_in: authData.session.expires_in,
            token_type: authData.session.token_type,
          },
          profile: null,
          families: [],
          session_id: null,
        },
        'Login successful',
        200,
        corsOptions
      );
    }

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