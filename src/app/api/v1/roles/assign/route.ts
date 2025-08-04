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
import { getAuthorizationService, RoleType, RoleState } from '@/lib/auth/authorization-service';
import { z } from 'zod';

const corsOptions = {
  origins: ['http://localhost:3000', 'https://familyhub.care'],
  methods: ['POST', 'PUT', 'DELETE', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization'],
};

// Validation schema for role assignment
const assignRoleRequestSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  roleType: z.nativeEnum(RoleType, { errorMap: () => ({ message: 'Invalid role type' }) }),
  scope: z.object({
    type: z.enum(['global', 'family', 'individual'], { errorMap: () => ({ message: 'Invalid scope type' }) }),
    entities: z.array(z.string().uuid('Invalid entity ID format')).min(1, 'At least one entity required')
  }),
  validUntil: z.string().datetime('Invalid datetime format').optional(),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
  recurringSchedule: z.object({
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1, 'At least one day required'),
    timeStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
    timeEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
    timezone: z.string().min(1, 'Timezone required')
  }).optional()
});

// Validation schema for role revocation
const revokeRoleRequestSchema = z.object({
  userRoleId: z.string().uuid('Invalid user role ID format'),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long')
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
      endpoint: 'role_assign',
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

    // Check if user has admin permissions
    const hasAdminRole = await checkHasAdminRole(currentUser.id);
    if (!hasAdminRole) {
      return createErrorResponse(
        new AuthError('Admin permissions required', 'INSUFFICIENT_PERMISSIONS', 403),
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
    const validation = assignRoleRequestSchema.safeParse(requestBody);
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

    const { userId, roleType, scope, validUntil, reason, recurringSchedule } = validation.data;

    // Validate time range for recurring schedule
    if (recurringSchedule) {
      const startMinutes = parseTime(recurringSchedule.timeStart);
      const endMinutes = parseTime(recurringSchedule.timeEnd);
      if (startMinutes >= endMinutes) {
        return createValidationErrorResponse(
          { 'recurringSchedule.timeEnd': ['End time must be after start time'] },
          corsOptions
        );
      }
    }

    // Check if target user exists
    const targetUserExists = await checkUserExists(userId);
    if (!targetUserExists) {
      return createErrorResponse(
        new AuthError('Target user not found', 'USER_NOT_FOUND', 404),
        corsOptions
      );
    }

    // Validate scope entities exist
    const scopeValidation = await validateScopeEntities(scope);
    if (!scopeValidation.valid) {
      return createErrorResponse(
        new AuthError(scopeValidation.error || 'Invalid scope entities', 'INVALID_SCOPE', 400),
        corsOptions
      );
    }

    // Get the role ID for the role type
    const roleId = await getRoleIdByType(roleType);
    if (!roleId) {
      return createErrorResponse(
        new AuthError('Role type not found', 'ROLE_NOT_FOUND', 404),
        corsOptions
      );
    }

    // Assign the role
    const userRoleId = await assignRole({
      userId,
      roleId,
      grantedBy: currentUser.id,
      reason,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      scope,
      recurringSchedule
    });

    // Invalidate cache
    const authService = getAuthorizationService();
    await authService.invalidateCache({
      type: 'ROLE_ASSIGNED',
      userId
    });

    // Log role assignment
    await logAuditEvent(
      'role_assigned',
      'authorization',
      `Role ${roleType} assigned to user`,
      {
        actorUserId: currentUser.id,
        eventData: {
          targetUserId: userId,
          roleType,
          roleId,
          userRoleId,
          scope,
          validUntil,
          reason,
          hasRecurringSchedule: !!recurringSchedule
        },
        success: true,
        severity: 'medium',
        securityContext,
      }
    );

    return createSuccessResponse(
      {
        userRoleId,
        userId,
        roleType,
        roleId,
        assignedBy: currentUser.id,
        assignedAt: new Date().toISOString(),
        scope,
        validUntil,
        state: RoleState.ACTIVE
      },
      'Role assigned successfully',
      201,
      corsOptions
    );

  } catch (error) {
    console.error('Role assignment error:', error);

    // Log error
    if (securityContext && currentUser) {
      await logAuditEvent(
        'role_assignment_error',
        'authorization',
        'Role assignment failed',
        {
          actorUserId: currentUser.id,
          eventData: {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestBody
          },
          severity: 'high',
          success: false,
          securityContext,
        }
      );
    }

    if (error instanceof AuthError) {
      return createErrorResponse(error, corsOptions);
    }

    return createErrorResponse(
      new AuthError('Role assignment failed', 'ROLE_ASSIGNMENT_ERROR', 500),
      corsOptions
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Apply middleware with rate limiting
  const middlewareResponse = await withAuth(request, {
    cors: corsOptions,
    requireAuth: true,
    rateLimit: {
      endpoint: 'role_revoke',
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

    // Check if user has admin permissions
    const hasAdminRole = await checkHasAdminRole(currentUser.id);
    if (!hasAdminRole) {
      return createErrorResponse(
        new AuthError('Admin permissions required', 'INSUFFICIENT_PERMISSIONS', 403),
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
    const validation = revokeRoleRequestSchema.safeParse(requestBody);
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

    const { userRoleId, reason } = validation.data;

    // Get the role assignment to validate it exists and get user info
    const roleAssignment = await getUserRoleById(userRoleId);
    if (!roleAssignment) {
      return createErrorResponse(
        new AuthError('Role assignment not found', 'ROLE_ASSIGNMENT_NOT_FOUND', 404),
        corsOptions
      );
    }

    // Revoke the role
    await revokeRole(userRoleId, currentUser.id, reason);

    // Invalidate cache
    const authService = getAuthorizationService();
    await authService.invalidateCache({
      type: 'ROLE_REVOKED',
      userId: roleAssignment.user_id
    });

    // Log role revocation
    await logAuditEvent(
      'role_revoked',
      'authorization',
      `Role revoked from user`,
      {
        actorUserId: currentUser.id,
        eventData: {
          targetUserId: roleAssignment.user_id,
          roleId: roleAssignment.role_id,
          userRoleId,
          reason
        },
        success: true,
        severity: 'medium',
        securityContext,
      }
    );

    return createSuccessResponse(
      {
        userRoleId,
        revokedBy: currentUser.id,
        revokedAt: new Date().toISOString(),
        reason,
        state: RoleState.REVOKED
      },
      'Role revoked successfully',
      200,
      corsOptions
    );

  } catch (error) {
    console.error('Role revocation error:', error);

    // Log error
    if (securityContext && currentUser) {
      await logAuditEvent(
        'role_revocation_error',
        'authorization',
        'Role revocation failed',
        {
          actorUserId: currentUser.id,
          eventData: {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestBody
          },
          severity: 'high',
          success: false,
          securityContext,
        }
      );
    }

    if (error instanceof AuthError) {
      return createErrorResponse(error, corsOptions);
    }

    return createErrorResponse(
      new AuthError('Role revocation failed', 'ROLE_REVOCATION_ERROR', 500),
      corsOptions
    );
  }
}

// Helper functions

async function checkHasAdminRole(userId: string): Promise<boolean> {
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
      console.error('Error checking admin role:', error);
      return false;
    }

    return (data || []).some((userRole: any) => userRole.role?.type === 'admin');
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
}

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

async function validateScopeEntities(scope: { type: string; entities: string[] }): Promise<{ valid: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    
    for (const entityId of scope.entities) {
      let exists = false;
      
      if (scope.type === 'family') {
        const { data } = await supabase
          .from('families')
          .select('id')
          .eq('id', entityId)
          .single();
        exists = !!data;
      } else if (scope.type === 'individual') {
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('id', entityId)
          .single();
        exists = !!data;
      } else if (scope.type === 'global') {
        exists = true; // Global scope doesn't need entity validation
      }
      
      if (!exists) {
        return { valid: false, error: `Entity ${entityId} not found for scope type ${scope.type}` };
      }
    }
    
    return { valid: true };
  } catch (error) {
    console.error('Error validating scope entities:', error);
    return { valid: false, error: 'Failed to validate scope entities' };
  }
}

async function getRoleIdByType(roleType: RoleType): Promise<string | null> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('roles')
      .select('id')
      .eq('type', roleType)
      .eq('state', 'active')
      .single();

    if (error) {
      console.error('Error getting role ID:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('Error getting role ID:', error);
    return null;
  }
}

interface AssignRoleParams {
  userId: string;
  roleId: string;
  grantedBy: string;
  reason: string;
  validUntil?: Date;
  scope: { type: string; entities: string[] };
  recurringSchedule?: {
    daysOfWeek: number[];
    timeStart: string;
    timeEnd: string;
    timezone: string;
  };
}

async function assignRole(params: AssignRoleParams): Promise<string> {
  const supabase = await createClient();
  
  try {
    // Start transaction
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: params.userId,
        role_id: params.roleId,
        granted_by: params.grantedBy,
        reason: params.reason,
        valid_from: new Date().toISOString(),
        valid_until: params.validUntil?.toISOString(),
        state: 'active'
      })
      .select('id')
      .single();

    if (roleError) {
      throw new Error(`Failed to assign role: ${roleError.message}`);
    }

    const userRoleId = userRole.id;

    // Add scope entries
    const scopeInserts = params.scope.entities.map(entityId => ({
      user_role_id: userRoleId,
      scope_type: params.scope.type,
      entity_type: params.scope.type === 'family' ? 'family' : 'user',
      entity_id: entityId
    }));

    const { error: scopeError } = await supabase
      .from('user_role_scopes')
      .insert(scopeInserts);

    if (scopeError) {
      throw new Error(`Failed to assign role scopes: ${scopeError.message}`);
    }

    // Add recurring schedule if provided
    if (params.recurringSchedule) {
      const { error: scheduleError } = await supabase
        .from('recurring_schedules')
        .insert({
          user_role_id: userRoleId,
          days_of_week: params.recurringSchedule.daysOfWeek,
          time_start: params.recurringSchedule.timeStart,
          time_end: params.recurringSchedule.timeEnd,
          timezone: params.recurringSchedule.timezone
        });

      if (scheduleError) {
        throw new Error(`Failed to assign recurring schedule: ${scheduleError.message}`);
      }
    }

    return userRoleId;
  } catch (error) {
    console.error('Error in assignRole:', error);
    throw error;
  }
}

async function revokeRole(userRoleId: string, revokedBy: string, reason: string): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('user_roles')
    .update({
      state: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by: revokedBy,
      revoke_reason: reason,
      state_changed_at: new Date().toISOString(),
      state_changed_by: revokedBy
    })
    .eq('id', userRoleId);

  if (error) {
    throw new Error(`Failed to revoke role: ${error.message}`);
  }
}

async function getUserRoleById(userRoleId: string): Promise<any> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, role_id')
      .eq('id', userRoleId)
      .single();

    if (error) {
      console.error('Error getting user role:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

function parseTime(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}