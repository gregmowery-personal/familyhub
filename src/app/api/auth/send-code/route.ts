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
  logAuditEvent
} from '@/lib/auth/utils';

const corsOptions = {
  origins: ['http://localhost:3000', 'https://familyhub.care'],
  methods: ['POST', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization'],
};

const sendCodeSchema = z.object({
  email: z.string().email(),
  type: z.enum(['login', 'signup', 'recovery']).optional().default('login')
});

export async function OPTIONS(request: NextRequest) {
  const middlewareResponse = await withAuth(request, { cors: corsOptions });
  return middlewareResponse || new Response(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  const middlewareResponse = await withAuth(request, {
    rateLimit: { endpoint: 'auth:send-code' },
    cors: corsOptions,
  });
  
  if (middlewareResponse) {
    return middlewareResponse;
  }

  try {
    const requestBody = await request.json();
    const { email, type } = sendCodeSchema.parse(requestBody);
    const securityContext = await getSecurityContext();

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Check if user exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const foundUser = existingUsers?.users?.find(user => user.email === email);

    if (!foundUser && type === 'login') {
      throw new AuthError(
        'No account found with this email address',
        'USER_NOT_FOUND',
        404
      );
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store verification code
    if (foundUser) {
      const { error: codeError } = await supabase
        .from('email_verifications')
        .upsert({
          user_id: foundUser.id,
          email: email,
          token: crypto.randomUUID(),
          verification_code: verificationCode,
          type: type,
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
    }

    // Log email to console (instead of sending)
    console.log('\n📧 EMAIL VERIFICATION CODE');
    console.log('=====================================');
    console.log(`To: ${email}`);
    console.log(`Subject: Your FamilyHub ${type === 'login' ? 'Login' : 'Verification'} Code`);
    console.log('\n🔢 VERIFICATION CODE:', verificationCode);
    console.log(`\n⏱️  Expires in: 10 minutes`);
    console.log('=====================================\n');

    // Log the event
    await logAuditEvent(
      'verification_code_sent',
      'authentication',
      `Verification code sent for ${type}`,
      {
        eventData: {
          email,
          type,
        },
        securityContext,
      }
    );

    return createSuccessResponse(
      {
        message: 'Verification code sent to your email',
        email: email,
        expiresIn: 600 // 10 minutes
      },
      'Code sent successfully',
      200,
      corsOptions
    );

  } catch (error) {
    console.error('Send code error:', error);

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
      new AuthError('Failed to send verification code', 'SEND_CODE_FAILED', 500),
      corsOptions
    );
  }
}