import { createClient, createAdminClient } from '@/lib/supabase/server';
import { AuthError, logAuditEvent } from './utils';
import { getRateLimiter, RateLimitError } from './rate-limiter';

// =============================================
// Type Definitions
// =============================================

export enum RoleType {
  ADMIN = 'admin',
  CAREGIVER = 'caregiver',
  VIEWER = 'viewer',
  CARE_RECIPIENT = 'care_recipient',
  CHILD = 'child',
  HELPER = 'helper',
  EMERGENCY_CONTACT = 'emergency_contact',
  BOT_AGENT = 'bot_agent'
}

export enum RoleState {
  PENDING_APPROVAL = 'pending_approval',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

export interface Role {
  id: string;
  type: RoleType;
  state: RoleState;
  name: string;
  description: string;
  permissionSets: PermissionSet[];
  priority: number;
  tags: string[];
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  effect: 'allow' | 'deny';
  scope: 'own' | 'assigned' | 'family' | 'all';
  description?: string;
}

export interface PermissionSet {
  id: string;
  name: string;
  description: string;
  parentSetId?: string;
  permissions: Permission[];
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  role: Role;
  grantedBy: string;
  reason: string;
  assignedAt: Date;
  validFrom: Date;
  validUntil?: Date;
  state: RoleState;
  scopes: RoleScope[];
  recurringSchedule?: RecurringSchedule;
}

export interface RoleScope {
  id: string;
  userRoleId: string;
  scopeType: 'global' | 'family' | 'individual';
  entityType: 'user' | 'family' | 'group';
  entityId: string;
}

export interface RecurringSchedule {
  id: string;
  userRoleId: string;
  daysOfWeek: number[]; // 0-6, Sunday-Saturday
  timeStart: string; // HH:MM format
  timeEnd: string; // HH:MM format
  timezone: string;
}

export interface Delegation {
  id: string;
  fromUserId: string;
  toUserId: string;
  roleId: string;
  role: Role;
  validFrom: Date;
  validUntil: Date;
  reason: string;
  approvedBy?: string;
  approvedAt?: Date;
  state: 'pending' | 'active' | 'expired' | 'revoked';
  scopes: DelegationScope[];
  permissions?: Permission[]; // Subset of permissions if specified
}

export interface DelegationScope {
  id: string;
  delegationId: string;
  scopeType: 'global' | 'family' | 'individual';
  entityType: 'user' | 'family' | 'group';
  entityId: string;
}

export interface EmergencyOverride {
  id: string;
  triggeredBy: string;
  affectedUser: string;
  reason: 'no_response_24h' | 'panic_button' | 'admin_override' | 'medical_emergency';
  durationMinutes: number;
  grantedPermissions: string[]; // Permission IDs
  notifiedUsers: string[];
  activatedAt: Date;
  expiresAt: Date;
  deactivatedAt?: Date;
  deactivatedBy?: string;
  justification: string;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason: string;
  source?: 'DIRECT_ROLE' | 'DELEGATION' | 'EMERGENCY_OVERRIDE';
  roleId?: string;
  delegationId?: string;
  emergencyOverrideId?: string;
  details?: Record<string, any>;
}

export interface PermissionSource {
  type: 'DIRECT_ROLE' | 'DELEGATION';
  role?: Role;
  delegation?: Delegation;
  priority: number;
  permissions: Permission[];
  recurringSchedule?: RecurringSchedule;
  active?: boolean;
}

export interface CacheInvalidationTrigger {
  type: 'ROLE_ASSIGNED' | 'ROLE_REVOKED' | 'DELEGATION_CREATED' | 'DELEGATION_REVOKED' | 'PERMISSION_SET_UPDATED';
  userId?: string;
  toUserId?: string;
  permissionSetId?: string;
}

// RateLimit interface moved to ./rate-limiter.ts

// Note: CachedPermission interface moved to ./permission-cache.ts

// Rate limiting is now handled by the RBACRateLimiter imported from './rate-limiter'

// Note: PermissionCache implementation moved to ./permission-cache.ts

// =============================================
// Main Authorization Service
// =============================================

export class AuthorizationService {
  private cache: PermissionCache;
  
  constructor() {
    this.cache = new PermissionCache();
  }

