# Family Groups Implementation Examples

*"As the light of Eärendil guides ships through darkness, these examples shall guide developers through the realm of family coordination."*

## Common Operations and Code Examples

### 1. User Registration with Family Creation

When a new user signs up and creates their first family:

```typescript
// Create new family for user (family coordinator role)
export async function createUserFamily(userId: string, familyName: string) {
  const supabase = createServerClient();
  
  // Start transaction
  const { data: family, error: familyError } = await supabase
    .from('families')
    .insert({
      name: familyName,
      subscription_tier_id: await getFreeTierId(),
      created_by: userId,
      invite_code: await generateInviteCode()
    })
    .select()
    .single();

  if (familyError) throw familyError;

  // Get family_coordinator role
  const { data: coordinatorRole } = await supabase
    .from('roles')
    .select('id')
    .eq('type', 'family_coordinator')
    .single();

  // Add user as family coordinator
  const { error: membershipError } = await supabase
    .rpc('add_family_member', {
      p_family_id: family.id,
      p_user_id: userId,
      p_role_id: coordinatorRole.id,
      p_display_name: 'Family Coordinator'
    });

  if (membershipError) throw membershipError;

  return family;
}
```

### 2. Family Invitation System

Inviting a new member to an existing family:

```typescript
// Send family invitation
export async function inviteFamilyMember(
  familyId: string,
  inviterUserId: string,
  inviteeEmail: string,
  roleType: string,
  personalMessage?: string
) {
  const supabase = createServerClient();

  // Verify inviter has permission (family_coordinator or system_admin)
  const { data: hasPermission } = await supabase
    .rpc('user_has_family_permission', {
      p_user_id: inviterUserId,
      p_family_id: familyId,
      p_required_roles: ['family_coordinator', 'system_admin']
    });

  if (!hasPermission) {
    throw new Error('Insufficient permissions to invite family members');
  }

  // Get role ID
  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('type', roleType)
    .single();

  // Create invitation
  const invitationToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const { data: invitation, error } = await supabase
    .from('family_invitations')
    .insert({
      family_id: familyId,
      invited_email: inviteeEmail,
      invited_role_id: role.id,
      invited_by: inviterUserId,
      invitation_token: invitationToken,
      expires_at: expiresAt.toISOString(),
      personal_message: personalMessage
    })
    .select()
    .single();

  if (error) throw error;

  // Send invitation email (implementation depends on your email service)
  await sendInvitationEmail(invitation);

  return invitation;
}

// Accept family invitation
export async function acceptFamilyInvitation(
  invitationToken: string,
  acceptingUserId: string
) {
  const supabase = createServerClient();

  // Get invitation details
  const { data: invitation, error: inviteError } = await supabase
    .from('family_invitations')
    .select(`
      *,
      families (
        id, name, status,
        subscription_tiers (max_family_members)
      )
    `)
    .eq('invitation_token', invitationToken)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single();

  if (inviteError || !invitation) {
    throw new Error('Invalid or expired invitation');
  }

  // Validate family can accept new members
  const { data: currentMembers } = await supabase
    .from('family_memberships')
    .select('id')
    .eq('family_id', invitation.family_id)
    .eq('status', 'active');

  if (currentMembers.length >= invitation.families.subscription_tiers.max_family_members) {
    throw new Error('Family has reached maximum member limit');
  }

  // Add user to family
  const { error: membershipError } = await supabase
    .rpc('add_family_member', {
      p_family_id: invitation.family_id,
      p_user_id: acceptingUserId,
      p_role_id: invitation.invited_role_id,
      p_invited_by: invitation.invited_by
    });

  if (membershipError) throw membershipError;

  // Mark invitation as accepted
  await supabase
    .from('family_invitations')
    .update({
      status: 'accepted',
      responded_at: new Date().toISOString()
    })
    .eq('id', invitation.id);

  return invitation.families;
}
```

### 3. Family Switching and Context Management

Managing user's current family context:

