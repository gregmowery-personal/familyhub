# FamilyHub Authentication Database Schema

## Overview

This document provides comprehensive documentation for the FamilyHub authentication database schema. The schema is designed to support multi-generational family coordination with robust security, audit logging, and compliance features built on Supabase PostgreSQL.

## Architecture Principles

- **Security First**: Row Level Security (RLS) on all tables with granular permissions
- **Multi-Family Support**: Users can belong to multiple families with different roles
- **Audit Trail**: Comprehensive logging of all security-sensitive operations
- **Scalability**: Optimized indexes and efficient query patterns
- **Compliance**: GDPR-ready with data retention and cleanup policies
- **Family Hierarchy**: Support for complex family relationships and role-based access

## Core Tables

### 1. Families (`public.families`)

Central table for family group management.

```sql
CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  family_type family_type NOT NULL DEFAULT 'nuclear',
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete support
);
```

**Key Features:**
- Supports various family types: nuclear, single_parent, blended, multigenerational, extended
- Timezone-aware for coordinating across different locations
- Soft delete capability for data retention

**RLS Policies:**
- Users can only view/manage families they belong to
- Only family admins can update family settings

### 2. Family Members (`public.family_members`)

Links users to families with roles and permissions.

```sql
CREATE TABLE public.family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES public.families(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role user_role_type NOT NULL DEFAULT 'adult',
  relationship VARCHAR(50),
  birth_date DATE,
  is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
  is_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE,
  is_family_admin BOOLEAN NOT NULL DEFAULT FALSE,
  access_level access_level NOT NULL DEFAULT 'full',
  interface_preference interface_complexity NOT NULL DEFAULT 'full',
  custody_schedule JSONB,
  custody_percentage INTEGER,
  -- ... timestamps and soft delete
);
```

**Role Hierarchy:**
- `admin`: Full access to all family data and settings
- `adult`: Can view/edit most content, restricted from sensitive data
- `teen`: Age-appropriate interface, can manage own tasks
- `child`: Simplified interface, limited permissions
- `senior`: Simplified interface option, participation-focused

**Key Features:**
- Flexible custody arrangements with JSON scheduling
- Interface complexity preferences for age-appropriate UX
- Emergency contact designation
- Unique constraints ensuring data integrity

### 3. User Profiles (`public.user_profiles`)

Extended user information beyond Supabase's built-in auth.

```sql
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  display_name VARCHAR(100),
  phone_number VARCHAR(20),
  profile_image_url TEXT,
  preferred_language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'UTC',
  notification_preferences JSONB DEFAULT '{}',
  accessibility_preferences JSONB DEFAULT '{}',
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  -- ... timestamps and soft delete
);
```

**Key Features:**
- Automatic profile creation via trigger when user signs up
- JSONB preferences for flexible configuration
- Accessibility support built-in
- MFA readiness

## Session Management

### 4. User Sessions (`public.user_sessions`)

Enhanced session tracking beyond Supabase's built-in sessions.

```sql
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  family_id UUID REFERENCES public.families(id),
  session_token VARCHAR(255) NOT NULL UNIQUE,
  device_id VARCHAR(255),
  device_name VARCHAR(100),
  device_type VARCHAR(20), -- 'mobile', 'tablet', 'desktop', 'web'
  platform VARCHAR(50),
  browser_name VARCHAR(50),
  ip_address INET,
  country VARCHAR(2),
  city VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_trusted_device BOOLEAN DEFAULT FALSE,
  active_family_role user_role_type,
  -- ... security flags
);
```

**Key Features:**
- Device fingerprinting and tracking
- Geographic location tracking
- Family context awareness
- Concurrent session limits
- Suspicious activity detection

### 5. User Devices (`public.user_devices`)

Device management and trust tracking.

```sql
CREATE TABLE public.user_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  device_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(100) NOT NULL,
  device_type VARCHAR(20) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  fingerprint_hash VARCHAR(255),
  push_token VARCHAR(500),
  is_trusted BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  is_blocked BOOLEAN DEFAULT FALSE,
  -- ... timestamps
);
```

**Security Features:**
- Device fingerprinting for security
- Trust establishment process
- Device blocking capability
- Push notification token management

## Token Management

### 6. Authentication Tokens (`public.auth_tokens`)

Centralized token management for various purposes.

```sql
CREATE TABLE public.auth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  token_type token_type NOT NULL,
  token_status token_status NOT NULL DEFAULT 'active',
  user_id UUID REFERENCES auth.users(id),
  email VARCHAR(255),
  family_id UUID REFERENCES public.families(id),
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER DEFAULT 1,
  uses_count INTEGER DEFAULT 0,
  metadata JSONB,
  -- ... security and tracking fields
);
```

