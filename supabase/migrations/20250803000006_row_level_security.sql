-- FamilyHub Row Level Security Policies - Migration 6
-- This migration creates comprehensive RLS policies for all authentication tables
-- Ensures data access is properly restricted based on user roles and family membership

-- Enable RLS on all tables
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invitation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_auth_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_linking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_access_log ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is family admin
CREATE OR REPLACE FUNCTION public.is_family_admin(user_id UUID, family_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.user_id = user_id 
      AND fm.family_id = family_id 
      AND fm.is_family_admin = TRUE
      AND fm.deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is family member
CREATE OR REPLACE FUNCTION public.is_family_member(user_id UUID, family_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.user_id = user_id 
      AND fm.family_id = family_id 
      AND fm.deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's families
CREATE OR REPLACE FUNCTION public.get_user_families(user_id UUID)
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT fm.family_id 
    FROM public.family_members fm
    WHERE fm.user_id = user_id AND fm.deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user can manage another user (within same family and proper role hierarchy)
CREATE OR REPLACE FUNCTION public.can_manage_user(manager_id UUID, target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  manager_role user_role_type;
  target_role user_role_type;
  same_family BOOLEAN;
BEGIN
  -- Users can always manage themselves
  IF manager_id = target_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- Check if users are in the same family and get their roles
  SELECT 
    fm1.role, fm2.role,
    fm1.family_id = fm2.family_id
  INTO manager_role, target_role, same_family
  FROM public.family_members fm1, public.family_members fm2
  WHERE fm1.user_id = manager_id 
    AND fm2.user_id = target_user_id
    AND fm1.deleted_at IS NULL 
    AND fm2.deleted_at IS NULL
  LIMIT 1;
  
  -- Must be in same family
  IF NOT same_family THEN
    RETURN FALSE;
  END IF;
  
  -- Role hierarchy: admin > adult > teen > child
  -- Seniors can manage children but not other adults/teens
  CASE manager_role
    WHEN 'admin' THEN
      RETURN TRUE; -- Admins can manage everyone
    WHEN 'adult' THEN
      RETURN target_role IN ('teen', 'child'); -- Adults can manage teens and children
    WHEN 'senior' THEN
      RETURN target_role = 'child'; -- Seniors can manage children only
    ELSE
      RETURN FALSE; -- Teens and children cannot manage others
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FAMILIES TABLE RLS POLICIES
-- ============================================================================

-- Users can view families they belong to
CREATE POLICY "Users can view their families" ON public.families
  FOR SELECT USING (
    id = ANY(public.get_user_families(auth.uid()))
  );

-- Only family admins can create families (handled by application logic)
CREATE POLICY "Family admins can create families" ON public.families
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only family admins can update their families
CREATE POLICY "Family admins can update their families" ON public.families
  FOR UPDATE USING (
    public.is_family_admin(auth.uid(), id)
  );

-- Only family admins can delete their families
CREATE POLICY "Family admins can delete their families" ON public.families
  FOR DELETE USING (
    public.is_family_admin(auth.uid(), id)
  );

-- ============================================================================
-- FAMILY_MEMBERS TABLE RLS POLICIES
-- ============================================================================

-- Users can view family members in their families
CREATE POLICY "Users can view family members in their families" ON public.family_members
  FOR SELECT USING (
    family_id = ANY(public.get_user_families(auth.uid()))
  );

-- Family admins and the user themselves can insert family members
CREATE POLICY "Family admins can add family members" ON public.family_members
  FOR INSERT WITH CHECK (
    public.is_family_admin(auth.uid(), family_id) OR 
    user_id = auth.uid()
  );

-- Family admins and the user themselves can update family member records
CREATE POLICY "Family admins and users can update family members" ON public.family_members
  FOR UPDATE USING (
    public.is_family_admin(auth.uid(), family_id) OR 
    user_id = auth.uid()
  );

-- Only family admins can delete family members
CREATE POLICY "Family admins can remove family members" ON public.family_members
  FOR DELETE USING (
    public.is_family_admin(auth.uid(), family_id)
  );

-- ============================================================================
-- FAMILY_RELATIONSHIPS TABLE RLS POLICIES
-- ============================================================================

-- Users can view relationships in their families
CREATE POLICY "Users can view family relationships" ON public.family_relationships
  FOR SELECT USING (
    family_id = ANY(public.get_user_families(auth.uid()))
  );

-- Family admins can manage relationships
CREATE POLICY "Family admins can manage relationships" ON public.family_relationships
  FOR ALL USING (
    public.is_family_admin(auth.uid(), family_id)
  );

-- ============================================================================
-- USER_PROFILES TABLE RLS POLICIES
-- ============================================================================

-- Users can view their own profile and profiles of family members
CREATE POLICY "Users can view accessible profiles" ON public.user_profiles
  FOR SELECT USING (
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.family_members fm1, public.family_members fm2
      WHERE fm1.user_id = auth.uid() 
        AND fm2.user_id = id
        AND fm1.family_id = fm2.family_id
        AND fm1.deleted_at IS NULL 
        AND fm2.deleted_at IS NULL
    )
  );

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (id = auth.uid());

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ============================================================================
-- USER_SESSIONS TABLE RLS POLICIES
-- ============================================================================

-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions" ON public.user_sessions
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own sessions (handled by auth system)
CREATE POLICY "Users can create their own sessions" ON public.user_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own sessions
CREATE POLICY "Users can update their own sessions" ON public.user_sessions
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own sessions
CREATE POLICY "Users can delete their own sessions" ON public.user_sessions
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- USER_DEVICES TABLE RLS POLICIES
-- ============================================================================

-- Users can manage their own devices
CREATE POLICY "Users can manage their own devices" ON public.user_devices
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- SESSION_LIMITS TABLE RLS POLICIES
-- ============================================================================

-- Users can view limits that apply to them
CREATE POLICY "Users can view applicable session limits" ON public.session_limits
  FOR SELECT USING (
    user_id = auth.uid() OR
    (family_id IS NOT NULL AND public.is_family_member(auth.uid(), family_id))
  );

-- Family admins can manage family session limits
CREATE POLICY "Family admins can manage session limits" ON public.session_limits
  FOR ALL USING (
    (user_id = auth.uid()) OR
    (family_id IS NOT NULL AND public.is_family_admin(auth.uid(), family_id))
  );

-- ============================================================================
-- LOGIN_ATTEMPTS TABLE RLS POLICIES
-- ============================================================================

-- Users can view their own login attempts
CREATE POLICY "Users can view their own login attempts" ON public.login_attempts
  FOR SELECT USING (user_id = auth.uid());

-- System can insert login attempts (handled by triggers/functions)
CREATE POLICY "System can log login attempts" ON public.login_attempts
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- AUTH_TOKENS TABLE RLS POLICIES
-- ============================================================================

-- Users can view tokens addressed to them
CREATE POLICY "Users can view their own tokens" ON public.auth_tokens
  FOR SELECT USING (
    user_id = auth.uid() OR
    (user_id IS NULL AND email IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
    ))
  );

-- System and users can create tokens
CREATE POLICY "System can create auth tokens" ON public.auth_tokens
  FOR INSERT WITH CHECK (true);

-- Users can update tokens they own (for marking as used)
CREATE POLICY "Users can update their own tokens" ON public.auth_tokens
  FOR UPDATE USING (
    user_id = auth.uid() OR
    (user_id IS NULL AND email IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
    ))
  );

