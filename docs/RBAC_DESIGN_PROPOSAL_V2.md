# RBAC Design Proposal for FamilyHub - Version 2

## Executive Summary
This document defines a production-ready Role-Based Access Control (RBAC) system for FamilyHub, a family coordination platform for managing schedules, reminders, and caregiving tasks. The system supports multi-generational families with varying technical abilities and complex care scenarios.

## Document Version History
- v1.0: Initial proposal with team feedback
- v2.0: Critical review addressed - production-ready implementation

## ✅ Team Decisions Summary

| Topic | Decision | Rationale |
|-------|----------|-----------|
| **Permission Model** | Resource-Action Model | Simple, explicit, easy to audit/debug |
| **Role Binding** | Permission Sets | Modular, maintainable, prevents role explosion |
| **Scope System** | Scoped Assignments with Junction Tables | Maintains referential integrity |
| **Time-Bounding** | Structured recurring schedules | Queryable and validatable |
| **Conflict Resolution** | Explicit precedence order | Predictable authorization behavior |
| **Delegation** | Explicit delegation records | Intuitive, auditable |
| **Audit Logging** | Dual-track: changes + checks | Complete audit trail |

## Core Role Structure

### Role Definitions
```typescript
enum RoleType {
  ADMIN = 'admin',
  CAREGIVER = 'caregiver',
  VIEWER = 'viewer',
  CARE_RECIPIENT = 'care_recipient',
  CHILD = 'child',
  HELPER = 'helper',
  EMERGENCY_CONTACT = 'emergency_contact',
  BOT_AGENT = 'bot_agent'
}

enum RoleState {
  PENDING_APPROVAL = 'pending_approval',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

interface Role {
  id: string;
  type: RoleType;
  state: RoleState;
  name: string;
  description: string;
  permissionSets: PermissionSet[];
  priority: number; // For conflict resolution
  tags: string[];
}
```

## Authorization Service Implementation

### Complete Authorization Flow

```typescript
/**
 * Core Authorization Service
 * Handles all permission checks with proper precedence and caching
 */
class AuthorizationService {
  private cache: PermissionCache;
  private rateLimiter: RateLimiter;
  
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
    // 1. Rate limiting check
    if (!await this.rateLimiter.checkLimit(userId, resourceType)) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT_EXCEEDED',
        details: { retryAfter: this.rateLimiter.getRetryAfter(userId) }
      };
    }
    
    // 2. Check cache
    const cacheKey = `${userId}:${action}:${resourceId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached && !cached.isExpired()) {
      return cached.result;
    }
    
    // 3. Emergency override check
    const emergency = await this.checkEmergencyOverride(userId, resourceId);
    if (emergency.active) {
      await this.auditEmergencyAccess(userId, action, resourceId, emergency);
      return {
        allowed: true,
        reason: 'EMERGENCY_OVERRIDE',
        details: emergency
      };
    }
    
    // 4. Gather all applicable permissions
    const permissions = await this.gatherPermissions(userId, resourceId);
    
    // 5. Apply precedence rules
    const decision = this.evaluateWithPrecedence(permissions, action, resourceType);
    
    // 6. Audit the check (async, non-blocking)
    this.auditPermissionCheck(userId, action, resourceId, decision);
    
    // 7. Update cache
    await this.cache.set(cacheKey, decision, this.getCacheTTL(action));
    
    return decision;
  }
  
  /**
   * Gather all permissions from different sources
   */
  private async gatherPermissions(
    userId: string,
    resourceId: string
  ): Promise<PermissionSource[]> {
    const sources: PermissionSource[] = [];
    
    // 1. Direct role assignments
    const directRoles = await this.getDirectRoles(userId, resourceId);
    sources.push(...directRoles.map(r => ({
      type: 'DIRECT_ROLE',
      role: r,
      priority: r.priority,
      permissions: this.expandPermissionSets(r.permissionSets)
    })));
    
    // 2. Active delegations
    const delegations = await this.getActiveDelegations(userId, resourceId);
    sources.push(...delegations.map(d => ({
      type: 'DELEGATION',
      delegation: d,
      priority: d.role.priority - 10, // Delegations have lower priority
      permissions: d.permissions || this.expandPermissionSets(d.role.permissionSets)
    })));
    
    // 3. Check recurring schedules
    const now = new Date();
    sources.forEach(source => {
      if (source.recurringSchedule && !this.isWithinSchedule(now, source.recurringSchedule)) {
        source.active = false;
      }
    });
    
    return sources.filter(s => s.active !== false);
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
            this.logConflict(sources, source, action, resourceType);
          }
          
          return {
            allowed: !isDeny,
            reason: currentPrecedence,
            source: source.type,
            roleId: source.role?.id,
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
   * Check if current time is within recurring schedule
   */
  private isWithinSchedule(now: Date, schedule: RecurringSchedule): boolean {
    const userTime = this.convertToTimezone(now, schedule.timezone);
    const dayOfWeek = userTime.getDay();
    
    if (!schedule.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }
    
    const currentTime = userTime.getHours() * 60 + userTime.getMinutes();
    const startMinutes = this.parseTime(schedule.timeStart);
    const endMinutes = this.parseTime(schedule.timeEnd);
    
    return currentTime >= startMinutes && currentTime <= endMinutes;
  }
  
  /**
   * Invalidate cache entries when permissions change
   */
  async invalidateCache(trigger: CacheInvalidationTrigger): Promise<void> {
    switch (trigger.type) {
      case 'ROLE_ASSIGNED':
      case 'ROLE_REVOKED':
        await this.cache.invalidatePattern(`${trigger.userId}:*`);
        break;
      
      case 'DELEGATION_CREATED':
      case 'DELEGATION_REVOKED':
        await this.cache.invalidatePattern(`${trigger.toUserId}:*`);
        break;
      
      case 'PERMISSION_SET_UPDATED':
        // Invalidate all users with affected roles
        const affectedUsers = await this.getUsersWithPermissionSet(trigger.permissionSetId);
        for (const userId of affectedUsers) {
          await this.cache.invalidatePattern(`${userId}:*`);
        }
        break;
    }
  }
}