**Token Types:**
- `password_reset`: Password recovery tokens
- `email_verification`: Email address verification
- `family_invitation`: Family member invitation tokens
- `magic_link`: Magic link authentication
- `mfa_backup`: Multi-factor authentication backup codes
- `account_verification`: New account verification
- `session_challenge`: Session security challenges

### 7. Family Invitation Tokens (`public.family_invitation_tokens`)

Specialized tokens for family member invitations.

```sql
CREATE TABLE public.family_invitation_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES public.families(id),
  invited_email VARCHAR(255) NOT NULL,
  inviter_id UUID NOT NULL REFERENCES auth.users(id),
  invited_role user_role_type DEFAULT 'adult',
  relationship VARCHAR(50),
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  invitation_message TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  -- ... lifecycle management
);
```

**Key Features:**
- Pre-configured role assignment
- Relationship suggestions
- Custom invitation messages
- Acceptance tracking

## Social Authentication

### 8. Social Auth Providers (`public.social_auth_providers`)

Manages connections to social authentication providers.

```sql
CREATE TABLE public.social_auth_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  provider social_provider_type NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  provider_username VARCHAR(100),
  provider_email VARCHAR(255),
  provider_data JSONB,
  display_name VARCHAR(255),
  avatar_url TEXT,
  link_status link_status DEFAULT 'active',
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_primary_provider BOOLEAN DEFAULT FALSE,
  auto_login_enabled BOOLEAN DEFAULT TRUE,
  -- ... security and audit fields
);
```

**Supported Providers:**
- Google
- Apple
- Facebook
- Microsoft
- GitHub
- Twitter
- LinkedIn

**Security Features:**
- Account linking conflict detection
- Provider data validation
- Automatic unlinking safeguards

## Security & Audit

### 9. Authentication Audit Log (`public.auth_audit_log`)

Comprehensive audit logging for security and compliance.

```sql
CREATE TABLE public.auth_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type audit_event_type NOT NULL,
  event_category VARCHAR(50) NOT NULL,
  severity audit_severity DEFAULT 'medium',
  actor_user_id UUID REFERENCES auth.users(id),
  actor_type VARCHAR(20) DEFAULT 'user',
  actor_ip_address INET,
  actor_user_agent TEXT,
  target_user_id UUID REFERENCES auth.users(id),
  target_family_id UUID REFERENCES public.families(id),
  event_description TEXT NOT NULL,
  event_data JSONB,
  success BOOLEAN DEFAULT TRUE,
  risk_score INTEGER,
  is_anomalous BOOLEAN DEFAULT FALSE,
  retention_period INTERVAL DEFAULT INTERVAL '7 years',
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  -- ... additional context fields
);
```

**Event Categories:**
- Authentication events (login, logout, password changes)
- Authorization events (role changes, permissions)
- Data access events (sensitive data viewing)
- Administrative actions
- Security incidents

### 10. Security Incidents (`public.security_incidents`)

Tracks security incidents and investigations.

```sql
CREATE TABLE public.security_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_type VARCHAR(50) NOT NULL,
  severity audit_severity NOT NULL,
  status VARCHAR(20) DEFAULT 'open',
  affected_user_ids UUID[],
  affected_family_ids UUID[],
  affected_ip_addresses INET[],
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  actions_taken TEXT[],
  auto_mitigation_applied BOOLEAN DEFAULT FALSE,
  initial_risk_score INTEGER,
  final_risk_score INTEGER,
  -- ... investigation fields
);
```

**Incident Types:**
- Brute force attacks
- Credential stuffing
- Anomalous access patterns
- Account takeover attempts
- Data breach attempts

## Row Level Security (RLS)

All tables have RLS enabled with comprehensive policies:

### Family-Based Access Control
- Users can only access data for families they belong to
- Family admins have elevated permissions within their families
- Role hierarchy enforced at database level

### User Data Protection
- Users can only access their own profile and session data
- Family members can view each other's basic information
- Sensitive data restricted to appropriate roles

### Audit Log Security
- Users can view audit logs related to their actions
- Family-related events visible to family members
- System events logged with appropriate access controls

## Performance Optimization

### Indexes

**Primary Indexes:**
```sql
-- Family membership queries
CREATE INDEX idx_family_members_user_family_deleted 
ON family_members(user_id, family_id) WHERE deleted_at IS NULL;

-- Active session queries
CREATE INDEX idx_user_sessions_active_user_device 
ON user_sessions(user_id, device_id, is_active) WHERE is_active = TRUE;

-- Security monitoring
CREATE INDEX idx_login_attempts_failed_recent 
ON login_attempts(ip_address, attempted_at, email) 
WHERE success = FALSE AND attempted_at > NOW() - INTERVAL '24 hours';
```