-- ============================================================================
-- PASSWORD_RESET_TOKENS TABLE RLS POLICIES
-- ============================================================================

-- Users can view their own password reset tokens
CREATE POLICY "Users can view their own reset tokens" ON public.password_reset_tokens
  FOR SELECT USING (user_id = auth.uid());

-- System can create reset tokens
CREATE POLICY "System can create reset tokens" ON public.password_reset_tokens
  FOR INSERT WITH CHECK (true);

-- Users can update their own reset tokens
CREATE POLICY "Users can update their own reset tokens" ON public.password_reset_tokens
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- EMAIL_VERIFICATION_TOKENS TABLE RLS POLICIES
-- ============================================================================

-- Users can view their own verification tokens
CREATE POLICY "Users can view their own verification tokens" ON public.email_verification_tokens
  FOR SELECT USING (user_id = auth.uid());

-- System can create verification tokens
CREATE POLICY "System can create verification tokens" ON public.email_verification_tokens
  FOR INSERT WITH CHECK (true);

-- Users can update their own verification tokens
CREATE POLICY "Users can update their own verification tokens" ON public.email_verification_tokens
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- FAMILY_INVITATION_TOKENS TABLE RLS POLICIES
-- ============================================================================

-- Family members can view invitations for their families
CREATE POLICY "Family members can view family invitations" ON public.family_invitation_tokens
  FOR SELECT USING (
    public.is_family_member(auth.uid(), family_id) OR
    invited_email IN (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Family admins can create invitations
CREATE POLICY "Family admins can create invitations" ON public.family_invitation_tokens
  FOR INSERT WITH CHECK (
    public.is_family_admin(auth.uid(), family_id)
  );

-- Family admins and invitees can update invitations
CREATE POLICY "Family admins and invitees can update invitations" ON public.family_invitation_tokens
  FOR UPDATE USING (
    public.is_family_admin(auth.uid(), family_id) OR
    invited_email IN (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ============================================================================
-- MFA_BACKUP_CODES TABLE RLS POLICIES
-- ============================================================================

-- Users can manage their own backup codes
CREATE POLICY "Users can manage their own backup codes" ON public.mfa_backup_codes
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- SOCIAL_AUTH_PROVIDERS TABLE RLS POLICIES
-- ============================================================================

-- Users can manage their own social auth providers
CREATE POLICY "Users can manage their own social providers" ON public.social_auth_providers
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- SOCIAL_LOGIN_ATTEMPTS TABLE RLS POLICIES
-- ============================================================================

-- Users can view their own social login attempts
CREATE POLICY "Users can view their own social login attempts" ON public.social_login_attempts
  FOR SELECT USING (user_id = auth.uid());

-- System can log social login attempts
CREATE POLICY "System can log social login attempts" ON public.social_login_attempts
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- ACCOUNT_LINKING_REQUESTS TABLE RLS POLICIES
-- ============================================================================

-- Users can manage their own account linking requests
CREATE POLICY "Users can manage their own linking requests" ON public.account_linking_requests
  FOR ALL USING (requesting_user_id = auth.uid());

-- ============================================================================
-- AUDIT LOG RLS POLICIES
-- ============================================================================

-- Users can view audit logs related to themselves or their families
CREATE POLICY "Users can view relevant audit logs" ON public.auth_audit_log
  FOR SELECT USING (
    actor_user_id = auth.uid() OR
    target_user_id = auth.uid() OR
    (target_family_id IS NOT NULL AND public.is_family_member(auth.uid(), target_family_id))
  );

-- System can insert audit logs
CREATE POLICY "System can create audit logs" ON public.auth_audit_log
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- SECURITY_INCIDENTS TABLE RLS POLICIES
-- ============================================================================

-- Users can view security incidents that affect them
CREATE POLICY "Users can view relevant security incidents" ON public.security_incidents
  FOR SELECT USING (
    auth.uid() = ANY(affected_user_ids) OR
    EXISTS (
      SELECT 1 FROM unnest(affected_family_ids) as family_id
      WHERE public.is_family_member(auth.uid(), family_id)
    )
  );

-- System can manage security incidents
CREATE POLICY "System can manage security incidents" ON public.security_incidents
  FOR ALL WITH CHECK (true);

-- ============================================================================
-- DATA_ACCESS_LOG RLS POLICIES
-- ============================================================================

-- Users can view their own data access logs
CREATE POLICY "Users can view their own data access logs" ON public.data_access_log
  FOR SELECT USING (
    user_id = auth.uid() OR
    (family_id IS NOT NULL AND public.is_family_member(auth.uid(), family_id))
  );

-- System can log data access
CREATE POLICY "System can log data access" ON public.data_access_log
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- SPECIAL POLICIES FOR SYSTEM OPERATIONS
-- ============================================================================

-- Create a service role for system operations (to be used by functions)
-- This would typically be set up in the Supabase dashboard or via SQL

-- Grant necessary permissions to service role for system operations
-- These would be granted to a specific service role in production

-- Comments for documentation
COMMENT ON FUNCTION public.is_family_admin IS 'Helper function to check if user is an admin of a specific family';
COMMENT ON FUNCTION public.is_family_member IS 'Helper function to check if user is a member of a specific family';
COMMENT ON FUNCTION public.get_user_families IS 'Helper function to get all family IDs for a user';
COMMENT ON FUNCTION public.can_manage_user IS 'Helper function to check if one user can manage another based on role hierarchy';

-- Create indexes on commonly used RLS filter columns for performance
CREATE INDEX IF NOT EXISTS idx_family_members_user_family_deleted 
ON public.family_members(user_id, family_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_family_members_family_admin 
ON public.family_members(family_id, is_family_admin) WHERE deleted_at IS NULL;