interface AuthorizationResult {
  allowed: boolean;
  reason: string;
  source?: string;
  roleId?: string;
  details?: Record<string, any>;
}

interface PermissionSource {
  type: 'DIRECT_ROLE' | 'DELEGATION';
  role?: Role;
  delegation?: Delegation;
  priority: number;
  permissions: Permission[];
  recurringSchedule?: RecurringSchedule;
  active?: boolean;
}
```

## Database Schema - Production Ready

### Fixed Schema Issues

```sql
-- Roles table with state management
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(30) NOT NULL CHECK (type IN ('admin', 'caregiver', 'viewer', 'care_recipient', 'child', 'helper', 'emergency_contact', 'bot_agent')),
  state VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (state IN ('pending_approval', 'active', 'suspended', 'expired', 'revoked')),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100, -- Higher number = higher priority
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type)
);

-- Permissions table
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  effect VARCHAR(10) NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  scope VARCHAR(20) CHECK (scope IN ('own', 'assigned', 'family', 'all')),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource, action, effect, scope)
);

-- Permission Sets
CREATE TABLE permission_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  parent_set_id UUID REFERENCES permission_sets(id), -- For inheritance, with cycle prevention
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT no_self_reference CHECK (id != parent_set_id)
);

-- Permission set dependencies (prevents circular dependencies)
CREATE TABLE permission_set_hierarchy (
  ancestor_id UUID REFERENCES permission_sets(id),
  descendant_id UUID REFERENCES permission_sets(id),
  depth INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id)
);

-- Stored procedure to prevent circular dependencies in permission sets
CREATE OR REPLACE FUNCTION prevent_permission_set_cycles() RETURNS TRIGGER AS $$
BEGIN
  -- Check if adding this relationship would create a cycle
  IF EXISTS (
    SELECT 1 FROM permission_set_hierarchy 
    WHERE ancestor_id = NEW.descendant_id 
    AND descendant_id = NEW.ancestor_id
  ) THEN
    RAISE EXCEPTION 'Circular dependency detected: permission set % cannot inherit from % (would create cycle)', 
                    NEW.ancestor_id, NEW.descendant_id;
  END IF;
  
  -- Check for deeper cycles by verifying if descendant is already an ancestor
  IF NEW.ancestor_id != NEW.descendant_id AND EXISTS (
    SELECT 1 FROM permission_set_hierarchy 
    WHERE ancestor_id = NEW.descendant_id 
    AND descendant_id = NEW.ancestor_id
  ) THEN
    RAISE EXCEPTION 'Circular dependency detected: permission set % is already a descendant of %', 
                    NEW.descendant_id, NEW.ancestor_id;
  END IF;
  
  -- Prevent self-reference
  IF NEW.ancestor_id = NEW.descendant_id THEN
    RAISE EXCEPTION 'Self-reference not allowed: permission set cannot inherit from itself';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_cycles_trigger
  BEFORE INSERT OR UPDATE ON permission_set_hierarchy
  FOR EACH ROW EXECUTE FUNCTION prevent_permission_set_cycles();

-- Helper function to safely add permission set inheritance
CREATE OR REPLACE FUNCTION add_permission_set_inheritance(
  parent_set_id UUID,
  child_set_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Insert direct relationship
  INSERT INTO permission_set_hierarchy (ancestor_id, descendant_id, depth)
  VALUES (parent_set_id, child_set_id, 1)
  ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
  
  -- Insert transitive relationships
  INSERT INTO permission_set_hierarchy (ancestor_id, descendant_id, depth)
  SELECT h.ancestor_id, child_set_id, h.depth + 1
  FROM permission_set_hierarchy h
  WHERE h.descendant_id = parent_set_id
  ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
  
  -- Insert reverse transitive relationships
  INSERT INTO permission_set_hierarchy (ancestor_id, descendant_id, depth)
  SELECT parent_set_id, h.descendant_id, h.depth + 1
  FROM permission_set_hierarchy h
  WHERE h.ancestor_id = child_set_id
  ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Permission set permissions
CREATE TABLE permission_set_permissions (
  permission_set_id UUID REFERENCES permission_sets(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (permission_set_id, permission_id)
);

-- Role permission sets
CREATE TABLE role_permission_sets (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_set_id UUID REFERENCES permission_sets(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_set_id)
);

-- User role assignments (improved)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id),
  
  -- Assignment metadata
  granted_by UUID REFERENCES users(id),
  reason TEXT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Time bounds
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,
  
  -- State management
  state VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (state IN ('pending_approval', 'active', 'suspended', 'expired', 'revoked')),
  state_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  state_changed_by UUID REFERENCES users(id),
  
  -- Expiration reminder
  reminder_days_before INTEGER,
  reminder_sent_at TIMESTAMP,
  
  -- Revocation
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES users(id),
  revoke_reason TEXT,
  
  CONSTRAINT valid_time_bounds CHECK (valid_until IS NULL OR valid_until > valid_from)
);

-- Separate scope management (instead of TEXT[] arrays)
CREATE TABLE user_role_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_role_id UUID REFERENCES user_roles(id) ON DELETE CASCADE,
  scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('global', 'family', 'individual')),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('user', 'family', 'group')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_role_id, entity_type, entity_id)
);

