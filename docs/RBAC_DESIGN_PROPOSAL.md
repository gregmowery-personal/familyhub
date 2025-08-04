# RBAC Design Proposal for FamilyHub

## Executive Summary
This document proposes a Role-Based Access Control (RBAC) system for FamilyHub, a family coordination platform for managing schedules, reminders, and caregiving tasks. The system must support multi-generational families with varying technical abilities and complex care scenarios.

## ✅ Team Decisions Summary

| Topic | Decision | Rationale |
|-------|----------|-----------|
| **Permission Model** | Resource-Action Model | Simple, explicit, easy to audit/debug |
| **Role Binding** | Permission Sets | Modular, maintainable, prevents role explosion |
| **Scope System** | Scoped Assignments | Aligns with family structure |
| **Time-Bounding** | Role-level time bounds | Clear audit trail, better UX |
| **Conflict Resolution** | Deny Overrides | Safer default for family privacy |
| **Delegation** | Explicit delegation records | Intuitive, auditable |
| **Audit Logging** | Start basic, grow to detailed | Balance privacy with accountability |

## Current Proposed Role Structure

### Core Roles
1. **Admin** - Account owner/primary coordinator
2. **Caregiver** - Active task/appointment/medication management
3. **Viewer** - Read-only access for staying informed
4. **Care Recipient** - Simplified interface for receiving care
5. **Child** - Supervised user with limited capabilities
6. **Helper** - Temporary/limited access (babysitter, nurse)
7. **Emergency Contact** - Crisis-only notifications
8. **Bot/Agent** - System automation role

### Role Implementation Strategy
- **Phase 1 (MVP)**: Admin, Caregiver, Viewer, Care Recipient
- **Phase 2**: Helper (with time-bounded access)
- **Phase 3**: Child, Emergency Contact
- **Phase 4**: Bot/Agent (automation)

**Note**: Roles will be feature-flagged for gradual rollout

## Chosen Implementation Approach

### 1. Permission Model Architecture

**✅ DECISION: Resource-Action Model with Scope**

```typescript
interface Permission {
  id: string;
  resource: 'schedule' | 'reminder' | 'document' | 'user' | 'checkIn' | 'note';
  action: 'create' | 'read' | 'update' | 'delete' | 'share';
  scope?: 'own' | 'assigned' | 'family' | 'all'; // Enhancement for resource boundaries
  constraints?: Record<string, any>;
}
```

**Rationale**: 
- Simple and explicit
- Easy to audit and debug
- Can extend with scope field for resource-bound checks
- Policy-based and capability models reserved for future phases if needed

### 2. Role-Permission Binding

**✅ DECISION: Permission Sets/Groups**

```typescript
interface PermissionSet {
  id: string;
  name: string; // e.g., "calendar_management", "care_coordination"
  description: string;
  permissions: Permission[];
}

interface Role {
  id: string;
  name: string;
  description: string; // User-facing explanation
  permissionSets: PermissionSet[];
  tags?: string[]; // For internal grouping: 'core', 'temporary', 'system'
}
```

**Example Permission Sets**:
```typescript
const calendarManagement: PermissionSet = {
  id: 'ps_calendar',
  name: 'calendar_management',
  description: 'Manage family calendars and events',
  permissions: [
    { resource: 'schedule', action: 'create', scope: 'family' },
    { resource: 'schedule', action: 'read', scope: 'family' },
    { resource: 'schedule', action: 'update', scope: 'assigned' },
    { resource: 'schedule', action: 'delete', scope: 'own' }
  ]
};
```

**Rationale**:
- Easier to manage than direct assignments
- More maintainable than inheritance
- Prevents role explosion
- Semantic grouping makes permissions intuitive

### 3. Scope and Resource Boundaries

**✅ DECISION: Scoped Assignments with Future ABAC Considerations**

```typescript
interface RoleAssignment {
  userId: string;
  roleId: string;
  scope: {
    type: 'global' | 'family' | 'individual';
    entityIds: string[]; // Family IDs or User IDs
  };
  grantedBy: string; // User ID who granted this role
  reason?: string; // Audit trail for why access was granted
  assignedAt: Date;
  expiresAt?: Date;
}

// Example: Caregiver for specific care recipients
const caregiverAssignment: RoleAssignment = {
  userId: 'user_123',
  roleId: 'role_caregiver',
  scope: {
    type: 'individual',
    entityIds: ['recipient_456', 'recipient_789'] // Specific care recipients
  },
  grantedBy: 'admin_001',
  reason: 'Primary caregiver for parents',
  assignedAt: new Date()
};
```

