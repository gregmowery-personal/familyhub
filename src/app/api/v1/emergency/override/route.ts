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
  methods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization'],
};

// Validation schema for emergency override activation
const activateOverrideRequestSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  reason: z.enum(['no_response_24h', 'panic_button', 'admin_override', 'medical_emergency'], {
    errorMap: () => ({ message: 'Invalid emergency reason' })
  }),
  durationMinutes: z.number().int().min(1).max(1440, 'Duration cannot exceed 24 hours'),
  justification: z.string().min(10, 'Justification must be at least 10 characters').max(1000, 'Justification too long'),
  grantedPermissions: z.array(z.string().uuid('Invalid permission ID format')).min(1, 'At least one permission required'),
  notifyUsers: z.array(z.string().uuid('Invalid user ID format')).default([])
});

// Validation schema for emergency override deactivation
const deactivateOverrideRequestSchema = z.object({
  overrideId: z.string().uuid('Invalid override ID format'),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long')
});

export async function OPTIONS(request: NextRequest) {
  const middlewareResponse = await withAuth(request, { cors: corsOptions });
  return middlewareResponse || new Response(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  // Apply middleware with strict rate limiting for emergency overrides
  const middlewareResponse = await withAuth(request, {
    cors: corsOptions,
    requireAuth: true,
    rateLimit: {
      endpoint: 'emergency_override',
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
    const validation = activateOverrideRequestSchema.safeParse(requestBody);
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

    const { userId, reason, durationMinutes, justification, grantedPermissions, notifyUsers } = validation.data;

    // Check if user can activate emergency override
    const canActivate = await checkCanActivateEmergencyOverride(currentUser.id, userId, reason);
    if (!canActivate.allowed) {
      await logAuditEvent(
        'emergency_override_denied',
        'security',
        'Emergency override activation denied',
        {
          actorUserId: currentUser.id,
          eventData: {
            targetUserId: userId,
            reason,
            durationMinutes,
            justification,
            denialReason: canActivate.reason
          },
          severity: 'high',
          success: false,
          securityContext,
        }
      );

      return createErrorResponse(
        new AuthError(canActivate.reason || 'Cannot activate emergency override', 'OVERRIDE_NOT_ALLOWED', 403),
        corsOptions
      );
    }

    // Check if target user exists
    const targetUserExists = await checkUserExists(userId);
    if (!targetUserExists) {
      return createErrorResponse(
        new AuthError('Target user not found', 'USER_NOT_FOUND', 404),
        corsOptions
      );
    }

    // Validate that permissions exist
    const permissionsValid = await validatePermissions(grantedPermissions);
    if (!permissionsValid) {
      return createErrorResponse(
        new AuthError('One or more permissions are invalid', 'INVALID_PERMISSIONS', 400),
        corsOptions
      );
    }

    // Check for existing active override for this user
    const existingOverride = await getActiveEmergencyOverride(userId);
    if (existingOverride) {
      return createErrorResponse(
        new AuthError('User already has an active emergency override', 'OVERRIDE_ALREADY_ACTIVE', 409),
        corsOptions
      );
    }

    // Validate notify users exist
    if (notifyUsers.length > 0) {
      const notifyUsersValid = await validateNotifyUsers(notifyUsers);
      if (!notifyUsersValid) {
        return createErrorResponse(
          new AuthError('One or more notification users are invalid', 'INVALID_NOTIFY_USERS', 400),
          corsOptions
        );
      }
    }

    // Activate emergency override
    const overrideId = await activateEmergencyOverride({
      triggeredBy: currentUser.id,
      affectedUser: userId,
      reason,
      durationMinutes,
      justification,
      grantedPermissions,
      notifiedUsers: notifyUsers
    });

    // Invalidate cache for affected user
    const authService = getAuthorizationService();
    await authService.invalidateCache({
      type: 'ROLE_ASSIGNED', // Emergency overrides affect authorization like role changes
      userId
    });

    // Send notifications (in a real implementation, this would be async)
    await sendEmergencyNotifications(overrideId, notifyUsers, reason, userId);

    // Log emergency override activation
    await logAuditEvent(
      'emergency_override_activated',
      'security',
      `Emergency override activated: ${reason}`,
      {
        actorUserId: currentUser.id,
        eventData: {
          overrideId,
          targetUserId: userId,
          reason,
          durationMinutes,
          justification,
          grantedPermissions: grantedPermissions.length,
          notifiedUsers: notifyUsers.length,
          expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
        },
        severity: 'critical',
        success: true,
        securityContext,
      }
    );

    return createSuccessResponse(
      {
        overrideId,
        triggeredBy: currentUser.id,
        affectedUser: userId,
        reason,
        durationMinutes,
        justification,
        grantedPermissions,
        notifiedUsers: notifyUsers,
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
        state: 'active'
      },
      'Emergency override activated successfully',
      201,
      corsOptions
    );

  } catch (error) {
    console.error('Emergency override activation error:', error);

    // Log error
    if (securityContext && currentUser) {
      await logAuditEvent(
        'emergency_override_activation_error',
        'security',
        'Emergency override activation failed',
        {
          actorUserId: currentUser.id,
          eventData: {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestBody
          },
          severity: 'critical',
          success: false,
          securityContext,
        }
      );
    }

    if (error instanceof AuthError) {
      return createErrorResponse(error, corsOptions);
    }

    return createErrorResponse(
      new AuthError('Emergency override activation failed', 'OVERRIDE_ACTIVATION_ERROR', 500),
      corsOptions
    );
  }
}

export async function GET(request: NextRequest) {
  // Apply middleware for listing emergency overrides
  const middlewareResponse = await withAuth(request, {
    cors: corsOptions,
    requireAuth: true,
    rateLimit: {
      endpoint: 'emergency_override_list',
      skipSuccessful: true
    }
  });
  
  if (middlewareResponse) {
    return middlewareResponse;
  }

  try {
    const currentUser = await getServerUser();
    
    if (!currentUser) {
      return createErrorResponse(
        new AuthError('Authentication required', 'AUTHENTICATION_REQUIRED', 401),
        corsOptions
      );
    }

    // Check if user has permission to view emergency overrides
    const canView = await checkCanViewEmergencyOverrides(currentUser.id);
    if (!canView) {
      return createErrorResponse(
        new AuthError('Insufficient permissions to view emergency overrides', 'INSUFFICIENT_PERMISSIONS', 403),
        corsOptions
      );
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId'); // Filter by specific user
    const state = url.searchParams.get('state') || 'active'; // 'active', 'expired', 'deactivated', 'all'
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Get emergency overrides
    const overrides = await getEmergencyOverrides(userId, state, limit, offset);

    return createSuccessResponse(
      {
        overrides,
        pagination: {
          limit,
          offset,
          total: overrides.length // In a real implementation, you'd get the total count
        }
      },
      'Emergency overrides retrieved successfully',
      200,
      corsOptions
    );

  } catch (error) {
    console.error('Emergency override list error:', error);

    if (error instanceof AuthError) {
      return createErrorResponse(error, corsOptions);
    }

    return createErrorResponse(
      new AuthError('Failed to retrieve emergency overrides', 'OVERRIDE_LIST_ERROR', 500),
      corsOptions
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Apply middleware for deactivating emergency overrides
  const middlewareResponse = await withAuth(request, {
    cors: corsOptions,
    requireAuth: true,
    rateLimit: {
      endpoint: 'emergency_override_deactivate',
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
    const validation = deactivateOverrideRequestSchema.safeParse(requestBody);
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

    const { overrideId, reason } = validation.data;

    // Check if user can deactivate this emergency override
    const canDeactivate = await checkCanDeactivateEmergencyOverride(currentUser.id, overrideId);
    if (!canDeactivate.allowed) {
      return createErrorResponse(
        new AuthError(canDeactivate.reason || 'Cannot deactivate emergency override', 'DEACTIVATION_NOT_ALLOWED', 403),
        corsOptions
      );
    }

    // Get override details before deactivating
    const override = await getEmergencyOverrideById(overrideId);
    if (!override) {
      return createErrorResponse(
        new AuthError('Emergency override not found', 'OVERRIDE_NOT_FOUND', 404),
        corsOptions
      );
    }

    if (override.deactivated_at) {
      return createErrorResponse(
        new AuthError('Emergency override is already deactivated', 'OVERRIDE_ALREADY_DEACTIVATED', 409),
        corsOptions
      );
    }

    // Deactivate emergency override
    await deactivateEmergencyOverride(overrideId, currentUser.id, reason);

    // Invalidate cache for affected user
    const authService = getAuthorizationService();
    await authService.invalidateCache({
      type: 'ROLE_REVOKED', // Treat deactivation like role revocation
      userId: override.affected_user
    });

    // Log emergency override deactivation
    await logAuditEvent(
      'emergency_override_deactivated',
      'security',
      `Emergency override deactivated`,
      {
        actorUserId: currentUser.id,
        eventData: {
          overrideId,
          affectedUser: override.affected_user,
          originalReason: override.reason,
          deactivationReason: reason,
          durationActive: Date.now() - new Date(override.activated_at).getTime()
        },
        severity: 'high',
        success: true,
        securityContext,
      }
    );

    return createSuccessResponse(
      {
        overrideId,
        deactivatedBy: currentUser.id,
        deactivatedAt: new Date().toISOString(),
        reason,
        state: 'deactivated'
      },
      'Emergency override deactivated successfully',
      200,
      corsOptions
    );

  } catch (error) {
    console.error('Emergency override deactivation error:', error);

    // Log error
    if (securityContext && currentUser) {
      await logAuditEvent(
        'emergency_override_deactivation_error',
        'security',
        'Emergency override deactivation failed',
        {
          actorUserId: currentUser.id,
          eventData: {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestBody
          },
          severity: 'critical',
          success: false,
          securityContext,
        }
      );
    }

    if (error instanceof AuthError) {
      return createErrorResponse(error, corsOptions);
    }

    return createErrorResponse(
      new AuthError('Emergency override deactivation failed', 'OVERRIDE_DEACTIVATION_ERROR', 500),
      corsOptions
    );
  }
}

// Helper functions

async function checkUserExists(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error('Error checking user exists:', error);
    return false;
  }
}

async function checkCanActivateEmergencyOverride(
  userId: string, 
  targetUserId: string, 
  reason: string
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const supabase = await createClient();
    
    // Admin users can always activate emergency overrides
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('role:roles(type)')
      .eq('user_id', userId)
      .eq('state', 'active');

    const isAdmin = adminRoles?.some((ur: any) => ur.role?.type === 'admin');
    
    if (isAdmin) {
      return { allowed: true };
    }

    // Emergency contacts can activate for medical emergencies
    if (reason === 'medical_emergency') {
      const { data: emergencyRoles } = await supabase
        .from('user_roles')
        .select('role:roles(type)')
        .eq('user_id', userId)
        .eq('state', 'active');

      const isEmergencyContact = emergencyRoles?.some((ur: any) => ur.role?.type === 'emergency_contact');
      
      if (isEmergencyContact) {
        return { allowed: true };
      }
    }

    // Users can activate panic button for themselves
    if (reason === 'panic_button' && userId === targetUserId) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Insufficient permissions to activate emergency override' };
  } catch (error) {
    console.error('Error checking emergency override permission:', error);
    return { allowed: false, reason: 'Failed to check emergency override permission' };
  }
}

async function validatePermissions(permissions: string[]): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('permissions')
      .select('id')
      .in('id', permissions);

    if (error) {
      console.error('Error validating permissions:', error);
      return false;
    }

    return data && data.length === permissions.length;
  } catch (error) {
    console.error('Error validating permissions:', error);
    return false;
  }
}

async function validateNotifyUsers(userIds: string[]): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .in('id', userIds);

    if (error) {
      console.error('Error validating notify users:', error);
      return false;
    }

    return data && data.length === userIds.length;
  } catch (error) {
    console.error('Error validating notify users:', error);
    return false;
  }
}

async function getActiveEmergencyOverride(userId: string): Promise<any> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('emergency_overrides')
      .select('id')
      .eq('affected_user', userId)
      .gt('expires_at', new Date().toISOString())
      .is('deactivated_at', null)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error checking active override:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error checking active override:', error);
    return null;
  }
}

