# Family Groups Database Schema Documentation

*"The realm of families, forged by Elrond of Rivendell, keeper of database wisdom"*

## Overview

This document describes the comprehensive Family Groups system that enables users to belong to multiple families with role-based access control, subscription management, and secure data isolation. The schema integrates seamlessly with our existing RBAC system to provide enterprise-grade family coordination capabilities.

## Schema Architecture

### Core Tables

#### 1. `subscription_tiers`
**Purpose**: Defines subscription plans with features and limits

**Key Features**:
- Flexible pricing (monthly/yearly/free)
- Feature flags using JSONB for extensibility
- Member and storage limits per tier
- Stripe integration fields

**Business Rules**:
- Free tier: 3 members, 1GB storage, 25 documents, 1 family
- Standard tier: 8 members, 5GB storage, 100 documents, 2 families
- Premium tier: 15 members, 25GB storage, 500 documents, 5 families

```sql
CREATE TABLE subscription_tiers (
  id UUID PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  max_family_members INTEGER DEFAULT 5,
  max_storage_gb INTEGER DEFAULT 1,
  features JSONB DEFAULT '{}',
  -- ... additional fields
);
```

#### 2. `families`
**Purpose**: Main family entity with subscription and configuration

**Key Features**:
- Subscription management with Stripe integration
- Family-specific settings and preferences
- Invite codes for easy family joining
- Status tracking (active/suspended/archived)

**RLS Policy**: Users can only see families they're members of

```sql
CREATE TABLE families (
  id UUID PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  subscription_tier_id UUID REFERENCES subscription_tiers(id),
  subscription_status VARCHAR(30) DEFAULT 'active',
  timezone VARCHAR(50) DEFAULT 'UTC',
  invite_code VARCHAR(20) UNIQUE,
  -- ... additional fields
);
```

#### 3. `family_memberships`
**Purpose**: Links users to families with roles and permissions

**Key Features**:
- One membership per user per family
- Role-based access control integration
- Temporary access support (for helpers/emergency contacts)
- Default family designation
- Invitation tracking

**RLS Policy**: Users see memberships for families they belong to

```sql
CREATE TABLE family_memberships (
  id UUID PRIMARY KEY,
  family_id UUID REFERENCES families(id),
  user_id UUID NOT NULL, -- References auth.users(id)
  role_id UUID REFERENCES roles(id),
  status VARCHAR(20) DEFAULT 'active',
  is_default_family BOOLEAN DEFAULT false,
  -- ... additional fields
);
```

#### 4. `family_invitations`
**Purpose**: Manages family invitation process

**Key Features**:
- Secure invitation tokens
- Expiration handling
- Personal messages and role suggestions
- Status tracking (pending/accepted/declined/expired)

```sql
CREATE TABLE family_invitations (
  id UUID PRIMARY KEY,
  family_id UUID REFERENCES families(id),
  invited_email VARCHAR(255) NOT NULL,
  invitation_token VARCHAR(100) UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending',
  -- ... additional fields
);
```

#### 5. `user_family_preferences`
**Purpose**: Cross-family user preferences and settings

**Key Features**:
- Default family selection
- Global notification preferences
- UI and accessibility settings
- Timezone and locale preferences

```sql
CREATE TABLE user_family_preferences (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  default_family_id UUID REFERENCES families(id),
  email_notifications_enabled BOOLEAN DEFAULT true,
  -- ... additional fields
);
```

## Integration with RBAC System

### Role Hierarchy in Family Context

The family system leverages our existing 9-role hierarchy:

1. **system_admin** (Priority 200): Cross-family administrative access
2. **family_coordinator** (Priority 100): Full family management
3. **caregiver** (Priority 90): Care management within family
4. **care_recipient** (Priority 70): Self-management with oversight
5. **helper** (Priority 60): Temporary assistance
6. **emergency_contact** (Priority 50): Emergency-only access
7. **child** (Priority 40): Age-appropriate permissions
8. **viewer** (Priority 30): Read-only family access
9. **bot_agent** (Priority 10): Automated system access

### Permission Scoping

Family memberships automatically scope permissions to the appropriate family context:

- **Global scope**: System admins across all families
- **Family scope**: Role permissions within specific family
- **Individual scope**: Personal data and assigned items

## Key Functions and Procedures

### `add_family_member()`
Safely adds a user to a family with validation:
- Checks family status and subscription limits
- Creates membership record
- Sets default family if user's first
- Returns membership ID

### `set_default_family()`
Updates user's default family:
- Validates user is active member
- Updates user preferences
- Updates membership flags

### `validate_family_limits()`
Checks if family can add more members:
- Compares current count to subscription tier limit
- Returns boolean result

### `generate_family_invite_code()`
Creates secure, unique invitation codes:
- 12-character alphanumeric (no ambiguous characters)
- Collision detection with retry logic
- Used for family joining

## Performance Optimizations

### Critical Indexes