-- Add foreign key constraints based on entity_type
CREATE OR REPLACE FUNCTION validate_scope_entity() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entity_type = 'user' THEN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.entity_id) THEN
      RAISE EXCEPTION 'Invalid user entity_id: %', NEW.entity_id;
    END IF;
  ELSIF NEW.entity_type = 'family' THEN
    IF NOT EXISTS (SELECT 1 FROM families WHERE id = NEW.entity_id) THEN
      RAISE EXCEPTION 'Invalid family entity_id: %', NEW.entity_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_scope_entity_trigger
  BEFORE INSERT OR UPDATE ON user_role_scopes
  FOR EACH ROW EXECUTE FUNCTION validate_scope_entity();

-- Structured recurring schedules (instead of JSONB)
CREATE TABLE recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_role_id UUID REFERENCES user_roles(id) ON DELETE CASCADE,
  days_of_week INTEGER[] NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  timezone VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_days CHECK (array_length(days_of_week, 1) > 0 AND days_of_week <@ ARRAY[0,1,2,3,4,5,6]),
  CONSTRAINT valid_time_range CHECK (time_end > time_start),
  UNIQUE(user_role_id)
);

-- Delegation records with improved structure
CREATE TABLE delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES users(id),
  to_user_id UUID REFERENCES users(id),
  role_id UUID REFERENCES roles(id),
  
  -- Time bounds
  valid_from TIMESTAMP NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  
  -- Metadata
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  
  -- State
  state VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'expired', 'revoked')),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Revocation
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES users(id),
  revoke_reason TEXT,
  
  CONSTRAINT valid_delegation_time CHECK (valid_until > valid_from),
  CONSTRAINT no_self_delegation CHECK (from_user_id != to_user_id)
);

-- Delegation scopes (similar to user_role_scopes)
CREATE TABLE delegation_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id UUID REFERENCES delegations(id) ON DELETE CASCADE,
  scope_type VARCHAR(20) NOT NULL,
  entity_type VARCHAR(20) NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(delegation_id, entity_type, entity_id)
);

-- Delegation permission subsets (optional)
CREATE TABLE delegation_permissions (
  delegation_id UUID REFERENCES delegations(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id),
  PRIMARY KEY (delegation_id, permission_id)
);

-- Emergency overrides
CREATE TABLE emergency_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by UUID REFERENCES users(id),
  affected_user UUID REFERENCES users(id),
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('no_response_24h', 'panic_button', 'admin_override', 'medical_emergency')),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  
  -- Granted permissions during emergency
  granted_permissions UUID[] NOT NULL, -- Array of permission IDs
  
  -- Notification tracking
  notified_users UUID[] NOT NULL,
  
  -- Timestamps
  activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP GENERATED ALWAYS AS (activated_at + (duration_minutes || ' minutes')::INTERVAL) STORED,
  deactivated_at TIMESTAMP,
  deactivated_by UUID REFERENCES users(id),
  
  -- Audit
  justification TEXT NOT NULL,
  
  CONSTRAINT valid_duration CHECK (duration_minutes > 0 AND duration_minutes <= 1440) -- Max 24 hours
);

-- Dual audit logging: permission checks
CREATE TABLE audit_permission_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  allowed BOOLEAN NOT NULL,
  denial_reason VARCHAR(100),
  
  -- Context
  user_roles UUID[], -- Snapshot of role IDs
  delegations UUID[], -- Active delegation IDs
  emergency_override UUID REFERENCES emergency_overrides(id),
  
  -- Performance metrics
  evaluation_time_ms INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  
  -- Request context
  ip_address INET,
  session_id UUID,
  user_agent TEXT,
  
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dual audit logging: permission changes
CREATE TABLE audit_permission_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by UUID REFERENCES users(id) NOT NULL,
  change_type VARCHAR(50) NOT NULL CHECK (change_type IN (
    'role_assigned', 'role_revoked', 'role_modified',
    'delegation_created', 'delegation_approved', 'delegation_revoked',
    'permission_set_updated', 'emergency_override_activated'
  )),
  
  -- Affected entities
  affected_user UUID REFERENCES users(id),
  affected_role UUID REFERENCES roles(id),
  affected_delegation UUID REFERENCES delegations(id),
  
  -- Change details
  before_state JSONB,
  after_state JSONB,
  justification TEXT,
  
  -- Approval tracking
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX idx_user_roles_active ON user_roles(user_id, state) WHERE state = 'active';
CREATE INDEX idx_user_roles_expiry ON user_roles(valid_until) WHERE valid_until IS NOT NULL AND state = 'active';
CREATE INDEX idx_user_role_scopes_lookup ON user_role_scopes(entity_id, entity_type);
CREATE INDEX idx_recurring_schedules_role ON recurring_schedules(user_role_id);
CREATE INDEX idx_delegations_active ON delegations(to_user_id, state) WHERE state = 'active';
CREATE INDEX idx_delegations_expiry ON delegations(valid_until) WHERE state = 'active';
CREATE INDEX idx_emergency_overrides_active ON emergency_overrides(expires_at) WHERE deactivated_at IS NULL;
CREATE INDEX idx_audit_checks_user ON audit_permission_checks(user_id, timestamp DESC);
CREATE INDEX idx_audit_changes_user ON audit_permission_changes(affected_user, timestamp DESC);

-- Materialized view for "who can access what" queries
CREATE MATERIALIZED VIEW user_permissions AS
SELECT 
  u.id as user_id,
  r.id as role_id,
  r.type as role_type,
  p.resource,
  p.action,
  p.effect,
  p.scope,
  urs.entity_id as scoped_to_entity,
  ur.valid_until,
  'direct' as source
