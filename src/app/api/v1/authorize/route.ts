import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
  getServerUser
} from '@/lib/auth/utils';
import { getAuthorizationService } from '@/lib/auth/authorization-service';
import { z } from 'zod';

const corsOptions = {
  origins: ['http://localhost:3000', 'https://familyhub.care'],
  methods: ['POST', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization'],
};

// Validation schema for authorization request
const authorizeRequestSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  action: z.string().min(1, 'Action is required').max(100, 'Action too long'),
  resourceId: z.string().uuid('Invalid resource ID format'),
  resourceType: z.string().min(1, 'Resource type is required').max(50, 'Resource type too long')
});

export async function OPTIONS(request: NextRequest) {
  const middlewareResponse = await withAuth(request, { cors: corsOptions });
  return middlewareResponse || new Response(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  // Apply middleware with rate limiting
  const middlewareResponse = await withAuth(request, {
    cors: corsOptions,
    requireAuth: true,
    rateLimit: {
      endpoint: 'authorize',
      skipSuccessful: false
    }
  });
  
  if (middlewareResponse) {
    return middlewareResponse;
  }

  let securityContext: any = null;
  let requestBody: any = null;

  try {
    securityContext = await getSecurityContext();
    
    // Get current authenticated user
    const currentUser = await getServerUser();
    
    if (!currentUser) {
      return createErrorResponse(
        new AuthError('Authentication required', 'AUTHENTICATION_REQUIRED', 401),
        corsOptions
      );
    }

    // Parse and validate request body
    try {
      requestBody = await request.json();
    } catch (parseError) {
      return createErrorResponse(
        new AuthError('Invalid JSON in request body', 'INVALID_JSON', 400),
        corsOptions
      );
    }

    // Validate request data
    const validation = authorizeRequestSchema.safeParse(requestBody);
    if (!validation.success) {
      const errors: Record<string, string[]> = {};
      validation.error.errors.forEach(err => {
        const field = err.path.join('.');
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field].push(err.message);
      });
      
      return createValidationErrorResponse(errors, corsOptions);
    }

    const { userId, action, resourceId, resourceType } = validation.data;

    // Additional security check: users can only check their own permissions unless they're admin
    const isAdmin = await checkIsAdmin(currentUser.id);
    if (userId !== currentUser.id && !isAdmin) {
      await logAuditEvent(
        'unauthorized_permission_check_attempt',
        'security',
        'User attempted to check permissions for another user',
        {
          actorUserId: currentUser.id,
          eventData: {
            requestedUserId: userId,
            action,
            resourceId,
            resourceType
          },
          severity: 'high',
          success: false,
          securityContext,
        }
      );

      return createErrorResponse(
        new AuthError('Cannot check permissions for other users', 'FORBIDDEN', 403),
        corsOptions
      );
    }

    // Perform authorization check
    const authService = getAuthorizationService();
    const startTime = Date.now();
    
    const result = await authService.authorize(userId, action, resourceId, resourceType);
    
    const duration = Date.now() - startTime;

    // Log successful authorization check
    await logAuditEvent(
      'authorization_check_performed',
      'authorization',
      `Authorization check: ${action} on ${resourceType}`,
      {
        actorUserId: currentUser.id,
        eventData: {
          checkedUserId: userId,
          action,
          resourceId,
          resourceType,
          allowed: result.allowed,
          reason: result.reason,
          source: result.source,
          duration
        },
        success: true,
        severity: 'low',
        securityContext,
      }
    );

    // Return authorization result
    return createSuccessResponse(
      {
        allowed: result.allowed,
        reason: result.reason,
        source: result.source,
        roleId: result.roleId,
        delegationId: result.delegationId,
        emergencyOverrideId: result.emergencyOverrideId,
        ttl: getCacheTTL(action),
        details: result.details
      },
      'Authorization check completed',
      200,
      corsOptions
    );

  } catch (error) {
    console.error('Authorization check error:', error);

    // Log error
    if (securityContext) {
      await logAuditEvent(
        'authorization_check_error',
        'authorization',
        'Authorization check failed',
        {
          actorUserId: currentUser?.id,
          eventData: {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestBody
          },
          severity: 'medium',
          success: false,
          securityContext,
        }
      );
    }

    if (error instanceof AuthError) {
      return createErrorResponse(error, corsOptions);
    }

    return createErrorResponse(
      new AuthError('Authorization check failed', 'AUTHORIZATION_ERROR', 500),
      corsOptions
    );
  }
}

/**
 * Check if user is admin
 */
async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('user_roles')
      .select('role:roles(type)')
      .eq('user_id', userId)
      .eq('state', 'active')
      .lte('valid_from', new Date().toISOString())
      .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`);

    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }

    return (data || []).some((userRole: any) => userRole.role?.type === 'admin');
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Get cache TTL based on action type
 */
function getCacheTTL(action: string): number {
  const ttlMap: Record<string, number> = {
    'read': 300,    // 5 minutes
    'write': 60,    // 1 minute
    'delete': 30,   // 30 seconds
    'admin': 10     // 10 seconds
  };
  
  return ttlMap[action] || 60;
}