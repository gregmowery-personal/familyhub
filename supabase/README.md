# FamilyHub Supabase Database Setup

This directory contains the complete database schema and migrations for FamilyHub's authentication system built on Supabase PostgreSQL.

## Quick Start

### Prerequisites

1. **Supabase Project**: Create a new project at [supabase.com](https://supabase.com)
2. **Supabase CLI**: Install the Supabase CLI
   ```bash
   npm install -g supabase
   ```
3. **Environment Setup**: Configure your environment variables

### Installation Steps

1. **Initialize Supabase locally** (if not already done):
   ```bash
   supabase init
   ```

2. **Link to your Supabase project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. **Run migrations**:
   ```bash
   supabase db push
   ```

4. **Generate TypeScript types**:
   ```bash
   supabase gen types typescript --local > src/types/database.types.ts
   ```

## Migration Files

The schema is deployed through 8 sequential migrations:

| Migration | File | Purpose |
|-----------|------|---------|
| 001 | `20250803000001_initial_auth_schema.sql` | Core tables: families, family_members, user_profiles |
| 002 | `20250803000002_session_management.sql` | Session tracking and device management |
| 003 | `20250803000003_token_management.sql` | Authentication tokens and password reset |
| 004 | `20250803000004_social_auth_providers.sql` | Social authentication (Google, Apple, etc.) |
| 005 | `20250803000005_audit_logging.sql` | Security audit logging and incident tracking |
| 006 | `20250803000006_row_level_security.sql` | RLS policies for data security |
| 007 | `20250803000007_performance_indexes_and_functions.sql` | Performance optimization |
| 008 | `20250803000008_audit_triggers.sql` | Automatic audit logging triggers |

## Environment Variables

Add these to your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Database Direct Connection (for migrations)
DATABASE_URL=postgresql://postgres:password@localhost:54322/postgres
```

## Database Schema Overview

### Core Entities

- **Families**: Family groups with configurable types and settings
- **Family Members**: Users linked to families with roles and permissions
- **User Profiles**: Extended user information beyond Supabase auth
- **Sessions**: Enhanced session management with device tracking
- **Tokens**: Centralized token management for various purposes
- **Social Providers**: Social authentication integration
- **Audit Logs**: Comprehensive security and compliance logging

### Security Features

- **Row Level Security (RLS)**: Enabled on all tables with granular policies
- **Role-Based Access**: Admin, Adult, Teen, Child, Senior roles with hierarchy
- **Audit Trail**: All security-sensitive operations are logged
- **Device Management**: Track and trust user devices
- **Anomaly Detection**: Automatic detection of suspicious activities
- **Rate Limiting**: Built-in protection against brute force attacks

## Key Functions

### Family Management
```sql
-- Check if user is family admin
SELECT public.is_family_admin('user-uuid', 'family-uuid');

-- Get user's families
SELECT public.get_user_families('user-uuid');

-- Get family member counts by role
SELECT * FROM public.get_family_member_counts('family-uuid');
```

### Security Functions
```sql
-- Check login rate limits
SELECT * FROM public.check_login_rate_limit('user@example.com', 'email');

-- Detect login anomalies
SELECT * FROM public.detect_login_anomalies('user-uuid');

-- Clean up expired data
SELECT * FROM public.cleanup_expired_data();
```

### Session Management
```sql
-- Get active session count
SELECT public.get_user_active_sessions_count('user-uuid');

-- Update session activity
SELECT public.update_session_activity('session-token');
```

## Usage Examples

### TypeScript Integration

```typescript
import { createClient } from '@supabase/supabase-js';
import { Database } from './types/database.types';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Get user's families with members
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

// Create family invitation
const { data, error } = await supabase
  .from('family_invitation_tokens')
  .insert({
    family_id: 'family-uuid',
    invited_email: 'new-member@example.com',
    invited_role: 'adult',
    inviter_id: user.id,
    token_hash: hashedToken,
    relationship: 'sibling'
  });
```

### Authentication Flows

```typescript
// Enhanced login with device tracking
const loginWithDevice = async (email: string, password: string, deviceInfo: any) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (data.user) {
    // Create enhanced session record
    await supabase.rpc('create_user_session', {
      p_user_id: data.user.id,
      p_session_token: data.session.access_token,
      p_device_info: deviceInfo,
      p_ip_address: getClientIP(),
      p_expires_at: new Date(data.session.expires_at * 1000).toISOString()
    });
  }
  
  return { data, error };
};

// Family invitation acceptance
const acceptFamilyInvitation = async (token: string) => {
  const { data, error } = await supabase.rpc('verify_token', {
    p_token_hash: hashToken(token),
    p_token_type: 'family_invitation'
  });
  
  if (data.is_valid) {
    // Join family
    await supabase
      .from('family_members')
      .insert({
        family_id: data.family_id,
        user_id: user.id,
        role: data.metadata.invited_role,
        relationship: data.metadata.relationship
      });
  }
  
  return { data, error };
};
```

## Security Configuration

### Supabase Auth Settings

In your Supabase dashboard, configure:

1. **Auth Settings**:
   - Enable email confirmations
   - Set password requirements
   - Configure JWT expiry

2. **Social Providers**:
   - Google OAuth (configure in `social_provider_configs`)
   - Apple Sign In (configure in `social_provider_configs`)

3. **Security**:
   - Enable RLS enforcement
   - Configure rate limiting
   - Set up email templates

### Row Level Security

RLS policies are automatically applied. Key patterns:

- Users can only access their own data
- Family members can access shared family data
- Role hierarchy is enforced (admin > adult > teen > child)
- Audit logs are filtered by relevance to the user

## Data Maintenance

### Automated Cleanup

Set up a cron job or scheduled function to run:

```sql
SELECT public.cleanup_expired_data();
```

This will:
- Remove expired tokens
- Archive old audit logs
- Clean up inactive sessions
- Remove old login attempts

### Manual Maintenance

```sql
-- Check database health
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes
FROM pg_stat_user_tables
WHERE schemaname = 'public';

-- Monitor audit log size
SELECT 
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE occurred_at > NOW() - INTERVAL '30 days') as recent_events,
  pg_size_pretty(pg_total_relation_size('auth_audit_log')) as table_size
FROM auth_audit_log;
```

## Troubleshooting

### Common Issues

1. **RLS Permission Denied**:
   - Check user authentication
   - Verify family membership
   - Review role permissions

2. **Migration Failures**:
   - Ensure migrations run in sequence
   - Check for existing objects
   - Review error logs

3. **Performance Issues**:
   - Check index usage
   - Monitor query performance
   - Consider data archiving

### Debug Queries

```sql
-- Check RLS policy execution
SET rls.debug = on;
SELECT * FROM families LIMIT 1;

-- Monitor slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

## Contributing

When modifying the schema:

1. Create new migration files with sequential timestamps
2. Update this README with changes
3. Regenerate TypeScript types
4. Update documentation
5. Test RLS policies thoroughly

## Support

For issues or questions:

1. Check the [AUTHENTICATION_SCHEMA.md](./AUTHENTICATION_SCHEMA.md) for detailed documentation
2. Review migration files for specific implementation details
3. Test queries against local Supabase instance
4. Consult Supabase documentation for platform-specific features

---

**Note**: This schema is designed for production use with comprehensive security, audit logging, and compliance features. Test thoroughly in a development environment before deploying to production.