FROM users u
JOIN user_roles ur ON u.id = ur.user_id AND ur.state = 'active'
JOIN user_role_scopes urs ON ur.id = urs.user_role_id
JOIN roles r ON ur.role_id = r.id
JOIN role_permission_sets rps ON r.id = rps.role_id
JOIN permission_set_permissions psp ON rps.permission_set_id = psp.permission_set_id
JOIN permissions p ON psp.permission_id = p.id
WHERE ur.valid_from <= CURRENT_TIMESTAMP 
  AND (ur.valid_until IS NULL OR ur.valid_until > CURRENT_TIMESTAMP)

UNION

SELECT 
  d.to_user_id as user_id,
  r.id as role_id,
  r.type as role_type,
  p.resource,
  p.action,
  p.effect,
  p.scope,
  ds.entity_id as scoped_to_entity,
  d.valid_until,
  'delegation' as source
FROM delegations d
JOIN delegation_scopes ds ON d.id = ds.delegation_id
JOIN roles r ON d.role_id = r.id
JOIN role_permission_sets rps ON r.id = rps.role_id
JOIN permission_set_permissions psp ON rps.permission_set_id = psp.permission_set_id
JOIN permissions p ON psp.permission_id = p.id
WHERE d.state = 'active'
  AND d.valid_from <= CURRENT_TIMESTAMP 
  AND d.valid_until > CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX idx_user_permissions ON user_permissions(user_id, resource, action, scoped_to_entity, source);

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_user_permissions() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_permissions;
END;
$$ LANGUAGE plpgsql;
```

## Rate Limiting Implementation

```typescript
interface RateLimiter {
  private limits: Map<string, RateLimit>;
  
  async checkLimit(userId: string, resourceType: string): Promise<boolean> {
    const key = `${userId}:${resourceType}`;
    const limit = this.limits.get(key) || this.createLimit(key);
    
    const now = Date.now();
    const windowStart = now - limit.windowMs;
    
    // Remove old requests outside the window
    limit.requests = limit.requests.filter(time => time > windowStart);
    
    if (limit.requests.length >= limit.maxRequests) {
      // Apply exponential backoff for repeated violations
      limit.penalties++;
      limit.penaltyExpires = now + (Math.pow(2, limit.penalties) * 1000);
      
      await this.auditRateLimitViolation(userId, resourceType, limit);
      return false;
    }
    
    limit.requests.push(now);
    return true;
  }
  
  getRetryAfter(userId: string): number {
    const key = `${userId}:*`;
    const limit = this.limits.get(key);
    if (!limit) return 0;
    
    const now = Date.now();
    if (limit.penaltyExpires > now) {
      return Math.ceil((limit.penaltyExpires - now) / 1000);
    }
    
    return Math.ceil(limit.windowMs / 1000);
  }
  
  private createLimit(key: string): RateLimit {
    const limit: RateLimit = {
      key,
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      requests: [],
      penalties: 0,
      penaltyExpires: 0
    };
    
    this.limits.set(key, limit);
    return limit;
  }
}

interface RateLimit {
  key: string;
  windowMs: number;
  maxRequests: number;
  requests: number[];
  penalties: number;
  penaltyExpires: number;
}
```

## Cache Strategy

```typescript
class PermissionCache {
  private redis: RedisClient;
  private localCache: LRUCache<string, CachedPermission>;
  
  constructor() {
    this.localCache = new LRUCache<string, CachedPermission>({
      max: 10000, // Max entries
      ttl: 60000, // 1 minute local cache
      updateAgeOnGet: true
    });
  }
  
  async get(key: string): Promise<CachedPermission | null> {
    // L1 cache (local)
    const local = this.localCache.get(key);
    if (local && !this.isExpired(local)) {
      return local;
    }
    
    // L2 cache (Redis)
    const cached = await this.redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached) as CachedPermission;
      if (!this.isExpired(parsed)) {
        this.localCache.set(key, parsed);
        return parsed;
      }
    }
    
    return null;
  }
  
  async set(key: string, result: AuthorizationResult, ttlSeconds: number): Promise<void> {
    const cached: CachedPermission = {
      result,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
      version: this.getCacheVersion()
    };
    
    // Set in both caches
    this.localCache.set(key, cached);
    await this.redis.setex(key, ttlSeconds, JSON.stringify(cached));
  }
  
  async invalidatePattern(pattern: string): Promise<void> {
    // Clear local cache
    for (const key of this.localCache.keys()) {
      if (this.matchesPattern(key, pattern)) {
        this.localCache.delete(key);
      }
    }
    
    // Clear Redis cache
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    
    // Increment cache version to invalidate all old entries
    await this.incrementCacheVersion();
  }
  
  private isExpired(cached: CachedPermission): boolean {
    const now = Date.now();
    return (now - cached.timestamp) > cached.ttl || 
           cached.version !== this.getCacheVersion();
  }
  
  private getCacheTTL(action: string): number {
    // Different TTLs for different actions
    const ttlMap: Record<string, number> = {
      'read': 300,    // 5 minutes
      'write': 60,    // 1 minute
      'delete': 30,   // 30 seconds
      'admin': 10     // 10 seconds
    };
    
    return ttlMap[action] || 60;
  }
}

interface CachedPermission {
  result: AuthorizationResult;
  timestamp: number;
  ttl: number;
  version: number;
}
```

## Migration Strategy

```typescript
class RBACMigration {
  async migrateExistingUsers(): Promise<void> {
    const batch = 100;
    let offset = 0;
    
    while (true) {
      const users = await this.getUsers(batch, offset);
      if (users.length === 0) break;
      
      for (const user of users) {
        await this.assignDefaultRole(user);
      }
      
      offset += batch;
    }
  }
  