**Future Enhancement (Phase 2+)**:
```typescript
// ABAC-style conditions for complex scenarios
interface ConditionalAccess {
  baseAssignment: RoleAssignment;
  conditions?: {
    relationshipType?: 'parent' | 'child' | 'spouse' | 'professional';
    emergencyOnly?: boolean;
    requiresApproval?: boolean;
  };
}
```

**Rationale**:
- Scoped roles align perfectly with FamilyHub's family structure
- Avoids ReBAC graph complexity
- ABAC conditions can be added later for edge cases
- Clear audit trail with grantedBy and reason fields

### 4. Time-Bounded and Conditional Access

**✅ DECISION: Time-Bounded Role Assignments (Phase 1) with Conditional Permissions (Phase 3)**

```typescript
interface TimeBoundedAssignment extends RoleAssignment {
  validFrom: Date;
  validUntil?: Date;
  recurringSchedule?: {
    daysOfWeek: number[]; // 0-6, Sunday-Saturday
    timeStart: string; // "15:00"
    timeEnd: string; // "18:00"
    timezone: string; // "America/New_York"
  };
  expirationReminder?: {
    daysBeforeExpiry: number; // Send reminder X days before
    notifyUsers: string[]; // Who to notify about expiration
  };
}

// Example: Babysitter with evening access
const babysitterAccess: TimeBoundedAssignment = {
  userId: 'helper_001',
  roleId: 'role_helper',
  scope: { type: 'individual', entityIds: ['child_001', 'child_002'] },
  grantedBy: 'parent_001',
  reason: 'After-school care',
  assignedAt: new Date(),
  validFrom: new Date('2024-01-01'),
  validUntil: new Date('2024-06-30'),
  recurringSchedule: {
    daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
    timeStart: '15:00',
    timeEnd: '18:00',
    timezone: 'America/New_York'
  },
  expirationReminder: {
    daysBeforeExpiry: 7,
    notifyUsers: ['parent_001', 'helper_001']
  }
};
```

**Rationale**:
- Clear audit trail ("you're a helper from Aug 10-12")
- Better UX than abstract conditional permissions
- Expiration reminders prevent access surprises
- Conditional permissions saved for Phase 3 automation/emergencies

### 5. Conflict Resolution

**✅ DECISION: Deny Overrides with Conflict Logging**

```typescript
interface PermissionEvaluation {
  async evaluate(user: User, action: string, resource: Resource): Promise<AccessDecision> {
    const userRoles = await this.getUserRoles(user.id);
    const decisions: PermissionDecision[] = [];
    
    for (const role of userRoles) {
      const decision = await this.checkRolePermission(role, action, resource);
      decisions.push(decision);
      
      // Deny overrides - if any role denies, access is denied
      if (decision.effect === 'deny') {
        await this.logConflict({
          userId: user.id,
          action,
          resource,
          deniedBy: role.id,
          otherRoles: userRoles.filter(r => r.id !== role.id),
          timestamp: new Date()
        });
        
        return {
          allowed: false,
          reason: `Access denied by role: ${role.name}`,
          conflictLogged: true
        };
      }
    }
    
    // If no denials and at least one allow, grant access
    const hasAllow = decisions.some(d => d.effect === 'allow');
    return {
      allowed: hasAllow,
      reason: hasAllow ? 'Access granted' : 'No permissions found'
    };
  }
}

interface ConflictLog {
  userId: string;
  action: string;
  resource: Resource;
  deniedBy: string;
  otherRoles: Role[];
  timestamp: Date;
  resolution?: string; // Admin can add resolution notes
}
```

**Rationale**:
- Safer default for family privacy
- Easier to reason about than priority systems
- Conflict logging helps admins understand and resolve issues
- Can surface conflicts to admins for manual resolution

### 6. Delegation and Substitution

**✅ DECISION: Explicit Delegation Records**