```sql
-- Family access lookups (most critical)
idx_family_memberships_user_active ON family_memberships(user_id, status)
idx_family_memberships_family_active ON family_memberships(family_id, status)

-- Default family queries
idx_family_memberships_default ON family_memberships(user_id, is_default_family)

-- Invitation lookups
idx_family_invitations_email_status ON family_invitations(invited_email, status)
idx_family_invitations_token ON family_invitations(invitation_token)
```

### Materialized View: `user_family_access`

Pre-computed view for efficient access control queries:

```sql
CREATE MATERIALIZED VIEW user_family_access AS
SELECT 
  fm.user_id,
  fm.family_id,
  f.name as family_name,
  r.type as role_type,
  r.priority as role_priority,
  st.name as subscription_tier,
  -- Access validation logic
FROM family_memberships fm
JOIN families f ON fm.family_id = f.id
JOIN roles r ON fm.role_id = r.id
JOIN subscription_tiers st ON f.subscription_tier_id = st.id
WHERE fm.status = 'active' AND f.status = 'active';
```

## Row Level Security (RLS) Policies

### Family Data Isolation

Each table has comprehensive RLS policies ensuring:

1. **Family Members Only**: Users can only access data for families they belong to
2. **Role-Based Permissions**: Different roles have different access levels
3. **Self-Access**: Users can always see their own data
4. **Administrative Override**: System admins can access all data

### Example Policies

```sql
-- Families: Users see families they're members of
CREATE POLICY "families_member_policy" ON families 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM family_memberships fm
    WHERE fm.family_id = id 
    AND fm.user_id = auth.uid() 
    AND fm.status = 'active'
  )
);

-- Memberships: Family coordinators can manage
CREATE POLICY "family_memberships_coordinator_policy" ON family_memberships 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM family_memberships fm
    JOIN roles r ON fm.role_id = r.id
    WHERE fm.family_id = family_id 
    AND fm.user_id = auth.uid() 
    AND r.type IN ('family_coordinator', 'system_admin')
  )
);
```

## Common Query Patterns

### Find User's Families
```sql
SELECT f.*, fm.role_id, r.type as role_type, fm.is_default_family
FROM families f
JOIN family_memberships fm ON f.id = fm.family_id
JOIN roles r ON fm.role_id = r.id
WHERE fm.user_id = $1 AND fm.status = 'active' AND f.status = 'active';
```

### Check Family Access
```sql
SELECT EXISTS (
  SELECT 1 FROM user_family_access ufa
  WHERE ufa.user_id = $1 AND ufa.family_id = $2 
  AND ufa.access_currently_valid = true
);
```

### Get Family Members with Roles
```sql
SELECT u.email, fm.display_name, fm.relationship, r.name as role_name
FROM family_memberships fm
JOIN auth.users u ON fm.user_id = u.id
JOIN roles r ON fm.role_id = r.id
WHERE fm.family_id = $1 AND fm.status = 'active'
ORDER BY r.priority DESC, fm.joined_at;
```

### Validate Subscription Limits
```sql
SELECT f.name, st.max_family_members, COUNT(fm.id) as current_members
FROM families f
JOIN subscription_tiers st ON f.subscription_tier_id = st.id
LEFT JOIN family_memberships fm ON f.id = fm.family_id AND fm.status = 'active'
WHERE f.id = $1
GROUP BY f.id, st.id;
```

## Multi-Family User Experience

### Family Switching
Users with multiple families can:
1. Set a default family for login
2. Switch between families in the UI
3. Maintain separate preferences per family
4. Have different roles in each family

### Invitation Flow
1. Family coordinator generates invitation
2. Invitation email sent with secure token
3. Recipient accepts/declines via token
4. Automatic membership creation on acceptance
5. Role assignment and permissions activation

## Security Considerations

### Data Isolation
- Complete separation between families via RLS
- No cross-family data leakage possible
- Role-based access within families
- Audit trail for all access

### Subscription Enforcement
- Real-time limit validation
- Graceful degradation for over-limit families
- Billing status integration
- Feature flag enforcement

### Invitation Security
- Cryptographically secure tokens
- Expiration enforcement
- Email validation
- One-time use tokens

## Migration and Deployment

The schema is deployed via migration `20250806000003_family_groups_schema.sql` which:

1. Creates all tables with proper constraints
2. Establishes RLS policies
3. Creates performance indexes
4. Seeds default subscription tiers
5. Sets up materialized views

### Rollback Strategy
Complete rollback script provided in migration file for safe deployment.

## Monitoring and Maintenance

### Key Metrics to Monitor
- Family membership growth per tier
- Subscription limit violations
- Invitation acceptance rates
- Family switching frequency
- RLS policy performance

### Maintenance Tasks
- Regular materialized view refresh
- Expired invitation cleanup
- Audit log archival
- Performance index monitoring

---

*"Thus were forged the bonds that unite families across the realms, with wisdom gathered from ages of data protection and the strength of Narsil reborn."* - Elrond of Rivendell