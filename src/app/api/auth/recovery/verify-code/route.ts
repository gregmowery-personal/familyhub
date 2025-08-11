import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { z } from 'zod';
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

const corsOptions = {
  origins: ['http://localhost:3000', 'https://familyhub.care'],
  methods: ['POST', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization'],
};

const verifyCodeSchema = z.object({
  email: z.string().email(),
  recovery_code: z.string().regex(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/, 'Invalid recovery code format'),
});

export async function OPTIONS(request: NextRequest) {
  const middlewareResponse = await withAuth(request, { cors: corsOptions });
  return middlewareResponse || new Response(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  // Apply middleware with rate limiting
  const middlewareResponse = await withAuth(request, {
    rateLimit: { endpoint: 'auth:recovery' },
    cors: corsOptions,
  });
  
  if (middlewareResponse) {
    return middlewareResponse;
  }

  let email: string | null = null;
  const securityContext = await getSecurityContext();

  try {
    // Parse and validate request body
    const requestBody = await request.json();
    const validatedData = verifyCodeSchema.parse(requestBody);
    email = sanitizeEmail(validatedData.email);

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Find user by email
    const { data: users } = await adminClient.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === email);

    if (!user) {
      // Record failed attempt
      await rateLimiter.recordAttempt(
        'auth:recovery',
        securityContext?.ip_address || '',
        securityContext?.user_agent || '',
        false,
        email
      );

      // Log failed attempt
      await supabase
        .from('recovery_attempts')
        .insert({
          email,
          recovery_method: 'recovery_code',
          success: false,
          ip_address: securityContext?.ip_address,
          user_agent: securityContext?.user_agent,
          error_message: 'User not found',
        });

      throw new AuthError('Invalid email or recovery code', 'INVALID_RECOVERY', 401);
    }

    // Hash the provided code
    const codeHash = crypto
      .createHash('sha256')
      .update(validatedData.recovery_code)
      .digest('hex');

    // Verify the recovery code
    const { data: recoveryCode, error: codeError } = await supabase
      .from('recovery_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('code_hash', codeHash)
      .eq('is_active', true)
      .single();

    if (codeError || !recoveryCode) {
      // Record failed attempt
      await rateLimiter.recordAttempt(
        'auth:recovery',
        securityContext?.ip_address || '',
        securityContext?.user_agent || '',
        false,
        email
      );

      // Log failed attempt
      await supabase
        .from('recovery_attempts')
        .insert({
          user_id: user.id,
          email,
          recovery_method: 'recovery_code',
          success: false,
          ip_address: securityContext?.ip_address,
          user_agent: securityContext?.user_agent,
          error_message: 'Invalid recovery code',
        });

      throw new AuthError('Invalid email or recovery code', 'INVALID_RECOVERY', 401);
    }

    // Check if code is expired
    if (new Date(recoveryCode.expires_at) < new Date()) {
      await supabase
        .from('recovery_attempts')
        .insert({
          user_id: user.id,
          email,
          recovery_method: 'recovery_code',
          success: false,
          ip_address: securityContext?.ip_address,
          user_agent: securityContext?.user_agent,
          error_message: 'Recovery code expired',
        });

      throw new AuthError('Recovery code has expired', 'CODE_EXPIRED', 401);
    }

    // Mark code as used
    await supabase
      .from('recovery_codes')
      .update({ 
        used_at: new Date().toISOString(),
        is_active: false 
      })
      .eq('id', recoveryCode.id);

    // Create session for user (48 hours)
    const { data: sessionData, error: sessionError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
      }
    });

    if (sessionError) {
      throw new AuthError('Failed to create session', 'SESSION_ERROR', 500);
    }

    // Record successful recovery
    await rateLimiter.recordAttempt(
      'auth:recovery',
      securityContext?.ip_address || '',
      securityContext?.user_agent || '',
      true,
      email
    );

    // Log successful recovery
    await supabase
      .from('recovery_attempts')
      .insert({
        user_id: user.id,
        email,
        recovery_method: 'recovery_code',
        success: true,
        ip_address: securityContext?.ip_address,
        user_agent: securityContext?.user_agent,
      });

    await logAuditEvent(
      'account_recovered',
      'security',
      'User recovered account using recovery code',
      {
        actorUserId: user.id,
        eventData: {
          recovery_method: 'recovery_code',
          email,
        },
        severity: 'high',
        securityContext,
      }
    );

    // Get user profile and families for response
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const { data: families } = await supabase
      .rpc('get_user_families', { p_user_id: user.id });

    return createSuccessResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          email_confirmed_at: user.email_confirmed_at,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
        session: {
          access_token: sessionData.properties?.hashed_token || '',
          expires_in: 48 * 60 * 60, // 48 hours in seconds
        },
        profile,
        families,
        recovery_successful: true,
        message: 'Account recovered successfully. A new recovery code should be generated.'
      },
      'Account recovered successfully',
      200,
      corsOptions
    );

  } catch (error) {
    console.error('Recovery code verification error:', error);

    // Record failed attempt if we have an email
    if (email && securityContext) {
      await rateLimiter.recordAttempt(
        'auth:recovery',
        securityContext.ip_address,
        securityContext.user_agent,
        false,
        email
      );
    }

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
      new AuthError('Recovery failed', 'RECOVERY_FAILED', 500),
      corsOptions
    );
  }
}