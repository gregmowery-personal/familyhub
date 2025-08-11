import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { 
  withAuth, 
  createErrorResponse, 
  createSuccessResponse 
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

export async function OPTIONS(request: NextRequest) {
  const middlewareResponse = await withAuth(request, { cors: corsOptions });
  return middlewareResponse || new Response(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  // Apply middleware - user must be authenticated
  const middlewareResponse = await withAuth(request, {
    requireAuth: true,
    cors: corsOptions,
  });
  
  if (middlewareResponse) {
    return middlewareResponse;
  }

  try {
    const supabase = await createClient();
    const securityContext = await getSecurityContext();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new AuthError('User not authenticated', 'UNAUTHORIZED', 401);
    }

    // Check if user already has an active recovery code
    const { data: existingCode } = await supabase
      .from('recovery_codes')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (existingCode) {
      // Deactivate existing code
      await supabase
        .from('recovery_codes')
        .update({ is_active: false })
        .eq('id', existingCode.id);
    }

    // Generate new recovery code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 10; i++) {
      if (i === 5) code += '-';
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    // Hash the code for storage
    const codeHash = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');

    // Get last 3 characters as hint
    const codeHint = code.slice(-3);

    // Store the hashed code
    const { error: insertError } = await supabase
      .from('recovery_codes')
      .insert({
        user_id: user.id,
        code_hash: codeHash,
        code_hint: codeHint,
        is_active: true,
        expires_at: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString() // 2 years
      });

    if (insertError) {
      console.error('Failed to store recovery code:', insertError);
      throw new AuthError('Failed to generate recovery code', 'GENERATION_FAILED', 500);
    }

    // Log the event
    await logAuditEvent(
      'recovery_code_generated',
      'security',
      'User generated new recovery code',
      {
        actorUserId: user.id,
        eventData: {
          code_hint: codeHint,
        },
        securityContext,
      }
    );

    return createSuccessResponse(
      {
        recovery_code: code,
        hint: codeHint,
        expires_at: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        message: 'Save this code securely. You will not be able to see it again.'
      },
      'Recovery code generated successfully',
      200,
      corsOptions
    );

  } catch (error) {
    console.error('Generate recovery code error:', error);

    if (error instanceof AuthError) {
      return createErrorResponse(error, corsOptions);
    }

    return createErrorResponse(
      new AuthError('Failed to generate recovery code', 'INTERNAL_ERROR', 500),
      corsOptions
    );
  }
}