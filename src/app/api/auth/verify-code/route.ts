import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
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
  createUserSession,
  getUserProfile,
  getUserFamilies
} from '@/lib/auth/utils';
import { rateLimiter } from '@/lib/auth/rate-limit';

const corsOptions = {
  origins: ['http://localhost:3000', 'https://familyhub.care'],
  methods: ['POST', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization'],
};

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d{6}$/),
  rememberMe: z.boolean().optional().default(false)
});

export async function OPTIONS(request: NextRequest) {
  const middlewareResponse = await withAuth(request, { cors: corsOptions });
  return middlewareResponse || new Response(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  const middlewareResponse = await withAuth(request, {
    rateLimit: { endpoint: 'auth:verify' },
    cors: corsOptions,
  });
  
  if (middlewareResponse) {
    return middlewareResponse;
  }

  try {
    const requestBody = await request.json();
    const { email, code, rememberMe } = verifyCodeSchema.parse(requestBody);
    const securityContext = await getSecurityContext();

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Verify the code
    const { data: verification, error: verifyError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('verification_code', code)
      .eq('type', 'login')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (verifyError || !verification) {
      await rateLimiter.recordAttempt(
        'auth:verify',
        securityContext?.ip_address || '',
        securityContext?.user_agent || '',
        false,
        email
      );

      throw new AuthError(
        'Invalid or expired verification code',
        'INVALID_CODE',
        400
      );
    }

    // Get user details
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const foundUser = existingUsers?.users?.find(user => user.email === email);

    if (!foundUser) {
      throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Create session (simplified for now - in production would use proper JWT)
    const sessionDuration = rememberMe ? 7 * 24 * 60 * 60 : 48 * 60 * 60; // 7 days or 48 hours
    
    // Clean up used verification code
    await supabase
      .from('email_verifications')
      .delete()
      .eq('id', verification.id);

    // Get user profile and families
    const profile = await getUserProfile(foundUser.id);
    const families = await getUserFamilies(foundUser.id);

    // Create user session record
    const sessionId = await createUserSession(
      foundUser.id,
      'session_token_' + crypto.randomUUID(),
      {
        device_type: 'web',
        browser_name: requestBody.device_info?.browser_name || 'Unknown',
        device_name: requestBody.device_info?.device_name || 'Unknown',
      },
      securityContext
    );

    // Record successful login
    await rateLimiter.recordAttempt(
      'auth:verify',
      securityContext?.ip_address || '',
      securityContext?.user_agent || '',
      true,
      email
    );

    await logAuditEvent(
      'user_login_verified',
      'authentication',
      'User successfully verified login code',
      {
        actorUserId: foundUser.id,
        eventData: {
          email,
          session_id: sessionId,
          remember_me: rememberMe,
        },
        securityContext,
      }
    );

    return createSuccessResponse(
      {
        user: {
          id: foundUser.id,
          email: foundUser.email,
          email_confirmed_at: foundUser.email_confirmed_at,
          created_at: foundUser.created_at,
          updated_at: foundUser.updated_at,
        },
        session: {
          access_token: 'session_token_' + sessionId,
          expires_in: sessionDuration,
        },
        profile,
        families,
      },
      'Login successful',
      200,
      corsOptions
    );

  } catch (error) {
    console.error('Verify code error:', error);

    if (error instanceof z.ZodError) {
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
      new AuthError('Verification failed', 'VERIFICATION_FAILED', 500),
      corsOptions
    );
  }
}