```typescript
interface Delegation {
  id: string;
  fromUserId: string;
  toUserId: string;
  roleId: string; // Which role is being delegated
  scope: RoleScope; // Same scope as original assignment
  permissions?: Permission[]; // Optional: subset of role permissions
  validFrom: Date;
  validUntil: Date;
  reason: string;
  approvedBy?: string; // Admin approval if required
  createdAt: Date;
  revokedAt?: Date;
  revokedBy?: string;
  revokeReason?: string;
}

// Example: Vacation coverage
const vacationDelegation: Delegation = {
  id: 'del_001',
  fromUserId: 'caregiver_primary',
  toUserId: 'caregiver_backup',
  roleId: 'role_caregiver',
  scope: { type: 'individual', entityIds: ['recipient_001'] },
  validFrom: new Date('2024-02-01'),
  validUntil: new Date('2024-02-14'),
  reason: 'Vacation coverage - February 1-14',
  approvedBy: 'admin_001',
  createdAt: new Date()
};

// UI-friendly delegation creation
interface DelegationRequest {
  delegateEmail: string;
  duration: 'today' | 'week' | 'custom';
  customDates?: { from: Date; until: Date };
  reason: string;
  requiresApproval: boolean;
}
```

**Rationale**:
- Clear audit trail for compliance
- More intuitive than "Acting-As" for family users
- Allows future UI: "Temporarily delegate to..."
- Scoped and time-bounded for security
- Revocation support for immediate access removal

### 7. Audit and Compliance

**✅ DECISION: Progressive Audit Strategy - Basic (Phase 1) → Comprehensive (Phase 2)**

**Phase 1: Basic Audit**
```typescript
interface BasicAuditLog {
  id: string;
  userId: string;
  action: string; // 'schedule.create', 'reminder.update', etc.
  resourceType: string;
  resourceId: string;
  timestamp: Date;
  success: boolean;
  errorReason?: string;
}
```

**Phase 2: Comprehensive Audit (for sensitive actions)**
```typescript
interface ComprehensiveAuditLog extends BasicAuditLog {
  userRoles: string[];
  resourceOwner?: string;
  accessPath: 'direct_role' | 'delegation' | 'emergency_override';
  ipAddress?: string;
  sessionId: string;
  deviceInfo?: {
    type: 'web' | 'mobile' | 'api';
    userAgent?: string;
  };
  changeDetails?: {
    before?: any;
    after?: any;
  };
}

// Sensitive actions requiring comprehensive audit
const SENSITIVE_ACTIONS = [
  'user.role.assign',
  'user.role.revoke',
  'delegation.create',
  'checkIn.view',
  'document.download',
  'permission.override'
];

// Admin-downloadable audit report
interface AuditReport {
  requestedBy: string;
  dateRange: { from: Date; to: Date };
  filters?: {
    users?: string[];
    actions?: string[];
    resources?: string[];
  };
  entries: (BasicAuditLog | ComprehensiveAuditLog)[];
  generatedAt: Date;
  downloadUrl?: string; // For CSV/PDF export
}
```

**Rationale**:
- No HIPAA requirements simplifies logging needs
- Focus on permission changes and sensitive info access
- Downloadable logs provide transparency for families
- Progressive approach avoids over-engineering

## Database Schema Implementation

### Enhanced Core Tables