  /**
   * Main authorization entry point
   * @returns AuthorizationResult with detailed decision reasoning
   */
  async authorize(
    userId: string,
    action: string,
    resourceId: string,
    resourceType: string
  ): Promise<AuthorizationResult> {
    try {
      // 1. Rate limiting check
      const rateLimiter = getRateLimiter();
      const rateLimitResult = await rateLimiter.checkPermissionLimit(userId, resourceType);
      
      if (!rateLimitResult.allowed) {
        return {
          allowed: false,
          reason: 'RATE_LIMIT_EXCEEDED',
          details: { 
            retryAfter: rateLimitResult.retryAfter,
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            backoffLevel: rateLimitResult.backoffLevel
          }
        };
      }
      
      // 2. Check cache
      const cacheKey = `${userId}:${action}:${resourceId}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached.result;
      }
      
      // 3. Emergency override check
      const emergency = await this.checkEmergencyOverride(userId, resourceId);
      if (emergency.active) {
        await this.auditEmergencyAccess(userId, action, resourceId, emergency);
        return {
          allowed: true,
          reason: 'EMERGENCY_OVERRIDE',
          source: 'EMERGENCY_OVERRIDE',
          emergencyOverrideId: emergency.id,
          details: emergency
        };
      }
      
      // 4. Gather all applicable permissions
      const permissions = await this.gatherPermissions(userId, resourceId);
      
      // 5. Apply precedence rules
      const decision = this.evaluateWithPrecedence(permissions, action, resourceType);
      
      // 6. Audit the check (async, non-blocking)
      this.auditPermissionCheck(userId, action, resourceId, decision).catch(err => {
        console.error('Failed to audit permission check:', err);
      });
      
      // 7. Update cache
      await this.cache.set(cacheKey, decision, this.getCacheTTL(action));
      
      return decision;
    } catch (error) {
      console.error('Authorization error:', error);
      return {
        allowed: false,
        reason: 'AUTHORIZATION_ERROR',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
  
  /**
   * Gather all permissions from different sources
   */
  private async gatherPermissions(
    userId: string,
    resourceId: string
  ): Promise<PermissionSource[]> {
    const sources: PermissionSource[] = [];
    
    try {
      // 1. Direct role assignments
      const directRoles = await this.getDirectRoles(userId, resourceId);
      sources.push(...directRoles.map(r => ({
        type: 'DIRECT_ROLE' as const,
        role: r.role,
        priority: r.role.priority,
        permissions: this.expandPermissionSets(r.role.permissionSets),
        recurringSchedule: r.recurringSchedule
      })));
      
      // 2. Active delegations
      const delegations = await this.getActiveDelegations(userId, resourceId);
      sources.push(...delegations.map(d => ({
        type: 'DELEGATION' as const,
        delegation: d,
        priority: d.role.priority - 10, // Delegations have lower priority
        permissions: d.permissions || this.expandPermissionSets(d.role.permissionSets),
        recurringSchedule: undefined // Delegations don't use recurring schedules
      })));
      
      // 3. Check recurring schedules
      const now = new Date();
      sources.forEach(source => {
        if (source.recurringSchedule && !this.isWithinSchedule(now, source.recurringSchedule)) {
          source.active = false;
        }
      });
      
      return sources.filter(s => s.active !== false);
    } catch (error) {
      console.error('Error gathering permissions:', error);
      return [];
    }
  }
  
  /**
   * Apply precedence rules for conflict resolution
   */
  private evaluateWithPrecedence(
    sources: PermissionSource[],
    action: string,
    resourceType: string
  ): AuthorizationResult {
    // Sort by precedence order
    const precedenceOrder = [
      'DIRECT_ROLE_DENY',
      'DELEGATION_DENY',
      'DIRECT_ROLE_ALLOW',
      'DELEGATION_ALLOW'
    ];
    
    for (const precedence of precedenceOrder) {
      for (const source of sources) {
        const permission = this.findPermission(source.permissions, action, resourceType);
        if (!permission) continue;
        
        const isDeny = permission.effect === 'deny';
        const sourceType = source.type === 'DIRECT_ROLE' ? 'DIRECT_ROLE' : 'DELEGATION';
        const currentPrecedence = `${sourceType}_${isDeny ? 'DENY' : 'ALLOW'}`;
        
        if (currentPrecedence === precedence) {
          // Log conflicts if this overrides other permissions
          if (isDeny) {
            this.logConflict(sources, source, action, resourceType).catch(err => {
              console.error('Failed to log conflict:', err);
            });
          }
          
          return {
            allowed: !isDeny,
            reason: currentPrecedence,
            source: source.type,
            roleId: source.role?.id,
            delegationId: source.delegation?.id,
            details: {
              matchedPermission: permission,
              allSources: sources.map(s => s.type)
            }
          };
        }
      }
    }
    
    return {
      allowed: false,
      reason: 'NO_PERMISSION',
      details: { checkedSources: sources.length }
    };
  }

  /**
   * Find matching permission for action and resource type
   */
  private findPermission(permissions: Permission[], action: string, resourceType: string): Permission | undefined {
    return permissions.find(p => 
      (p.action === action || p.action === '*') && 
      (p.resource === resourceType || p.resource === '*')
    );
  }

  /**
   * Log permission conflicts
   */
  private async logConflict(
    sources: PermissionSource[],
    winningSource: PermissionSource,
    action: string,
    resourceType: string
  ): Promise<void> {
    await logAuditEvent(
      'permission_conflict_resolved',
      'authorization',
      `Permission conflict resolved for ${action} on ${resourceType}`,
      {
        eventData: {
          action,
          resourceType,
          winningSource: winningSource.type,
          totalSources: sources.length,
          sources: sources.map(s => ({
            type: s.type,
            roleId: s.role?.id,
            delegationId: s.delegation?.id
          }))
        },
        severity: 'medium'
      }
    );
  }
  
  /**
   * Check if current time is within recurring schedule
   */
  private isWithinSchedule(now: Date, schedule: RecurringSchedule): boolean {
    try {
      const userTime = this.convertToTimezone(now, schedule.timezone);
      const dayOfWeek = userTime.getDay();
      
      if (!schedule.daysOfWeek.includes(dayOfWeek)) {
        return false;
      }
      
      const currentTime = userTime.getHours() * 60 + userTime.getMinutes();
      const startMinutes = this.parseTime(schedule.timeStart);
      const endMinutes = this.parseTime(schedule.timeEnd);
      
      return currentTime >= startMinutes && currentTime <= endMinutes;
    } catch (error) {
      console.error('Error checking schedule:', error);
      return false;
    }
  }

  /**
   * Convert date to specific timezone
   */
  private convertToTimezone(date: Date, timezone: string): Date {
    try {
      return new Date(date.toLocaleString("en-US", { timeZone: timezone }));
    } catch (error) {
      console.error('Error converting timezone:', error);
      return date; // Fallback to original date
    }
  }

  /**
   * Parse time string to minutes since midnight
   */
  private parseTime(timeString: string): number {
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      return hours * 60 + minutes;
    } catch (error) {
      console.error('Error parsing time:', error);
      return 0;
    }
  }

  /**
   * Get direct role assignments for user
   */
  private async getDirectRoles(userId: string, resourceId: string): Promise<UserRole[]> {
    try {
      const supabase = await createClient();
      
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          *,
          role:roles(*),
          scopes:user_role_scopes(*),
          recurring_schedule:recurring_schedules(*)
        `)
        .eq('user_id', userId)
        .eq('state', 'active')
        .lte('valid_from', new Date().toISOString())
        .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`);

      if (error) {
        console.error('Error fetching direct roles:', error);
        return [];
      }

      return (data || []).map(this.mapUserRole);
    } catch (error) {
      console.error('Error getting direct roles:', error);
      return [];
    }
  }

  /**
   * Get active delegations for user
   */
  private async getActiveDelegations(userId: string, resourceId: string): Promise<Delegation[]> {
    try {
      const supabase = await createClient();
      
      const { data, error } = await supabase
        .from('delegations')
        .select(`
          *,
          role:roles(*),
          scopes:delegation_scopes(*),
          permissions:delegation_permissions(permission:permissions(*))
        `)
        .eq('to_user_id', userId)
        .eq('state', 'active')
        .lte('valid_from', new Date().toISOString())
        .gt('valid_until', new Date().toISOString());

      if (error) {
        console.error('Error fetching delegations:', error);
        return [];
      }

      return (data || []).map(this.mapDelegation);
    } catch (error) {
      console.error('Error getting active delegations:', error);
      return [];
    }
  }

  /**
   * Check for active emergency overrides
   */
  private async checkEmergencyOverride(userId: string, resourceId: string): Promise<{ active: boolean; id?: string; override?: EmergencyOverride }> {
    try {
      const supabase = await createClient();
      
      const { data, error } = await supabase
        .from('emergency_overrides')
        .select('*')
        .eq('affected_user', userId)
        .gt('expires_at', new Date().toISOString())
        .is('deactivated_at', null)
        .order('activated_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return { active: false };
      }

      return {
        active: true,
        id: data.id,
        override: this.mapEmergencyOverride(data)
      };
    } catch (error) {
      console.error('Error checking emergency override:', error);
      return { active: false };
    }
  }

  /**
   * Expand permission sets to individual permissions
   */
  private expandPermissionSets(permissionSets: PermissionSet[]): Permission[] {
    const permissions: Permission[] = [];
    const processedSets = new Set<string>();

    for (const permissionSet of permissionSets) {
      this.expandPermissionSetRecursive(permissionSet, permissions, processedSets);
    }

    return permissions;
  }

  /**
   * Recursively expand permission sets (handling inheritance)
   */
  private expandPermissionSetRecursive(
    permissionSet: PermissionSet,
    permissions: Permission[],
    processedSets: Set<string>
  ): void {
    if (processedSets.has(permissionSet.id)) {
      return; // Prevent circular dependencies
    }

    processedSets.add(permissionSet.id);
    permissions.push(...permissionSet.permissions);

    // Process parent permission sets if any
    if (permissionSet.parentSetId) {
      // In a real implementation, you would fetch the parent set from database
      // For now, we'll skip parent set expansion to avoid infinite recursion
    }
  }

  /**
   * Get cache TTL based on action type
   */
  private getCacheTTL(action: string): number {
    const ttlMap: Record<string, number> = {
      'read': 300,    // 5 minutes
      'write': 60,    // 1 minute
      'delete': 30,   // 30 seconds
      'admin': 10     // 10 seconds
    };
    
    return ttlMap[action] || 60;
  }

  /**
   * Audit permission check
   */
  private async auditPermissionCheck(
    userId: string,
    action: string,
    resourceId: string,
    decision: AuthorizationResult
  ): Promise<void> {
    await logAuditEvent(
      'permission_check',
      'authorization',
      `Permission check: ${action} on ${resourceId}`,
      {
        actorUserId: userId,
        eventData: {
          action,
          resourceId,
          allowed: decision.allowed,
          reason: decision.reason,
          source: decision.source
        },
        success: decision.allowed,
        severity: decision.allowed ? 'low' : 'medium'
      }
    );
  }

  /**
   * Audit emergency access
   */
  private async auditEmergencyAccess(
    userId: string,
    action: string,
    resourceId: string,
    emergency: { id?: string; override?: EmergencyOverride }
  ): Promise<void> {
    await logAuditEvent(
      'emergency_access_granted',
      'security',
      `Emergency access granted for ${action} on ${resourceId}`,
      {
        actorUserId: userId,
        eventData: {
          action,
          resourceId,
          emergencyOverrideId: emergency.id,
          reason: emergency.override?.reason,
          triggeredBy: emergency.override?.triggeredBy
        },
        severity: 'high'
      }
    );
  }

  /**
   * Invalidate cache entries when permissions change
   */
  async invalidateCache(trigger: CacheInvalidationTrigger): Promise<void> {
    try {
      switch (trigger.type) {
        case 'ROLE_ASSIGNED':
        case 'ROLE_REVOKED':
          if (trigger.userId) {
            await this.cache.invalidatePattern(`${trigger.userId}:*`);
          }
          break;
        
        case 'DELEGATION_CREATED':
        case 'DELEGATION_REVOKED':
          if (trigger.toUserId) {
            await this.cache.invalidatePattern(`${trigger.toUserId}:*`);
          }
          break;
        
        case 'PERMISSION_SET_UPDATED':
          if (trigger.permissionSetId) {
            // Invalidate all users with affected roles
            const affectedUsers = await this.getUsersWithPermissionSet(trigger.permissionSetId);
            for (const userId of affectedUsers) {
              await this.cache.invalidatePattern(`${userId}:*`);
            }
          }
          break;
      }
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }

  /**
   * Get users affected by permission set changes
   */
  private async getUsersWithPermissionSet(permissionSetId: string): Promise<string[]> {
    try {
      const supabase = await createClient();
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role_id', 
          supabase
            .from('role_permission_sets')
            .select('role_id')
            .eq('permission_set_id', permissionSetId)
        );

      if (error) {
        console.error('Error getting users with permission set:', error);
        return [];
      }

      return (data || []).map(row => row.user_id);
    } catch (error) {
      console.error('Error getting users with permission set:', error);
      return [];
    }
  }

  // =============================================
  // Data Mapping Helpers
  // =============================================

  private mapUserRole(data: any): UserRole {
    return {
      id: data.id,
      userId: data.user_id,
      roleId: data.role_id,
      role: data.role,
      grantedBy: data.granted_by,
      reason: data.reason,
      assignedAt: new Date(data.assigned_at),
      validFrom: new Date(data.valid_from),
      validUntil: data.valid_until ? new Date(data.valid_until) : undefined,
      state: data.state as RoleState,
      scopes: data.scopes || [],
      recurringSchedule: data.recurring_schedule ? {
        id: data.recurring_schedule.id,
        userRoleId: data.recurring_schedule.user_role_id,
        daysOfWeek: data.recurring_schedule.days_of_week,
        timeStart: data.recurring_schedule.time_start,
        timeEnd: data.recurring_schedule.time_end,
        timezone: data.recurring_schedule.timezone
      } : undefined
    };
  }

  private mapDelegation(data: any): Delegation {
    return {
      id: data.id,
      fromUserId: data.from_user_id,
      toUserId: data.to_user_id,
      roleId: data.role_id,
      role: data.role,
      validFrom: new Date(data.valid_from),
      validUntil: new Date(data.valid_until),
      reason: data.reason,
      approvedBy: data.approved_by,
      approvedAt: data.approved_at ? new Date(data.approved_at) : undefined,
      state: data.state,
      scopes: data.scopes || [],
      permissions: data.permissions?.map((p: any) => p.permission) || undefined
    };
  }

  private mapEmergencyOverride(data: any): EmergencyOverride {
    return {
      id: data.id,
      triggeredBy: data.triggered_by,
      affectedUser: data.affected_user,
      reason: data.reason,
      durationMinutes: data.duration_minutes,
      grantedPermissions: data.granted_permissions,
      notifiedUsers: data.notified_users,
      activatedAt: new Date(data.activated_at),
      expiresAt: new Date(data.expires_at),
      deactivatedAt: data.deactivated_at ? new Date(data.deactivated_at) : undefined,
      deactivatedBy: data.deactivated_by,
      justification: data.justification
    };
  }

  // =============================================
  // Cache Management Methods
  // =============================================

  /**
   * Get cache health and performance metrics
   */
  async getCacheHealth(): Promise<any> {
    return await this.cache.healthCheck();
  }

  /**
   * Get cache hit rate statistics
   */
  getCacheHitRate(): { l1: number; l2: number; overall: number } {
    return this.cache.getHitRate();
  }

  /**
   * Warmup cache for frequently accessed users
   */
  async warmupCacheForUsers(userIds: string[]): Promise<void> {
    console.log(`Warming up cache for ${userIds.length} users`);
    
    const commonActions = ['read', 'write', 'schedule.read', 'document.read'];
    const warmupPromises: Promise<any>[] = [];

    for (const userId of userIds) {
      for (const action of commonActions) {
        // Create a dummy resource ID for warmup
        const resourceId = 'warmup-resource';
        warmupPromises.push(
          this.authorize(userId, action, resourceId, 'general').catch(err => {
            console.warn(`Cache warmup failed for user ${userId}, action ${action}:`, err);
          })
        );
      }

      // Batch warmup requests to avoid overwhelming the system
      if (warmupPromises.length >= 50) {
        await Promise.all(warmupPromises);
        warmupPromises.length = 0;
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Process remaining warmup requests
    if (warmupPromises.length > 0) {
      await Promise.all(warmupPromises);
    }
  }

  /**
   * Clear all cached permissions (use with caution)
   */
  async clearAllCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Get cache metrics for monitoring
   */
  getCacheMetrics(): any {
    return this.cache.getMetrics();
  }

  // =============================================
  // RBAC-Specific Authorization Methods
  // =============================================

  /**
   * Authorize role assignment with rate limiting
   */
  async authorizeRoleAssignment(
    adminUserId: string,
    targetUserId: string,
    roleType: string
  ): Promise<AuthorizationResult> {
    try {
      const rateLimiter = getRateLimiter();
      
      // Check role assignment rate limit
      const roleLimitResult = await rateLimiter.checkRoleAssignmentLimit(adminUserId);
      if (!roleLimitResult.allowed) {
        return {
          allowed: false,
          reason: 'ROLE_ASSIGNMENT_RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: roleLimitResult.retryAfter,
            limit: roleLimitResult.limit,
            remaining: roleLimitResult.remaining
          }
        };
      }

      // Check global rate limit
      const globalLimitResult = await rateLimiter.checkGlobalLimit(adminUserId);
      if (!globalLimitResult.allowed) {
        return {
          allowed: false,
          reason: 'GLOBAL_RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: globalLimitResult.retryAfter,
            limit: globalLimitResult.limit,
            remaining: globalLimitResult.remaining
          }
        };
      }

      // Check if admin has permission to assign this role
      return this.authorize(adminUserId, 'role.assign', targetUserId, 'user');

    } catch (error) {
      console.error('Error in role assignment authorization:', error);
      return {
        allowed: false,
        reason: 'AUTHORIZATION_ERROR',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Authorize delegation with rate limiting
   */
  async authorizeDelegation(
    fromUserId: string,
    toUserId: string,
    roleId: string
  ): Promise<AuthorizationResult> {
    try {
      const rateLimiter = getRateLimiter();
      
      // Check delegation rate limit
      const delegationLimitResult = await rateLimiter.checkDelegationLimit(fromUserId);
      if (!delegationLimitResult.allowed) {
        return {
          allowed: false,
          reason: 'DELEGATION_RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: delegationLimitResult.retryAfter,
            limit: delegationLimitResult.limit,
            remaining: delegationLimitResult.remaining
          }
        };
      }

      // Check if user can delegate their role
      return this.authorize(fromUserId, 'role.delegate', roleId, 'role');

    } catch (error) {
      console.error('Error in delegation authorization:', error);
      return {
        allowed: false,
        reason: 'AUTHORIZATION_ERROR',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Authorize emergency override with strict rate limiting
   */
  async authorizeEmergencyOverride(
    triggeredByUserId: string,
    affectedUserId: string,
    reason: string
  ): Promise<AuthorizationResult> {
    try {
      const rateLimiter = getRateLimiter();
      
      // Check emergency override rate limit (very strict)
      const emergencyLimitResult = await rateLimiter.checkEmergencyOverrideLimit(triggeredByUserId);
      if (!emergencyLimitResult.allowed) {
        return {
          allowed: false,
          reason: 'EMERGENCY_OVERRIDE_RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: emergencyLimitResult.retryAfter,
            limit: emergencyLimitResult.limit,
            remaining: emergencyLimitResult.remaining,
            message: 'Emergency override limit exceeded. Contact system administrator.'
          }
        };
      }

      // Check if user has permission to trigger emergency overrides
      return this.authorize(triggeredByUserId, 'emergency.override', affectedUserId, 'user');

    } catch (error) {
      console.error('Error in emergency override authorization:', error);
      return {
        allowed: false,
        reason: 'AUTHORIZATION_ERROR',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Authorize admin operations with enhanced rate limiting
   */
  async authorizeAdminOperation(
    adminUserId: string,
    operation: string,
    targetResourceId: string,
    resourceType: string
  ): Promise<AuthorizationResult> {
    try {
      const rateLimiter = getRateLimiter();
      
      // Check admin-specific rate limit
      const adminLimitResult = await rateLimiter.checkAdminLimit(adminUserId, operation);
      if (!adminLimitResult.allowed) {
        return {
          allowed: false,
          reason: 'ADMIN_RATE_LIMIT_EXCEEDED',
          details: {
            retryAfter: adminLimitResult.retryAfter,
            limit: adminLimitResult.limit,
            remaining: adminLimitResult.remaining
          }
        };
      }

      // Check regular authorization
      return this.authorize(adminUserId, operation, targetResourceId, resourceType);

    } catch (error) {
      console.error('Error in admin operation authorization:', error);
      return {
        allowed: false,
        reason: 'AUTHORIZATION_ERROR',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Get comprehensive rate limit status for a user
   */
  async getUserRateLimitStatus(userId: string): Promise<{
    global: any;
    permissionCheck: any;
    roleAssignment?: any;
    delegation?: any;
    emergencyOverride?: any;
    admin?: any;
  }> {
    try {
      const rateLimiter = getRateLimiter();
      
      const [
        global,
        permissionCheck,
        roleAssignment,
        delegation,
        emergencyOverride,
        admin
      ] = await Promise.all([
        rateLimiter.getRateLimitStatus(userId, 'global', 'rbac:global'),
        rateLimiter.getRateLimitStatus(userId, 'permission_check', 'rbac:permission_check'),
        rateLimiter.getRateLimitStatus(userId, 'role_assignment', 'rbac:role_assignment'),
        rateLimiter.getRateLimitStatus(userId, 'delegation', 'rbac:delegation'),
        rateLimiter.getRateLimitStatus(userId, 'emergency_override', 'rbac:emergency_override'),
        rateLimiter.getRateLimitStatus(userId, 'admin', 'rbac:admin')
      ]);

      return {
        global,
        permissionCheck,
        roleAssignment,
        delegation,
        emergencyOverride,
        admin
      };

    } catch (error) {
      console.error('Error getting rate limit status:', error);
      return {
        global: { limit: 0, remaining: 0, resetTime: 0, backoffActive: false, backoffLevel: 0, violationCount: 0 },
        permissionCheck: { limit: 0, remaining: 0, resetTime: 0, backoffActive: false, backoffLevel: 0, violationCount: 0 }
      };
    }
  }

  /**
   * Reset rate limits for a user (admin function)
   */
  async resetUserRateLimits(
    adminUserId: string,
    targetUserId: string
  ): Promise<AuthorizationResult> {
    try {
      // Check if admin has permission to reset rate limits
      const authResult = await this.authorize(adminUserId, 'admin.reset_rate_limits', targetUserId, 'user');
      if (!authResult.allowed) {
        return authResult;
      }

      const rateLimiter = getRateLimiter();
      await rateLimiter.resetUserLimits(targetUserId);

      return {
        allowed: true,
        reason: 'RATE_LIMITS_RESET',
        details: { targetUserId, resetBy: adminUserId }
      };

    } catch (error) {
      console.error('Error resetting user rate limits:', error);
      return {
        allowed: false,
        reason: 'RATE_LIMIT_RESET_ERROR',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

// =============================================
// Singleton Instance
// =============================================

let authorizationServiceInstance: AuthorizationService | null = null;

export function getAuthorizationService(): AuthorizationService {
  if (!authorizationServiceInstance) {
    authorizationServiceInstance = new AuthorizationService();
  }
  return authorizationServiceInstance;
}


// =============================================
// Convenience Functions
// =============================================

/**
 * Quick authorization check
 */
export async function authorize(
  userId: string,
  action: string,
  resourceId: string,
  resourceType: string
): Promise<AuthorizationResult> {
  const service = getAuthorizationService();
  return service.authorize(userId, action, resourceId, resourceType);
}

/**
 * Check if user has permission (returns boolean)
 */
export async function hasPermission(
  userId: string,
  action: string,
  resourceId: string,
  resourceType: string
): Promise<boolean> {
  const result = await authorize(userId, action, resourceId, resourceType);
  return result.allowed;
}

/**
 * Require permission or throw error
 */
export async function requirePermission(
  userId: string,
  action: string,
  resourceId: string,
  resourceType: string
): Promise<void> {
  const result = await authorize(userId, action, resourceId, resourceType);
  if (!result.allowed) {
    // Check if it's a rate limit error to provide appropriate error type
    if (result.reason === 'RATE_LIMIT_EXCEEDED') {
      throw new RateLimitError(
        'Rate limit exceeded. Please try again later.',
        result.details?.retryAfter || 60,
        result.details?.limit || 0,
        result.details?.remaining || 0
      );
    }
    
    throw new AuthError(
      `Access denied: ${result.reason}`,
      'ACCESS_DENIED',
      403,
      { authorizationResult: result }
    );
  }
}

// =============================================
// RBAC-Specific Convenience Functions
// =============================================

/**
 * Authorize role assignment with comprehensive rate limiting
 */
export async function authorizeRoleAssignment(
  adminUserId: string,
  targetUserId: string,
  roleType: string
): Promise<AuthorizationResult> {
  const service = getAuthorizationService();
  return service.authorizeRoleAssignment(adminUserId, targetUserId, roleType);
}

/**
 * Authorize delegation with rate limiting
 */
export async function authorizeDelegation(
  fromUserId: string,
  toUserId: string,
  roleId: string
): Promise<AuthorizationResult> {
  const service = getAuthorizationService();
  return service.authorizeDelegation(fromUserId, toUserId, roleId);
}

/**
 * Strictly rate-limited emergency override authorization
 */
export async function authorizeEmergencyOverride(
  triggeredByUserId: string,
  affectedUserId: string,
  reason: string
): Promise<AuthorizationResult> {
  const service = getAuthorizationService();
  return service.authorizeEmergencyOverride(triggeredByUserId, affectedUserId, reason);
}

/**
 * Admin operation with enhanced rate limiting
 */
export async function authorizeAdminOperation(
  adminUserId: string,
  operation: string,
  targetResourceId: string,
  resourceType: string
): Promise<AuthorizationResult> {
  const service = getAuthorizationService();
  return service.authorizeAdminOperation(adminUserId, operation, targetResourceId, resourceType);
}

/**
 * Get comprehensive rate limit status for monitoring
 */
export async function getRateLimitStatus(userId: string): Promise<any> {
  const service = getAuthorizationService();
  return service.getUserRateLimitStatus(userId);
}

/**
 * Admin function to reset user rate limits
 */
export async function resetUserRateLimits(
  adminUserId: string,
  targetUserId: string
): Promise<AuthorizationResult> {
  const service = getAuthorizationService();
  return service.resetUserRateLimits(adminUserId, targetUserId);
}

/**
 * Enhanced permission check with specific rate limiting
 */
export async function checkPermissionWithRateLimit(
  userId: string,
  action: string,
  resourceId: string,
  resourceType: string
): Promise<{ allowed: boolean; result: AuthorizationResult; rateLimitStatus?: any }> {
  const rateLimiter = getRateLimiter();
  const rateLimitResult = await rateLimiter.checkPermissionLimit(userId, resourceType);
  
  if (!rateLimitResult.allowed) {
    return {
      allowed: false,
      result: {
        allowed: false,
        reason: 'RATE_LIMIT_EXCEEDED',
        details: {
          retryAfter: rateLimitResult.retryAfter,
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining
        }
      },
      rateLimitStatus: rateLimitResult
    };
  }
  
  const authResult = await authorize(userId, action, resourceId, resourceType);
  return {
    allowed: authResult.allowed,
    result: authResult,
    rateLimitStatus: rateLimitResult
  };
}

/**
 * Require permission with enhanced rate limiting information
 */
export async function requirePermissionWithRateLimit(
  userId: string,
  action: string,
  resourceId: string,
  resourceType: string
): Promise<void> {
  const { allowed, result, rateLimitStatus } = await checkPermissionWithRateLimit(
    userId, action, resourceId, resourceType
  );
  
  if (!allowed) {
    if (result.reason === 'RATE_LIMIT_EXCEEDED') {
      throw new RateLimitError(
        'Rate limit exceeded. Please try again later.',
        rateLimitStatus?.retryAfter || 60,
        rateLimitStatus?.limit || 0,
        rateLimitStatus?.remaining || 0
      );
    }
    
    throw new AuthError(
      `Access denied: ${result.reason}`,
      'ACCESS_DENIED',
      403,
      { authorizationResult: result, rateLimitStatus }
    );
  }
}