**Full-Text Search:**
```sql
-- Name searches
CREATE INDEX idx_user_profiles_name_search 
ON user_profiles USING GIN(to_tsvector('english', 
  COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(display_name, '')
));
```

**JSONB Indexes:**
```sql
-- Preference queries
CREATE INDEX idx_user_profiles_notification_prefs 
ON user_profiles USING GIN(notification_preferences);
```

### Query Patterns

**Common Queries Optimized:**
- User family membership lookups
- Active session management
- Security event monitoring
- Audit log searching
- Token validation

## Data Retention & Cleanup

### Automated Cleanup

The `cleanup_expired_data()` function automatically:
- Removes expired tokens
- Archives old audit logs based on retention policies
- Cleans up terminated sessions
- Removes old login attempts

### Retention Policies

- **Audit logs**: 7 years (configurable per event type)
- **Login attempts**: 90 days
- **Session data**: 30 days after termination
- **Security incidents**: 2 years after resolution
- **Social login attempts**: 30 days

## Migration Strategy

### Database Migrations

Eight sequential migrations create the complete schema:

1. **Initial Auth Schema** - Core tables (families, family_members, user_profiles)
2. **Session Management** - Session and device tracking
3. **Token Management** - All token types and management
4. **Social Auth Providers** - Social authentication support
5. **Audit Logging** - Comprehensive audit infrastructure
6. **Row Level Security** - All RLS policies and helper functions
7. **Performance & Functions** - Indexes and utility functions
8. **Audit Triggers** - Automatic audit logging triggers

### Deployment Steps

1. Run migrations in sequence
2. Configure Supabase Auth settings
3. Set up social provider credentials
4. Configure cleanup job scheduling
5. Test RLS policies
6. Verify audit logging

## Security Considerations

### Authentication Security
- Password hashing via Supabase Auth
- Multi-factor authentication support
- Session management with device tracking
- Rate limiting on login attempts

### Data Protection
- Row Level Security on all tables
- Encrypted sensitive data storage
- Audit trail for all data access
- GDPR compliance features

### Social Authentication Security
- Provider account conflict detection
- Secure token storage (hashed)
- Account linking verification
- Provider data validation

### Monitoring & Alerting
- Anomaly detection algorithms
- Automated incident creation
- Risk scoring for events
- Security incident tracking

## API Integration

### Supabase Client Usage

```typescript
// Example: Get user's families
const { data: families } = await supabase
  .from('families')
  .select(`
    id,
    name,
    family_type,
    family_members!inner(
      role,
      is_family_admin,
      user_profiles(first_name, last_name)
    )
  `)
  .eq('family_members.user_id', user.id);

// Example: Create family invitation
const { data: invitation } = await supabase
  .rpc('create_family_invitation', {
    family_id: familyId,
    invited_email: email,
    invited_role: 'adult',
    relationship: 'sibling'
  });
```

### Custom Functions

Key functions available for application use:
- `is_family_admin(user_id, family_id)` - Check admin status
- `get_user_families(user_id)` - Get user's family list
- `create_user_session()` - Enhanced session creation
- `log_audit_event()` - Manual audit logging
- `cleanup_expired_data()` - Data maintenance

## Troubleshooting

### Common Issues

**RLS Policy Errors:**
- Ensure user is authenticated
- Check family membership
- Verify role permissions

**Performance Issues:**
- Check index usage with EXPLAIN
- Monitor slow query log
- Consider query optimization

**Audit Logging:**
- Verify trigger execution
- Check function permissions
- Monitor audit log size

### Monitoring Queries

```sql
-- Check RLS policy performance
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM families WHERE id = 'family-uuid';

-- Monitor audit log growth
SELECT 
  event_category,
  COUNT(*) as event_count,
  MIN(occurred_at) as oldest,
  MAX(occurred_at) as newest
FROM auth_audit_log 
GROUP BY event_category;

-- Track security incidents
SELECT 
  incident_type,
  severity,
  status,
  COUNT(*) as count
FROM security_incidents 
GROUP BY incident_type, severity, status;
```

## Future Enhancements

### Planned Features
- Biometric authentication support
- Advanced anomaly detection
- Real-time security monitoring
- Extended social provider support
- Enhanced MFA options

### Schema Evolution
- Version migration support
- Backward compatibility maintenance
- Performance optimization tracking
- Security enhancement integration

---

This schema provides a robust foundation for FamilyHub's authentication needs while maintaining security, performance, and scalability for multi-generational family coordination.