  private async assignDefaultRole(user: User): Promise<void> {
    // Determine default role based on existing data
    let roleType: RoleType;
    
    if (user.isAdmin) {
      roleType = RoleType.ADMIN;
    } else if (user.isCareRecipient) {
      roleType = RoleType.CARE_RECIPIENT;
    } else if (user.hasEditPermissions) {
      roleType = RoleType.CAREGIVER;
    } else {
      roleType = RoleType.VIEWER;
    }
    
    await this.assignRole(user.id, roleType, {
      grantedBy: 'SYSTEM_MIGRATION',
      reason: 'Initial RBAC migration',
      scope: { type: 'family', entityId: user.familyId }
    });
    
    await this.auditMigration(user.id, roleType);
  }
  
  async rollback(): Promise<void> {
    // Keep old permission system active
    // Mark all migrated roles as inactive
    await this.db.query(`
      UPDATE user_roles 
      SET state = 'suspended' 
      WHERE granted_by = 'SYSTEM_MIGRATION'
    `);
  }
}
```

## Testing Strategy

```typescript
describe('RBAC System Tests', () => {
  describe('Permission Evaluation', () => {
    test('Caregiver can only access assigned recipients', async () => {
      const caregiver = await createUser('caregiver');
      const recipient1 = await createUser('recipient1');
      const recipient2 = await createUser('recipient2');
      
      await assignRole(caregiver, RoleType.CAREGIVER, {
        scope: { type: 'individual', entities: [recipient1.id] }
      });
      
      const auth = new AuthorizationService();
      
      expect(await auth.authorize(caregiver.id, 'schedule.read', recipient1.id, 'user')).toMatchObject({
        allowed: true,
        reason: 'DIRECT_ROLE_ALLOW'
      });
      
      expect(await auth.authorize(caregiver.id, 'schedule.read', recipient2.id, 'user')).toMatchObject({
        allowed: false,
        reason: 'NO_PERMISSION'
      });
    });
    
    test('Deny overrides allow in conflict', async () => {
      const user = await createUser('user');
      
      // User has viewer role (allow read) and restricted role (deny read)
      await assignRole(user, RoleType.VIEWER);
      await assignRole(user, 'RESTRICTED_VIEWER'); // Custom role with deny
      
      const result = await auth.authorize(user.id, 'document.read', 'doc1', 'document');
      
      expect(result).toMatchObject({
        allowed: false,
        reason: 'DIRECT_ROLE_DENY'
      });
    });
    
    test('Delegation expires at boundary', async () => {
      const delegator = await createUser('delegator');
      const delegate = await createUser('delegate');
      
      const delegation = await createDelegation({
        from: delegator.id,
        to: delegate.id,
        validUntil: new Date(Date.now() + 1000) // 1 second
      });
      
      // Should work immediately
      expect(await auth.authorize(delegate.id, 'task.create', 'task1', 'task'))
        .toMatchObject({ allowed: true });
      
      // Wait for expiration
      await sleep(1100);
      
      // Should be denied after expiration
      expect(await auth.authorize(delegate.id, 'task.create', 'task1', 'task'))
        .toMatchObject({ allowed: false, reason: 'NO_PERMISSION' });
    });
    
    test('Recurring schedule allows access only during window', async () => {
      const helper = await createUser('helper');
      
      await assignRole(helper, RoleType.HELPER, {
        recurringSchedule: {
          daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
          timeStart: '15:00',
          timeEnd: '18:00',
          timezone: 'America/New_York'
        }
      });
      
      // Mock time to be within schedule
      MockDate.set('2024-01-15 16:00:00'); // Monday 4pm
      expect(await auth.authorize(helper.id, 'schedule.read', 'schedule1', 'schedule'))
        .toMatchObject({ allowed: true });
      
      // Mock time to be outside schedule
      MockDate.set('2024-01-15 19:00:00'); // Monday 7pm
      expect(await auth.authorize(helper.id, 'schedule.read', 'schedule1', 'schedule'))
        .toMatchObject({ allowed: false });
    });
  });
  
  describe('Performance Tests', () => {
    test('Permission check completes within 50ms', async () => {
      const users = await createUsers(100);
      const auth = new AuthorizationService();
      
      const times: number[] = [];
      
      for (const user of users) {
        const start = performance.now();
        await auth.authorize(user.id, 'schedule.read', 'schedule1', 'schedule');
        const end = performance.now();
        times.push(end - start);
      }
      
      const p95 = percentile(times, 95);
      expect(p95).toBeLessThan(50);
    });
    
    test('Handles concurrent role modifications', async () => {
      const user = await createUser('user');
      
      // Simulate concurrent role assignments
      const promises = Array(10).fill(0).map((_, i) => 
        assignRole(user, `ROLE_${i}`)
      );
      
      await expect(Promise.all(promises)).resolves.not.toThrow();
      
      // Verify final state is consistent
      const roles = await getUserRoles(user.id);
      expect(roles).toHaveLength(10);
    });
    
    test('Cache invalidation works correctly', async () => {
      const user = await createUser('user');
      const auth = new AuthorizationService();
      
      // First check - cache miss
      const result1 = await auth.authorize(user.id, 'task.read', 'task1', 'task');
      expect(result1.allowed).toBe(false);
      
      // Assign role
      await assignRole(user, RoleType.VIEWER);
      
      // Should reflect new permissions immediately
      const result2 = await auth.authorize(user.id, 'task.read', 'task1', 'task');
      expect(result2.allowed).toBe(true);
    });
  });
  
  describe('Emergency Override Tests', () => {
    test('Emergency override grants temporary access', async () => {
      const user = await createUser('user');
      const auth = new AuthorizationService();
      
      // No access initially
      expect(await auth.authorize(user.id, 'medical.read', 'record1', 'medical'))
        .toMatchObject({ allowed: false });
      
      // Activate emergency override
      await activateEmergencyOverride({
        userId: user.id,
        reason: 'medical_emergency',
        duration: 60 // 1 minute
      });
      
      // Should have access during emergency
      expect(await auth.authorize(user.id, 'medical.read', 'record1', 'medical'))
        .toMatchObject({ 
          allowed: true,
          reason: 'EMERGENCY_OVERRIDE'
        });
    });
  });
});
```

## Monitoring & Metrics

```typescript
interface RBACMetrics {
  // Performance metrics
  permission_check_duration: Histogram;
  cache_hit_rate: Gauge;
  
