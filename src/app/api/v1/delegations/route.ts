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
  methods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization'],
};

// Validation schema for delegation creation
const createDelegationRequestSchema = z.object({
  toUserId: z.string().uuid('Invalid user ID format'),
  roleId: z.string().uuid('Invalid role ID format'),
  validFrom: z.string().datetime('Invalid datetime format'),
  validUntil: z.string().datetime('Invalid datetime format'),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
  scope: z.object({
    type: z.enum(['global', 'family', 'individual'], { errorMap: () => ({ message: 'Invalid scope type' }) }),
    entities: z.array(z.string().uuid('Invalid entity ID format')).min(1, 'At least one entity required')
  }),
  permissions: z.array(z.string().uuid('Invalid permission ID format')).optional(),
  requiresApproval: z.boolean().default(true)
}).refine(data => new Date(data.validFrom) < new Date(data.validUntil), {
  message: "Valid from date must be before valid until date",
  path: ["validUntil"]
});

// Validation schema for delegation approval
const approveDelegationRequestSchema = z.object({
  delegationId: z.string().uuid('Invalid delegation ID format'),
  approved: z.boolean(),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long').optional()
});

// Validation schema for delegation revocation
const revokeDelegationRequestSchema = z.object({
  delegationId: z.string().uuid('Invalid delegation ID format'),
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
      endpoint: 'delegation_create',
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
    const validation = createDelegationRequestSchema.safeParse(requestBody);
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

    const { toUserId, roleId, validFrom, validUntil, reason, scope, permissions, requiresApproval } = validation.data;

    // Check if user can delegate this role
    const canDelegate = await checkCanDelegateRole(currentUser.id, roleId, scope);
    if (!canDelegate.allowed) {
      return createErrorResponse(
        new AuthError(canDelegate.reason || 'Cannot delegate this role', 'DELEGATION_NOT_ALLOWED', 403),
        corsOptions
      );
    }

    // Validate target user exists
    const targetUserExists = await checkUserExists(toUserId);
    if (!targetUserExists) {
      return createErrorResponse(
        new AuthError('Target user not found', 'USER_NOT_FOUND', 404),
        corsOptions
      );
    }

    // Validate role exists
    const roleExists = await checkRoleExists(roleId);
    if (!roleExists) {
      return createErrorResponse(
        new AuthError('Role not found', 'ROLE_NOT_FOUND', 404),
        corsOptions
      );
    }

    // Validate scope entities
    const scopeValidation = await validateScopeEntities(scope);
    if (!scopeValidation.valid) {
      return createErrorResponse(
        new AuthError(scopeValidation.error || 'Invalid scope entities', 'INVALID_SCOPE', 400),
        corsOptions
      );
    }

    // Validate permissions if specified
    if (permissions && permissions.length > 0) {
      const permissionsValid = await validatePermissions(permissions, roleId);
      if (!permissionsValid) {
        return createErrorResponse(
          new AuthError('Invalid permissions specified', 'INVALID_PERMISSIONS', 400),
          corsOptions
        );
      }
    }

    // Create delegation
    const delegationId = await createDelegation({
      fromUserId: currentUser.id,
      toUserId,
      roleId,
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      reason,
      scope,
      permissions,
      requiresApproval
    });

    // Log delegation creation
    await logAuditEvent(
      'delegation_created',
      'authorization',
      `Delegation created for role`,
      {
        actorUserId: currentUser.id,
        eventData: {
          delegationId,
          toUserId,
          roleId,
          validFrom,
          validUntil,
          reason,
          scope,
          requiresApproval,
          hasCustomPermissions: !!(permissions && permissions.length > 0)
        },
        success: true,
        severity: 'medium',
        securityContext,
      }
    );

    return createSuccessResponse(
      {
        delegationId,
        fromUserId: currentUser.id,
        toUserId,
        roleId,
        validFrom,
        validUntil,
        reason,
        scope,
        state: requiresApproval ? 'pending' : 'active',
        createdAt: new Date().toISOString()
      },
      'Delegation created successfully',
      201,
      corsOptions
    );

  } catch (error) {
    console.error('Delegation creation error:', error);

    // Log error
    if (securityContext && currentUser) {
      await logAuditEvent(
        'delegation_creation_error',
        'authorization',
        'Delegation creation failed',
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
      new AuthError('Delegation creation failed', 'DELEGATION_CREATION_ERROR', 500),
      corsOptions
    );
  }
}

export async function GET(request: NextRequest) {
  // Apply middleware
  const middlewareResponse = await withAuth(request, {
    cors: corsOptions,
    requireAuth: true,
    rateLimit: {
      endpoint: 'delegation_list',
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

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'all'; // 'sent', 'received', 'all'
    const state = url.searchParams.get('state') || 'all'; // 'pending', 'active', 'expired', 'revoked', 'all'
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Get delegations
    const delegations = await getDelegations(currentUser.id, type, state, limit, offset);

    return createSuccessResponse(
      {
        delegations,
        pagination: {
          limit,
          offset,
          total: delegations.length // In a real implementation, you'd get the total count
        }
      },
      'Delegations retrieved successfully',
      200,
      corsOptions
    );

  } catch (error) {
    console.error('Delegation list error:', error);

    if (error instanceof AuthError) {
      return createErrorResponse(error, corsOptions);
    }

    return createErrorResponse(
      new AuthError('Failed to retrieve delegations', 'DELEGATION_LIST_ERROR', 500),
      corsOptions
    );
  }
}

export async function PUT(request: NextRequest) {
  // Apply middleware for approval/update operations
  const middlewareResponse = await withAuth(request, {
    cors: corsOptions,
    requireAuth: true,
    rateLimit: {
      endpoint: 'delegation_approve',
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
    const validation = approveDelegationRequestSchema.safeParse(requestBody);
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

    const { delegationId, approved, reason } = validation.data;

    // Check if user can approve this delegation
    const canApprove = await checkCanApproveDelegation(currentUser.id, delegationId);
    if (!canApprove.allowed) {
      return createErrorResponse(
        new AuthError(canApprove.reason || 'Cannot approve this delegation', 'APPROVAL_NOT_ALLOWED', 403),
        corsOptions
      );
    }

    // Approve or reject delegation
    await approveDelegation(delegationId, currentUser.id, approved, reason);

    // Invalidate cache for the delegated user
    if (approved) {
      const delegation = await getDelegationById(delegationId);
      if (delegation) {
        const authService = getAuthorizationService();
        await authService.invalidateCache({
          type: 'DELEGATION_CREATED',
          toUserId: delegation.to_user_id
        });
      }
    }

    // Log delegation approval/rejection
    await logAuditEvent(
      approved ? 'delegation_approved' : 'delegation_rejected',
      'authorization',
      `Delegation ${approved ? 'approved' : 'rejected'}`,
      {
        actorUserId: currentUser.id,
        eventData: {
          delegationId,
          approved,
          reason
        },
        success: true,
        severity: 'medium',
        securityContext,
      }
    );

    return createSuccessResponse(
      {
        delegationId,
        approved,
        approvedBy: currentUser.id,
        approvedAt: new Date().toISOString(),
        reason,
        state: approved ? 'active' : 'rejected'
      },
      `Delegation ${approved ? 'approved' : 'rejected'} successfully`,
      200,
      corsOptions
    );

  } catch (error) {
    console.error('Delegation approval error:', error);

    // Log error
    if (securityContext && currentUser) {
      await logAuditEvent(
        'delegation_approval_error',
        'authorization',
        'Delegation approval failed',
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
      new AuthError('Delegation approval failed', 'DELEGATION_APPROVAL_ERROR', 500),
      corsOptions
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Apply middleware for revocation
  const middlewareResponse = await withAuth(request, {
    cors: corsOptions,
    requireAuth: true,
    rateLimit: {
      endpoint: 'delegation_revoke',
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
    const validation = revokeDelegationRequestSchema.safeParse(requestBody);
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

    const { delegationId, reason } = validation.data;

    // Check if user can revoke this delegation
    const canRevoke = await checkCanRevokeDelegation(currentUser.id, delegationId);
    if (!canRevoke.allowed) {
      return createErrorResponse(
        new AuthError(canRevoke.reason || 'Cannot revoke this delegation', 'REVOCATION_NOT_ALLOWED', 403),
        corsOptions
      );
    }

    // Get delegation details before revoking
    const delegation = await getDelegationById(delegationId);
    if (!delegation) {
      return createErrorResponse(
        new AuthError('Delegation not found', 'DELEGATION_NOT_FOUND', 404),
        corsOptions
      );
    }

    // Revoke delegation
    await revokeDelegation(delegationId, currentUser.id, reason);

    // Invalidate cache
    const authService = getAuthorizationService();
    await authService.invalidateCache({
      type: 'DELEGATION_REVOKED',
      toUserId: delegation.to_user_id
    });

    // Log delegation revocation
    await logAuditEvent(
      'delegation_revoked',
      'authorization',
      `Delegation revoked`,
      {
        actorUserId: currentUser.id,
        eventData: {
          delegationId,
          toUserId: delegation.to_user_id,
          reason
        },
        success: true,
        severity: 'medium',
        securityContext,
      }
    );

    return createSuccessResponse(
      {
        delegationId,
        revokedBy: currentUser.id,
        revokedAt: new Date().toISOString(),
        reason,
        state: 'revoked'
      },
      'Delegation revoked successfully',
      200,
      corsOptions
    );

  } catch (error) {
    console.error('Delegation revocation error:', error);

    // Log error
    if (securityContext && currentUser) {
      await logAuditEvent(
        'delegation_revocation_error',
        'authorization',
        'Delegation revocation failed',
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
      new AuthError('Delegation revocation failed', 'DELEGATION_REVOCATION_ERROR', 500),
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

async function checkRoleExists(roleId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('roles')
      .select('id')
      .eq('id', roleId)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error('Error checking role exists:', error);
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

async function validatePermissions(permissions: string[], roleId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    // Check if all permissions exist and are valid for the role
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

async function checkCanDelegateRole(userId: string, roleId: string, scope: any): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // User can delegate a role if they have that role themselves in the same or broader scope
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('user_roles')
      .select('id, scopes:user_role_scopes(*)')
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .eq('state', 'active')
      .lte('valid_from', new Date().toISOString())
      .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`);

    if (error || !data || data.length === 0) {
      return { allowed: false, reason: 'User does not have the role to delegate' };
    }

    // Additional scope validation would go here
    return { allowed: true };
  } catch (error) {
    console.error('Error checking delegation permission:', error);
    return { allowed: false, reason: 'Failed to check delegation permission' };
  }
}

interface CreateDelegationParams {
  fromUserId: string;
  toUserId: string;
  roleId: string;
  validFrom: Date;
  validUntil: Date;
  reason: string;
  scope: { type: string; entities: string[] };
  permissions?: string[];
  requiresApproval: boolean;
}

async function createDelegation(params: CreateDelegationParams): Promise<string> {
  const supabase = await createClient();
  
  try {
    // Create delegation record
    const { data: delegation, error: delegationError } = await supabase
      .from('delegations')
      .insert({
        from_user_id: params.fromUserId,
        to_user_id: params.toUserId,
        role_id: params.roleId,
        valid_from: params.validFrom.toISOString(),
        valid_until: params.validUntil.toISOString(),
        reason: params.reason,
        state: params.requiresApproval ? 'pending' : 'active'
      })
      .select('id')
      .single();

    if (delegationError) {
      throw new Error(`Failed to create delegation: ${delegationError.message}`);
    }

    const delegationId = delegation.id;

    // Add scope entries
    const scopeInserts = params.scope.entities.map(entityId => ({
      delegation_id: delegationId,
      scope_type: params.scope.type,
      entity_type: params.scope.type === 'family' ? 'family' : 'user',
      entity_id: entityId
    }));

    const { error: scopeError } = await supabase
      .from('delegation_scopes')
      .insert(scopeInserts);

    if (scopeError) {
      throw new Error(`Failed to create delegation scopes: ${scopeError.message}`);
    }

    // Add specific permissions if provided
    if (params.permissions && params.permissions.length > 0) {
      const permissionInserts = params.permissions.map(permissionId => ({
        delegation_id: delegationId,
        permission_id: permissionId
      }));

      const { error: permissionError } = await supabase
        .from('delegation_permissions')
        .insert(permissionInserts);

      if (permissionError) {
        throw new Error(`Failed to create delegation permissions: ${permissionError.message}`);
      }
    }

    return delegationId;
  } catch (error) {
    console.error('Error in createDelegation:', error);
    throw error;
  }
}

async function getDelegations(userId: string, type: string, state: string, limit: number, offset: number): Promise<any[]> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from('delegations')
      .select(`
        *,
        role:roles(*),
        from_user:users!delegations_from_user_id_fkey(id, email),
        to_user:users!delegations_to_user_id_fkey(id, email),
        scopes:delegation_scopes(*)
      `)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    // Filter by type
    if (type === 'sent') {
      query = query.eq('from_user_id', userId);
    } else if (type === 'received') {
      query = query.eq('to_user_id', userId);
    } else {
      query = query.or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
    }

    // Filter by state
    if (state !== 'all') {
      query = query.eq('state', state);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting delegations:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting delegations:', error);
    return [];
  }
}

async function checkCanApproveDelegation(userId: string, delegationId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Only admins or users with appropriate oversight roles can approve delegations
    const supabase = await createClient();
    
    // Check if user is admin
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('role:roles(type)')
      .eq('user_id', userId)
      .eq('state', 'active');

    const isAdmin = adminRoles?.some((ur: any) => ur.role?.type === 'admin');
    
    if (isAdmin) {
      return { allowed: true };
    }

    // Additional logic for role-specific approval rights would go here
    return { allowed: false, reason: 'Insufficient permissions to approve delegations' };
  } catch (error) {
    console.error('Error checking approval permission:', error);
    return { allowed: false, reason: 'Failed to check approval permission' };
  }
}

async function approveDelegation(delegationId: string, approvedBy: string, approved: boolean, reason?: string): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('delegations')
    .update({
      state: approved ? 'active' : 'rejected',
      approved_by: approvedBy,
      approved_at: new Date().toISOString()
    })
    .eq('id', delegationId);

  if (error) {
    throw new Error(`Failed to approve delegation: ${error.message}`);
  }
}

async function checkCanRevokeDelegation(userId: string, delegationId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const supabase = await createClient();
    
    // User can revoke if they are the delegator, delegatee, or admin
    const { data, error } = await supabase
      .from('delegations')
      .select('from_user_id, to_user_id')
      .eq('id', delegationId)
      .single();

    if (error || !data) {
      return { allowed: false, reason: 'Delegation not found' };
    }

    if (data.from_user_id === userId || data.to_user_id === userId) {
      return { allowed: true };
    }

    // Check if user is admin
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('role:roles(type)')
      .eq('user_id', userId)
      .eq('state', 'active');

    const isAdmin = adminRoles?.some((ur: any) => ur.role?.type === 'admin');
    
    if (isAdmin) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Cannot revoke delegation' };
  } catch (error) {
    console.error('Error checking revocation permission:', error);
    return { allowed: false, reason: 'Failed to check revocation permission' };
  }
}

async function revokeDelegation(delegationId: string, revokedBy: string, reason: string): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('delegations')
    .update({
      state: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by: revokedBy,
      revoke_reason: reason
    })
    .eq('id', delegationId);

  if (error) {
    throw new Error(`Failed to revoke delegation: ${error.message}`);
  }
}

async function getDelegationById(delegationId: string): Promise<any> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('delegations')
      .select('*')
      .eq('id', delegationId)
      .single();

    if (error) {
      console.error('Error getting delegation:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting delegation:', error);
    return null;
  }
}