interface ActivateOverrideParams {
  triggeredBy: string;
  affectedUser: string;
  reason: string;
  durationMinutes: number;
  justification: string;
  grantedPermissions: string[];
  notifiedUsers: string[];
}

async function activateEmergencyOverride(params: ActivateOverrideParams): Promise<string> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('emergency_overrides')
    .insert({
      triggered_by: params.triggeredBy,
      affected_user: params.affectedUser,
      reason: params.reason,
      duration_minutes: params.durationMinutes,
      granted_permissions: params.grantedPermissions,
      notified_users: params.notifiedUsers,
      justification: params.justification,
      activated_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to activate emergency override: ${error.message}`);
  }

  return data.id;
}

async function sendEmergencyNotifications(
  overrideId: string, 
  notifyUsers: string[], 
  reason: string, 
  affectedUserId: string
): Promise<void> {
  // In a real implementation, this would send push notifications, emails, SMS, etc.
  // For now, we'll just log the notification attempt
  console.log(`Emergency notification sent for override ${overrideId} to users: ${notifyUsers.join(', ')}`);
  
  // You could call a notification service or queue here
  // await notificationService.sendEmergencyAlert({
  //   recipients: notifyUsers,
  //   type: 'emergency_override_activated',
  //   data: { overrideId, reason, affectedUserId }
  // });
}

async function checkCanViewEmergencyOverrides(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    // Admin users and emergency contacts can view emergency overrides
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role:roles(type)')
      .eq('user_id', userId)
      .eq('state', 'active');

    return roles?.some((ur: any) => 
      ur.role?.type === 'admin' || 
      ur.role?.type === 'emergency_contact'
    ) || false;
  } catch (error) {
    console.error('Error checking view permission:', error);
    return false;
  }
}

async function getEmergencyOverrides(
  userId: string | null, 
  state: string, 
  limit: number, 
  offset: number
): Promise<any[]> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from('emergency_overrides')
      .select(`
        *,
        triggered_by_user:users!emergency_overrides_triggered_by_fkey(id, email),
        affected_user_data:users!emergency_overrides_affected_user_fkey(id, email)
      `)
      .range(offset, offset + limit - 1)
      .order('activated_at', { ascending: false });

    // Filter by user if specified
    if (userId) {
      query = query.eq('affected_user', userId);
    }

    // Filter by state
    if (state === 'active') {
      query = query
        .gt('expires_at', new Date().toISOString())
        .is('deactivated_at', null);
    } else if (state === 'expired') {
      query = query
        .lte('expires_at', new Date().toISOString())
        .is('deactivated_at', null);
    } else if (state === 'deactivated') {
      query = query.not('deactivated_at', 'is', null);
    }
    // 'all' doesn't add any filter

    const { data, error } = await query;

    if (error) {
      console.error('Error getting emergency overrides:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting emergency overrides:', error);
    return [];
  }
}

async function checkCanDeactivateEmergencyOverride(
  userId: string, 
  overrideId: string
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const supabase = await createClient();
    
    // Get override details
    const { data: override, error } = await supabase
      .from('emergency_overrides')
      .select('triggered_by, affected_user')
      .eq('id', overrideId)
      .single();

    if (error || !override) {
      return { allowed: false, reason: 'Emergency override not found' };
    }

    // User can deactivate if they triggered it or are the affected user
    if (override.triggered_by === userId || override.affected_user === userId) {
      return { allowed: true };
    }

    // Admin users can always deactivate
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('role:roles(type)')
      .eq('user_id', userId)
      .eq('state', 'active');

    const isAdmin = adminRoles?.some((ur: any) => ur.role?.type === 'admin');
    
    if (isAdmin) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Cannot deactivate emergency override' };
  } catch (error) {
    console.error('Error checking deactivation permission:', error);
    return { allowed: false, reason: 'Failed to check deactivation permission' };
  }
}

async function deactivateEmergencyOverride(
  overrideId: string, 
  deactivatedBy: string, 
  reason: string
): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('emergency_overrides')
    .update({
      deactivated_at: new Date().toISOString(),
      deactivated_by: deactivatedBy
    })
    .eq('id', overrideId);

  if (error) {
    throw new Error(`Failed to deactivate emergency override: ${error.message}`);
  }
}

async function getEmergencyOverrideById(overrideId: string): Promise<any> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('emergency_overrides')
      .select('*')
      .eq('id', overrideId)
      .single();

    if (error) {
      console.error('Error getting emergency override:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting emergency override:', error);
    return null;
  }
}