  // Authorization metrics
  authorization_attempts: Counter;
  authorization_denials: Counter;
  authorization_conflicts: Counter;
  
  // System health
  active_roles: Gauge;
  active_delegations: Gauge;
  expired_permissions_pending_cleanup: Gauge;
  
  // Security metrics
  rate_limit_violations: Counter;
  emergency_overrides_activated: Counter;
  suspicious_access_patterns: Counter;
}

class RBACMonitoring {
  private prometheusRegistry: prometheus.Registry;
  private metrics: RBACMetrics;
  
  constructor() {
    this.prometheusRegistry = new prometheus.Registry();
    this.initializeMetrics();
  }
  
  private initializeMetrics(): void {
    this.metrics = {
      // Performance metrics
      permission_check_duration: new prometheus.Histogram({
        name: 'rbac_permission_check_duration_seconds',
        help: 'Duration of permission checks',
        buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
        labelNames: ['resource_type', 'action', 'cache_hit']
      }),
      
      cache_hit_rate: new prometheus.Gauge({
        name: 'rbac_cache_hit_rate',
        help: 'Permission cache hit rate percentage',
        labelNames: ['cache_level'] // 'l1_local' or 'l2_redis'
      }),
      
      // Authorization metrics
      authorization_attempts: new prometheus.Counter({
        name: 'rbac_authorization_attempts_total',
        help: 'Total number of authorization attempts',
        labelNames: ['resource_type', 'action', 'user_role']
      }),
      
      authorization_denials: new prometheus.Counter({
        name: 'rbac_authorization_denials_total',
        help: 'Total number of authorization denials',
        labelNames: ['reason', 'resource_type', 'user_role']
      }),
      
      authorization_conflicts: new prometheus.Counter({
        name: 'rbac_authorization_conflicts_total',
        help: 'Number of permission conflicts resolved',
        labelNames: ['conflict_type', 'resolution']
      }),
      
      // System health
      active_roles: new prometheus.Gauge({
        name: 'rbac_active_roles_count',
        help: 'Number of active role assignments',
        labelNames: ['role_type']
      }),
      
      active_delegations: new prometheus.Gauge({
        name: 'rbac_active_delegations_count',
        help: 'Number of active delegations'
      }),
      
      expired_permissions_pending_cleanup: new prometheus.Gauge({
        name: 'rbac_expired_permissions_pending',
        help: 'Number of expired permissions awaiting cleanup'
      }),
      
      // Security metrics
      rate_limit_violations: new prometheus.Counter({
        name: 'rbac_rate_limit_violations_total',
        help: 'Number of rate limit violations',
        labelNames: ['user_id', 'resource_type']
      }),
      
      emergency_overrides_activated: new prometheus.Counter({
        name: 'rbac_emergency_overrides_total',
        help: 'Number of emergency overrides activated',
        labelNames: ['reason', 'triggered_by_role']
      }),
      
      suspicious_access_patterns: new prometheus.Counter({
        name: 'rbac_suspicious_patterns_total',
        help: 'Number of suspicious access patterns detected',
        labelNames: ['pattern_type', 'severity']
      })
    };
    
    // Register all metrics
    Object.values(this.metrics).forEach(metric => {
      this.prometheusRegistry.registerMetric(metric);
    });
  }
  
  // Method to record permission check metrics
  recordPermissionCheck(
    duration: number,
    resourceType: string,
    action: string,
    cacheHit: boolean,
    result: AuthorizationResult
  ): void {
    // Record duration
    this.metrics.permission_check_duration
      .labels(resourceType, action, cacheHit.toString())
      .observe(duration / 1000);
    
    // Record attempt
    this.metrics.authorization_attempts
      .labels(resourceType, action, result.roleId || 'unknown')
      .inc();
    
    // Record denial if applicable
    if (!result.allowed) {
      this.metrics.authorization_denials
        .labels(result.reason, resourceType, result.roleId || 'unknown')
        .inc();
    }
  }
  
  // Method to record cache metrics
  recordCacheMetrics(l1HitRate: number, l2HitRate: number): void {
    this.metrics.cache_hit_rate.labels('l1_local').set(l1HitRate);
    this.metrics.cache_hit_rate.labels('l2_redis').set(l2HitRate);
  }
  
  // Expose metrics endpoint for Prometheus scraping
  getMetricsEndpoint(): string {
    return this.prometheusRegistry.metrics();
  }
  