```typescript
// Get user's families
export async function getUserFamilies(userId: string) {
  const supabase = createServerClient();

  const { data: families, error } = await supabase
    .from('user_family_access')
    .select(`
      family_id,
      family_name,
      role_type,
      role_priority,
      is_default_family,
      subscription_tier,
      tier_features,
      subscription_status,
      access_currently_valid
    `)
    .eq('user_id', userId)
    .eq('access_currently_valid', true)
    .order('is_default_family', { ascending: false })
    .order('role_priority', { ascending: false });

  if (error) throw error;

  return families;
}

// Switch user's default family
export async function setUserDefaultFamily(
  userId: string,
  familyId: string
) {
  const supabase = createServerClient();

  const { error } = await supabase
    .rpc('set_default_family', {
      p_user_id: userId,
      p_family_id: familyId
    });

  if (error) throw error;

  // Refresh user session to pick up new default
  await supabase.auth.refreshSession();
}

// Get user's current family context
export async function getCurrentFamilyContext(userId: string) {
  const supabase = createServerClient();

  // Try to get from user preferences first
  const { data: preferences } = await supabase
    .from('user_family_preferences')
    .select(`
      default_family_id,
      families (
        id, name, status,
        subscription_tiers (name, features)
      )
    `)
    .eq('user_id', userId)
    .single();

  if (preferences?.default_family_id) {
    return preferences.families;
  }

  // Fallback to first active family
  const { data: fallbackFamily } = await supabase
    .from('user_family_access')
    .select('family_id, family_name')
    .eq('user_id', userId)
    .eq('access_currently_valid', true)
    .order('role_priority', { ascending: false })
    .limit(1)
    .single();

  return fallbackFamily;
}
```

### 4. Permission Checking in Application Context

Checking if user can perform actions within family context:

```typescript
// Custom hook for family permissions
export function useFamilyPermissions(familyId: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['family-permissions', user?.id, familyId],
    queryFn: async () => {
      if (!user?.id || !familyId) return null;
      
      const supabase = createClientComponentClient();
      
      // Get user's permissions in this family context
      const { data: permissions } = await supabase
        .from('user_permissions')
        .select('resource, action, effect, scope')
        .eq('user_id', user.id)
        .eq('scoped_to_entity', familyId);
      
      return permissions;
    },
    enabled: !!user?.id && !!familyId
  });
}

// Helper function to check specific permission
export function hasPermission(
  permissions: Permission[],
  resource: string,
  action: string
): boolean {
  return permissions?.some(p => 
    p.resource === resource && 
    p.action === action && 
    p.effect === 'allow'
  ) || false;
}

// Usage in component
function FamilyMemberCard({ member, familyId }: Props) {
  const { data: permissions } = useFamilyPermissions(familyId);
  const canEditMember = hasPermission(permissions, 'user', 'update');
  const canRemoveMember = hasPermission(permissions, 'user', 'delete');

  return (
    <div className="member-card">
      <h3>{member.display_name}</h3>
      <p>{member.relationship} • {member.role_name}</p>
      
      {canEditMember && (
        <Button onClick={() => editMember(member.id)}>
          Edit Member
        </Button>
      )}
      
      {canRemoveMember && (
        <Button onClick={() => removeMember(member.id)} variant="destructive">
          Remove from Family
        </Button>
      )}
    </div>
  );
}
```

### 5. Subscription Management Integration

Managing family subscription tiers and limits:

```typescript
// Check subscription limits before adding features
export async function validateSubscriptionAction(
  familyId: string,
  action: 'add_member' | 'upload_document' | 'create_family'
) {
  const supabase = createServerClient();

  const { data: family, error } = await supabase
    .from('families')
    .select(`
      subscription_status,
      subscription_tiers (
        name,
        max_family_members,
        max_storage_gb,
        max_documents,
        features
      )
    `)
    .eq('id', familyId)
    .single();

  if (error) throw error;

  const tier = family.subscription_tiers;

  switch (action) {
    case 'add_member':
      const { count: memberCount } = await supabase
        .from('family_memberships')
        .select('id', { count: 'exact' })
        .eq('family_id', familyId)
        .eq('status', 'active');

      return {
        allowed: memberCount < tier.max_family_members,
        current: memberCount,
        limit: tier.max_family_members,
        message: memberCount >= tier.max_family_members 
          ? `Family has reached member limit (${tier.max_family_members})`
          : undefined
      };

    case 'upload_document':
      // Similar logic for document limits
      const { count: docCount } = await supabase
        .from('documents')
        .select('id', { count: 'exact' })
        .eq('family_id', familyId);

      return {
        allowed: docCount < tier.max_documents,
        current: docCount,
        limit: tier.max_documents,
        message: docCount >= tier.max_documents
          ? `Family has reached document limit (${tier.max_documents})`
          : undefined
      };

    default:
      return { allowed: true };
  }
}

// Upgrade subscription tier
export async function upgradeFamilySubscription(
  familyId: string,
  newTierId: string,
  stripeSubscriptionId?: string
) {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('families')
    .update({
      subscription_tier_id: newTierId,
      stripe_subscription_id: stripeSubscriptionId,
      subscription_status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('id', familyId);

  if (error) throw error;

  // Refresh materialized view to pick up new permissions
  await supabase.rpc('refresh_user_family_access');
}
```

### 6. Family Dashboard Data Queries