```sql
-- Roles table with additional metadata
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT NOT NULL, -- User-facing explanation
  role_type VARCHAR(20) NOT NULL CHECK (role_type IN ('core', 'temporary', 'system')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions with scope support
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  scope VARCHAR(20) CHECK (scope IN ('own', 'assigned', 'family', 'all')),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource, action, scope)
);

-- Permission Sets for modular permission management
CREATE TABLE permission_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link permission sets to permissions
CREATE TABLE permission_set_permissions (
  permission_set_id UUID REFERENCES permission_sets(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (permission_set_id, permission_id)
);

-- Link roles to permission sets
CREATE TABLE role_permission_sets (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_set_id UUID REFERENCES permission_sets(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_set_id)
);

-- Enhanced user role assignments with scope and time bounds
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id),
  
  -- Scope fields
  scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('global', 'family', 'individual')),
  scope_entity_ids TEXT[], -- Array of entity IDs this role applies to
  
  -- Assignment metadata
  granted_by UUID REFERENCES users(id),
  reason TEXT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Time bounds
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,
  
  -- Recurring schedule (stored as JSONB for flexibility)
  recurring_schedule JSONB,
  -- Example: {"daysOfWeek": [1,2,3,4,5], "timeStart": "15:00", "timeEnd": "18:00", "timezone": "America/New_York"}
  
  -- Expiration reminder
  reminder_days_before INTEGER,
  reminder_sent BOOLEAN DEFAULT false,
  
  is_active BOOLEAN DEFAULT true,
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES users(id),
  revoke_reason TEXT,
  
  UNIQUE(user_id, role_id, scope_type, scope_entity_ids)
);

-- Delegation records
CREATE TABLE delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES users(id),
  to_user_id UUID REFERENCES users(id),
  role_id UUID REFERENCES roles(id),
  
  -- Scope (same as user_roles)
  scope_type VARCHAR(20) NOT NULL,
  scope_entity_ids TEXT[],
  
  -- Optional permission subset (JSONB array of permission IDs)
  permission_subset JSONB,
  
  -- Time bounds
  valid_from TIMESTAMP NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  
  -- Metadata
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Revocation
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES users(id),
  revoke_reason TEXT,
  
  is_active BOOLEAN DEFAULT true,
  
  CHECK (valid_until > valid_from)
);

-- Audit logs (starts basic, can be extended)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL, -- e.g., 'schedule.create'
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  success BOOLEAN NOT NULL,
  error_reason TEXT,
  
  -- Extended fields for Phase 2
  user_roles TEXT[], -- Snapshot of user's roles at time of action
  resource_owner UUID,
  access_path VARCHAR(50), -- 'direct_role', 'delegation', 'emergency_override'
  ip_address INET,
  session_id UUID,
  device_info JSONB,
  change_details JSONB, -- {"before": {...}, "after": {...}}
  
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id) WHERE is_active = true;
CREATE INDEX idx_user_roles_expires ON user_roles(valid_until) WHERE valid_until IS NOT NULL;
CREATE INDEX idx_delegations_active ON delegations(to_user_id) WHERE is_active = true;
CREATE INDEX idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_sensitive ON audit_logs(action) WHERE action IN ('user.role.assign', 'user.role.revoke', 'delegation.create');
```

## Implementation Roadmap

### Phase 1: Core RBAC (MVP)
- **Roles**: Admin, Caregiver, Viewer, Care Recipient
- **Permission Model**: Resource-Action with basic scopes
- **Permission Sets**: Calendar, Care Management, Read-Only
- **Database**: Core tables without time bounds
- **Audit**: Basic logging for all actions
- **Testing**: Unit tests for permission evaluation

### Phase 2: Scoped Access & Delegation
- **Scoped Assignments**: Individual and family-level access
- **Delegation**: Vacation coverage, temporary substitutes
- **Time Bounds**: Role expiration and reminders
- **Audit**: Comprehensive logging for sensitive actions
- **Admin UI**: Basic role management interface

### Phase 3: Advanced Features
- **Roles**: Helper (with recurring schedules), Child
- **Conditional Access**: Emergency overrides, approval workflows
- **ABAC Integration**: Relationship-based permissions
- **Audit Reports**: Downloadable logs for families
- **Performance**: Caching layer for permission checks

### Phase 4: Automation & Intelligence
- **Roles**: Emergency Contact, Bot/Agent
- **Smart Suggestions**: "Add backup caregiver?"
- **Automated Grants**: Emergency escalation
- **Analytics**: Role usage patterns
- **API**: External integrations

## Additional Implementation Recommendations

### Testing Strategy
```typescript
// Example test cases for RBAC
describe('RBAC Permission Evaluation', () => {
  test('Caregiver can only access assigned recipients', async () => {
    const caregiver = await createUser('caregiver');
    const recipient1 = await createUser('recipient1');
    const recipient2 = await createUser('recipient2');
    
    await assignRole(caregiver, 'caregiver', {
      scope: { type: 'individual', entityIds: [recipient1.id] }
    });
    
    expect(await can(caregiver, 'schedule.read', recipient1)).toBe(true);
    expect(await can(caregiver, 'schedule.read', recipient2)).toBe(false);
  });
  
  test('Deny overrides in conflict resolution', async () => {
    // User has both viewer (allow) and restricted (deny) roles
    expect(await can(user, 'document.delete', resource)).toBe(false);
  });
});
```