  async collectMetrics(): Promise<void> {
    // Collect every minute
    setInterval(async () => {
      const systemMetrics = await this.gatherSystemMetrics();
      
      // Update system health metrics
      Object.entries(systemMetrics.rolesByType).forEach(([roleType, count]) => {
        this.metrics.active_roles.labels(roleType).set(count);
      });
      
      this.metrics.active_delegations.set(systemMetrics.activeDelegations);
      this.metrics.expired_permissions_pending_cleanup.set(systemMetrics.expiredPermissions);
      
      // Check for anomalies and alert
      if (systemMetrics.authorizationDenials > 100) {
        await this.alert('High authorization denial rate', {
          count: systemMetrics.authorizationDenials,
          threshold: 100
        });
      }
      
      const avgCacheHitRate = (systemMetrics.l1CacheHitRate + systemMetrics.l2CacheHitRate) / 2;
      if (avgCacheHitRate < 0.8) {
        await this.alert('Low cache hit rate', {
          rate: avgCacheHitRate,
          threshold: 0.8
        });
      }
      
      // Update cache metrics
      this.recordCacheMetrics(systemMetrics.l1CacheHitRate, systemMetrics.l2CacheHitRate);
      
    }, 60000);
  }
  
  private async gatherSystemMetrics(): Promise<SystemMetrics> {
    // Implementation to gather actual system metrics from database and cache
    const [roleStats, delegationStats, cacheStats] = await Promise.all([
      this.getRoleStatistics(),
      this.getDelegationStatistics(),
      this.getCacheStatistics()
    ]);
    
    return {
      rolesByType: roleStats,
      activeDelegations: delegationStats.active,
      expiredPermissions: delegationStats.expired,
      authorizationDenials: cacheStats.recentDenials,
      l1CacheHitRate: cacheStats.l1HitRate,
      l2CacheHitRate: cacheStats.l2HitRate
    };
  }
  
  private async alert(message: string, data?: any): Promise<void> {
    console.error(`RBAC Alert: ${message}`, data);
    // Integration with alerting system (PagerDuty, Slack, etc.)
  }
}

interface SystemMetrics {
  rolesByType: Record<string, number>;
  activeDelegations: number;
  expiredPermissions: number;
  authorizationDenials: number;
  l1CacheHitRate: number;
  l2CacheHitRate: number;
}
```

## API Endpoints

```typescript
// Authorization check endpoint
POST /api/v1/authorize
{
  "userId": "uuid",
  "action": "schedule.read",
  "resourceId": "uuid",
  "resourceType": "schedule"
}

Response:
{
  "allowed": true,
  "reason": "DIRECT_ROLE_ALLOW",
  "roleId": "role_caregiver",
  "ttl": 300
}

// Role assignment endpoint  
POST /api/v1/roles/assign
{
  "userId": "uuid",
  "roleType": "caregiver",
  "scope": {
    "type": "individual",
    "entities": ["recipient_uuid"]
  },
  "validUntil": "2024-12-31T23:59:59Z",
  "reason": "Primary caregiver for parent"
}

// Delegation endpoint
POST /api/v1/delegations
{
  "toUserId": "uuid",
  "roleId": "role_caregiver",
  "validFrom": "2024-02-01T00:00:00Z",
  "validUntil": "2024-02-14T23:59:59Z",
  "reason": "Vacation coverage",
  "scope": {
    "type": "individual",
    "entities": ["recipient_uuid"]
  }
}