Efficient queries for family dashboard:

```typescript
// Complete family dashboard data
export async function getFamilyDashboardData(familyId: string, userId: string) {
  const supabase = createServerClient();

  // Parallel queries for efficiency
  const [familyInfo, members, recentActivity, upcomingEvents] = await Promise.all([
    // Family basic info
    supabase
      .from('families')
      .select(`
        id, name, created_at,
        subscription_tiers (display_name, features),
        subscription_status
      `)
      .eq('id', familyId)
      .single(),

    // Active family members
    supabase
      .from('family_memberships')
      .select(`
        id, display_name, relationship, joined_at,
        roles (name, type, priority),
        user_id
      `)
      .eq('family_id', familyId)
      .eq('status', 'active')
      .order('roles.priority', { ascending: false }),

    // Recent activity (would be from audit logs)
    supabase
      .from('audit_permission_changes')
      .select('change_type, timestamp, justification')
      .eq('affected_family', familyId) // Assuming we add family context to audit
      .order('timestamp', { ascending: false })
      .limit(10),

    // Upcoming events (from your events table)
    supabase
      .from('events')
      .select('id, title, start_time, event_type')
      .eq('family_id', familyId)
      .gte('start_time', new Date().toISOString())
      .order('start_time')
      .limit(5)
  ]);

  return {
    family: familyInfo.data,
    members: members.data,
    recentActivity: recentActivity.data,
    upcomingEvents: upcomingEvents.data
  };
}

// Family members with permissions
export async function getFamilyMembersWithPermissions(familyId: string) {
  const supabase = createServerClient();

  const { data: members, error } = await supabase
    .from('family_memberships')
    .select(`
      id,
      display_name,
      relationship,
      joined_at,
      status,
      user_id,
      roles (
        id,
        name,
        type,
        priority,
        description
      ),
      access_valid_until
    `)
    .eq('family_id', familyId)
    .order('roles.priority', { ascending: false });

  if (error) throw error;

  // Enhance with permission counts
  const membersWithPerms = await Promise.all(
    members.map(async (member) => {
      const { count: permissionCount } = await supabase
        .from('user_permissions')
        .select('id', { count: 'exact' })
        .eq('user_id', member.user_id)
        .eq('scoped_to_entity', familyId);

      return {
        ...member,
        permissionCount,
        isTemporary: !!member.access_valid_until,
        accessExpires: member.access_valid_until
      };
    })
  );

  return membersWithPerms;
}
```

### 7. Database Maintenance and Monitoring

Regular maintenance operations:

```typescript
// Cleanup expired invitations
export async function cleanupExpiredInvitations() {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('family_invitations')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());

  if (error) {
    console.error('Failed to cleanup expired invitations:', error);
  }
}

// Refresh materialized views (should be run periodically)
export async function refreshFamilyMaterializedViews() {
  const supabase = createServerClient();

  try {
    await Promise.all([
      supabase.rpc('refresh_user_family_access'),
      supabase.rpc('refresh_user_permissions')
    ]);
  } catch (error) {
    console.error('Failed to refresh materialized views:', error);
  }
}

// Monitor subscription limits
export async function getSubscriptionLimitReport() {
  const supabase = createServerClient();

  const { data: report, error } = await supabase
    .from('families')
    .select(`
      id,
      name,
      subscription_status,
      subscription_tiers (
        name,
        max_family_members,
        max_documents
      ),
      family_memberships (count),
      documents (count)
    `)
    .eq('status', 'active');

  if (error) throw error;

  return report.map(family => ({
    familyId: family.id,
    familyName: family.name,
    tier: family.subscription_tiers.name,
    memberUsage: `${family.family_memberships.length}/${family.subscription_tiers.max_family_members}`,
    documentUsage: `${family.documents.length}/${family.subscription_tiers.max_documents}`,
    isOverLimit: family.family_memberships.length > family.subscription_tiers.max_family_members
  }));
}
```

---

*"These examples shall serve as the foundation stones upon which great family coordination applications are built. May they guide you well through the complexities of multi-family data management."* - Elrond of Rivendell

## Summary

This implementation provides:

1. **Complete family lifecycle management** - from creation to member management
2. **Secure invitation system** - with token-based security and expiration
3. **Multi-family user support** - with context switching and default families
4. **Permission-based UI rendering** - showing/hiding features based on user roles
5. **Subscription limit enforcement** - preventing over-usage with graceful messaging
6. **Efficient dashboard queries** - optimized for common use cases
7. **Maintenance and monitoring** - keeping the system healthy and performant

The schema supports complex family structures while maintaining security and performance through RLS policies, materialized views, and optimized indexes.