### Caching Strategy
```typescript
interface PermissionCache {
  key: string; // `${userId}:${action}:${resourceId}`
  result: boolean;
  roles: string[];
  expiresAt: Date; // 5-minute TTL
}

// Invalidate cache on:
// - Role assignment/revocation
// - Delegation creation/expiration
// - Permission set updates
```

### Admin Interface Requirements
- Visual role assignment with drag-drop for families
- Time-bound access calendar view
- Delegation workflow with approval queue
- Audit log viewer with filters
- Role expiration notifications dashboard

### Feature Flags
```typescript
const FEATURE_FLAGS = {
  'rbac.helper_role': false,        // Phase 2
  'rbac.delegation': false,          // Phase 2
  'rbac.time_bounds': false,         // Phase 2
  'rbac.child_role': false,          // Phase 3
  'rbac.emergency_override': false,  // Phase 3
  'rbac.bot_role': false,            // Phase 4
};
```

## Security Considerations

1. **Principle of Least Privilege**: Default to minimal access
2. **Defense in Depth**: Multiple permission check layers
3. **Fail Secure**: Deny by default when uncertain
4. **Audit Trail**: Log all permission changes and sensitive access
5. **Regular Review**: Automated alerts for stale permissions
6. **Session Management**: Re-verify permissions on role changes
7. **Rate Limiting**: Prevent permission checking abuse

## Performance Optimizations

1. **Permission Caching**: 5-minute TTL with smart invalidation
2. **Database Indexing**: Optimized for common query patterns
3. **Batch Evaluation**: Check multiple permissions in one query
4. **Lazy Loading**: Only load permissions when needed
5. **Connection Pooling**: Reuse database connections
6. **Audit Async**: Queue audit logs for async processing

## Next Steps

### Immediate Actions
1. ✅ **Create database migrations** for Phase 1 tables
2. ✅ **Build permission evaluation service** with tests
3. ✅ **Implement basic audit logging**
4. ✅ **Create seed data** for testing roles

### Phase 1 Deliverables (2 weeks)
- [ ] Core RBAC implementation
- [ ] Permission evaluation API
- [ ] Basic audit logging
- [ ] Integration tests
- [ ] Documentation

### Success Metrics
- Permission checks < 50ms (p95)
- 100% audit coverage for sensitive actions
- Zero unauthorized access incidents
- Role assignment time < 2 seconds

## Appendix: Example Use Cases to Validate Against

1. **Elder Care**: Adult daughter (Admin) coordinates care for mother (Care Recipient) with professional caregiver (Caregiver) and siblings (Viewers)

2. **Child Care**: Single parent (Admin) manages schedule for two children (Child roles) with after-school babysitter (Helper) having limited access 3-6pm weekdays

3. **Post-Surgery**: Patient (Care Recipient) has spouse (Admin), visiting nurse (Caregiver with 2-week access), and friends (Viewers) coordinating recovery

4. **Multi-Generational**: Grandparents (Care Recipients), parents (Admins/Caregivers), teenage kids (Helpers for grandparents), younger kids (Child roles)

Each use case should be walkthrough-able with the chosen RBAC design.

## Summary of Decisions

Based on team feedback, we have chosen a pragmatic approach that balances simplicity with flexibility:

1. **Resource-Action permission model** with scope support
2. **Permission Sets** for modular permission management  
3. **Scoped role assignments** for family structure alignment
4. **Time-bounded roles** with expiration reminders
5. **Deny-overrides** conflict resolution with logging
6. **Explicit delegation records** for vacation coverage
7. **Progressive audit strategy** from basic to comprehensive

This design provides a solid foundation for FamilyHub's multi-generational family coordination needs while maintaining simplicity for MVP and allowing for future enhancements.

---

**Document Status**: ✅ APPROVED - Ready for Implementation
**Last Updated**: Today
**Implementation Start**: Phase 1 beginning immediately