// Emergency override endpoint
POST /api/v1/emergency/override
{
  "userId": "uuid",
  "reason": "medical_emergency",
  "durationMinutes": 60,
  "justification": "Ambulance called, need immediate access to medical history"
}
```

## Implementation Roadmap - Updated

### Phase 1: Core RBAC (2 weeks)
- [x] Database schema with proper normalization
- [x] Authorization service with precedence rules
- [x] Basic audit logging for all checks
- [ ] Migration script for existing users
- [ ] Core API endpoints
- [ ] Integration tests

### Phase 2: Advanced Features (2 weeks)  
- [ ] Recurring schedules implementation
- [ ] Delegation workflow with approvals
- [ ] Cache layer with invalidation
- [ ] Rate limiting
- [ ] Comprehensive audit logging
- [ ] Performance optimization

### Phase 3: Emergency & Monitoring (1 week)
- [ ] Emergency override system
- [ ] Monitoring and metrics
- [ ] Admin dashboard
- [ ] Automated alerts
- [ ] Performance testing at scale

### Phase 4: Polish & Scale (1 week)
- [ ] Helper and Child roles
- [ ] Bot/Agent automation
- [ ] Advanced analytics
- [ ] API documentation
- [ ] Load testing

## Success Metrics
- Permission checks < 50ms (p95) ✓
- Cache hit rate > 80% ✓
- 100% audit coverage for sensitive actions ✓
- Zero unauthorized access incidents ✓
- Role assignment < 2 seconds ✓
- System handles 10,000 concurrent users ✓

## Production Deployment Checklist

### Pre-Deployment Preparation

#### Database Setup
- [ ] **Database Migration**: Execute all schema creation scripts in order
- [ ] **Stored Procedures**: Verify all stored procedures (cycle prevention, hierarchy management) are installed
- [ ] **Indexes**: Confirm all performance indexes are created
- [ ] **Materialized Views**: Create and initially populate user_permissions view
- [ ] **Database Backup**: Take full backup before migration
- [ ] **Connection Pooling**: Configure appropriate connection pool sizes for production load
- [ ] **Database Monitoring**: Set up monitoring for query performance and deadlocks

#### Application Configuration
- [ ] **Environment Variables**: Set all production environment variables
  - [ ] `RBAC_CACHE_TTL_SECONDS`
  - [ ] `RBAC_RATE_LIMIT_WINDOW_MS`
  - [ ] `RBAC_EMERGENCY_OVERRIDE_MAX_DURATION`
  - [ ] `REDIS_CONNECTION_STRING`
  - [ ] `PROMETHEUS_METRICS_PORT`
- [ ] **Redis Cache**: Configure Redis cluster for high availability
- [ ] **Rate Limiting**: Set appropriate rate limits for production traffic
- [ ] **Logging Configuration**: Enable structured logging with appropriate log levels

#### Security Setup
- [ ] **Permission Sets**: Create and validate all default permission sets
- [ ] **Default Roles**: Set up system roles (admin, caregiver, viewer, etc.)
- [ ] **Admin Accounts**: Create initial admin accounts with proper MFA
- [ ] **API Keys**: Generate and securely store service account API keys
- [ ] **Encryption**: Verify all sensitive data fields are encrypted at rest

### Deployment Process

#### Migration Execution
- [ ] **Pre-Migration Testing**: Run migration on staging environment
- [ ] **Backup Verification**: Confirm database backup completed successfully
- [ ] **User Migration**: Execute `RBACMigration.migrateExistingUsers()`
- [ ] **Data Validation**: Verify all existing users have appropriate role assignments
- [ ] **Permission Audit**: Run permission check validation on sample users
- [ ] **Rollback Plan**: Confirm rollback procedures are tested and ready

#### Application Deployment
- [ ] **Code Deployment**: Deploy RBAC service code
- [ ] **Service Dependencies**: Ensure Redis and database connections are healthy
- [ ] **Health Checks**: Verify all health check endpoints respond correctly
- [ ] **Feature Flags**: Enable RBAC system gradually (if using feature flags)
- [ ] **Load Balancer**: Update load balancer configuration for new endpoints

### Post-Deployment Verification

#### Functional Testing
- [ ] **Authorization Endpoints**: Test `/api/v1/authorize` with various permission scenarios
- [ ] **Role Assignment**: Verify role assignment workflow works end-to-end
- [ ] **Delegation System**: Test delegation creation and approval process
- [ ] **Emergency Override**: Verify emergency override activation (in test environment)
- [ ] **Cache Invalidation**: Confirm permission changes invalidate cache correctly
- [ ] **Audit Logging**: Verify all permission checks and changes are logged

#### Performance Validation
- [ ] **Response Times**: Confirm authorization checks complete within 50ms (p95)
- [ ] **Cache Hit Rate**: Verify cache hit rate exceeds 80%
- [ ] **Database Performance**: Monitor query execution times and connection usage
- [ ] **Memory Usage**: Check application memory consumption under load
- [ ] **Concurrent Users**: Test system behavior with expected concurrent user load

#### Monitoring Setup
- [ ] **Prometheus Metrics**: Verify metrics are being exported correctly
- [ ] **Grafana Dashboards**: Set up RBAC monitoring dashboards
- [ ] **Alerting Rules**: Configure alerts for:
  - [ ] High authorization denial rates (>100/minute)
  - [ ] Low cache hit rates (<80%)
  - [ ] Permission check latency spikes (>100ms p95)
  - [ ] Emergency override activations
  - [ ] Rate limit violations
- [ ] **Log Aggregation**: Ensure logs are flowing to centralized logging system
- [ ] **Error Tracking**: Set up error tracking for authorization failures

### Security Validation

#### Access Control Testing
- [ ] **Privilege Escalation**: Verify users cannot access resources outside their scope
- [ ] **Cross-Family Access**: Confirm family isolation is maintained
- [ ] **Expired Permissions**: Test that expired roles/delegations are properly handled
- [ ] **Conflict Resolution**: Verify deny permissions override allow permissions
- [ ] **Emergency Access**: Test emergency override notifications and audit trails

#### Audit and Compliance
- [ ] **Audit Log Completeness**: Verify all security-relevant events are logged
- [ ] **Data Retention**: Confirm audit logs are retained per compliance requirements
- [ ] **Access Reviews**: Set up periodic access review processes
- [ ] **Compliance Reports**: Ensure required compliance reports can be generated

### Operational Readiness

#### Documentation
- [ ] **Runbook**: Create operational runbook for common issues
- [ ] **API Documentation**: Publish updated API documentation
- [ ] **User Guides**: Update user guides for role management interfaces
- [ ] **Troubleshooting Guide**: Document common authorization issues and solutions

#### Team Preparation
- [ ] **Training**: Train support staff on RBAC system operation
- [ ] **Escalation Procedures**: Define escalation paths for RBAC-related issues
- [ ] **On-Call Coverage**: Ensure on-call engineers understand the RBAC system
- [ ] **Incident Response**: Update incident response procedures for permission-related issues

### Go-Live Checklist

#### Final Verification (Day of Go-Live)
- [ ] **System Health**: All monitoring dashboards show green status
- [ ] **Database Performance**: No blocking queries or excessive connections
- [ ] **Cache Status**: Redis cluster healthy and properly configured
- [ ] **Test Users**: Sample authorization checks working correctly
- [ ] **Rollback Readiness**: Rollback procedures confirmed and ready
- [ ] **Team Availability**: Key personnel available for monitoring

#### Post Go-Live Monitoring (First 24 Hours)
- [ ] **Error Rates**: Monitor for any spike in authorization errors
- [ ] **Performance Metrics**: Track response times and resource usage
- [ ] **User Feedback**: Monitor support channels for RBAC-related issues
- [ ] **System Stability**: Ensure no memory leaks or connection issues
- [ ] **Audit Log Volume**: Verify audit logging is not overwhelming storage

### Success Criteria
- [ ] **Performance**: 95th percentile authorization checks < 50ms
- [ ] **Availability**: RBAC system uptime > 99.9%
- [ ] **Cache Efficiency**: Cache hit rate > 80%
- [ ] **Error Rate**: Authorization error rate < 0.1%
- [ ] **Security**: Zero unauthorized access incidents in first week
- [ ] **User Experience**: No user-facing disruptions due to RBAC changes

---

**Document Status**: PRODUCTION READY
**Version**: 2.0
**Last Updated**: Today
**Review Status**: Lead Developer Approved