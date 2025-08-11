-- Migration: Family Groups and Subscription Management Schema
-- Date: 2025-08-06
-- Author: Elrond Half-elven, Lord of Rivendell, Keeper of Database Realms
-- Purpose: Implements comprehensive Family Groups system with subscription tiers,
--          family memberships, and multi-family user support with RLS policies

-- ============================================================================
-- MIGRATION UP - THE FORGING OF FAMILY REALMS
-- ============================================================================

BEGIN;

-- Create required extensions (if not already created)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SUBSCRIPTION TIERS - THE FOUNDATION OF FAMILY REALMS
-- ============================================================================

-- Define subscription tiers with features and limits
CREATE TABLE subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Pricing
  monthly_price_cents INTEGER DEFAULT 0, -- 0 for free tier
  yearly_price_cents INTEGER DEFAULT 0,
  
  -- Limits and features
  max_family_members INTEGER NOT NULL DEFAULT 5,
  max_storage_gb INTEGER NOT NULL DEFAULT 1,
  max_documents INTEGER NOT NULL DEFAULT 50,
  max_families_per_user INTEGER NOT NULL DEFAULT 1,
  
  -- Feature flags
  features JSONB NOT NULL DEFAULT '{}', -- Flexible feature flag system
  
  -- Billing configuration
  stripe_price_id_monthly VARCHAR(100),
  stripe_price_id_yearly VARCHAR(100),
  billing_interval VARCHAR(20) CHECK (billing_interval IN ('monthly', 'yearly', 'one_time', 'free')),
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- FAMILIES - THE HEART OF OUR REALM
-- ============================================================================

-- Main families table
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  display_name VARCHAR(200), -- Optional friendly display name
  
  -- Subscription management
  subscription_tier_id UUID REFERENCES subscription_tiers(id) NOT NULL,
  subscription_status VARCHAR(30) NOT NULL DEFAULT 'active' 
    CHECK (subscription_status IN ('active', 'trial', 'past_due', 'cancelled', 'suspended')),
  
  -- Billing information
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  subscription_start_date TIMESTAMP WITH TIME ZONE,
  subscription_end_date TIMESTAMP WITH TIME ZONE,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  
  -- Family configuration
  timezone VARCHAR(50) DEFAULT 'UTC',
  locale VARCHAR(10) DEFAULT 'en',
  family_settings JSONB DEFAULT '{}', -- Flexible family preferences
  
  -- Privacy and sharing settings
  is_public BOOLEAN DEFAULT false,
  invite_code VARCHAR(20) UNIQUE, -- For family invitations
  invite_code_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Status and lifecycle
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'suspended', 'archived', 'deleted')),
  
  -- Metadata
  created_by UUID, -- References auth.users(id) - the family founder
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by UUID -- References auth.users(id)
);

-- ============================================================================
-- FAMILY MEMBERSHIPS - THE BONDS THAT BIND
-- ============================================================================

-- Family membership table - connects users to families with roles
CREATE TABLE family_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL, -- References auth.users(id)
  
  -- Role assignment within this family
  role_id UUID REFERENCES roles(id) NOT NULL,
  
  -- Membership metadata
  display_name VARCHAR(200), -- How they appear in this family
  relationship VARCHAR(50), -- 'parent', 'child', 'grandparent', 'caregiver', etc.
  
  -- Invitation and joining process
  invited_by UUID, -- References auth.users(id)
  invited_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  invitation_token VARCHAR(100) UNIQUE, -- For pending invitations
  invitation_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Status and permissions within family
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('pending', 'active', 'suspended', 'removed')),
  
  -- Family-specific permissions and settings
  permissions_override JSONB DEFAULT '{}', -- Family-specific permission overrides
  notification_preferences JSONB DEFAULT '{}', -- How they want to be notified
  
  -- Default family setting (for users with multiple families)
  is_default_family BOOLEAN DEFAULT false,
  
  -- Time bounds for temporary members (helpers, emergency contacts)
  access_valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  access_valid_until TIMESTAMP WITH TIME ZONE,
  
  -- Lifecycle tracking
  removed_at TIMESTAMP WITH TIME ZONE,
  removed_by UUID, -- References auth.users(id)
  remove_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(family_id, user_id), -- One membership per user per family
  CONSTRAINT valid_access_timeframe CHECK (access_valid_until IS NULL OR access_valid_until > access_valid_from)
);

-- ============================================================================
-- FAMILY INVITATIONS - THE SUMMONING OF NEW MEMBERS
-- ============================================================================

-- Separate table for tracking family invitations
CREATE TABLE family_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  
  -- Invitation details
  invited_email VARCHAR(255) NOT NULL,
  invited_role_id UUID REFERENCES roles(id) NOT NULL,
  invited_by UUID NOT NULL, -- References auth.users(id)
  
  -- Invitation configuration
  invitation_token VARCHAR(100) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Optional invitation customization
  personal_message TEXT,
  suggested_display_name VARCHAR(200),
  suggested_relationship VARCHAR(50),
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  
  -- Response tracking
  responded_at TIMESTAMP WITH TIME ZONE,
  response_note TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(family_id, invited_email, status) 
    DEFERRABLE INITIALLY DEFERRED -- Allow multiple invites if previous ones are resolved
);

-- ============================================================================
-- USER PREFERENCES - CROSS-FAMILY SETTINGS
-- ============================================================================

-- User preferences that span across families
CREATE TABLE user_family_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- References auth.users(id)
  
  -- Default family for login/dashboard
  default_family_id UUID REFERENCES families(id),
  
  -- Global notification preferences
  email_notifications_enabled BOOLEAN DEFAULT true,
  sms_notifications_enabled BOOLEAN DEFAULT false,
  push_notifications_enabled BOOLEAN DEFAULT true,
  
  -- UI preferences
  preferred_timezone VARCHAR(50),
  preferred_locale VARCHAR(10) DEFAULT 'en',
  ui_theme VARCHAR(20) DEFAULT 'auto' CHECK (ui_theme IN ('light', 'dark', 'auto')),
  
  -- Accessibility preferences
  accessibility_settings JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id)
);

-- ============================================================================
-- STORED PROCEDURES AND FUNCTIONS
-- ============================================================================

-- Function to automatically update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_family_tables()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate secure family invite codes
CREATE OR REPLACE FUNCTION generate_family_invite_code() 
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  attempts INTEGER := 0;
BEGIN
  LOOP
    -- Generate a 12-character code with letters and numbers (no ambiguous chars)
    code := array_to_string(
      ARRAY(
        SELECT substring('ABCDEFGHJKLMNPQRSTUVWXYZ23456789' 
               FROM (random() * 31)::int + 1 FOR 1)
        FROM generate_series(1, 12)
      ), 
      ''
    );
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM families WHERE invite_code = code) THEN
      RETURN code;
    END IF;
    
    -- Prevent infinite loops
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique invite code after 100 attempts';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to validate family subscription limits
CREATE OR REPLACE FUNCTION validate_family_limits(family_uuid UUID) 
RETURNS BOOLEAN AS $$
DECLARE
  tier_limits RECORD;
  current_members INTEGER;
BEGIN
  -- Get the subscription tier limits
  SELECT st.max_family_members
  INTO tier_limits
  FROM families f
  JOIN subscription_tiers st ON f.subscription_tier_id = st.id
  WHERE f.id = family_uuid;
  
  -- Count current active members
  SELECT COUNT(*)
  INTO current_members
  FROM family_memberships
  WHERE family_id = family_uuid 
    AND status = 'active';
  
  -- Return true if within limits
  RETURN current_members <= tier_limits.max_family_members;
END;
$$ LANGUAGE plpgsql;

-- Function to safely add a user to a family with validation
CREATE OR REPLACE FUNCTION add_family_member(
  p_family_id UUID,
  p_user_id UUID,
  p_role_id UUID,
  p_invited_by UUID DEFAULT NULL,
  p_display_name VARCHAR(200) DEFAULT NULL,
  p_relationship VARCHAR(50) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  membership_id UUID;
  family_status VARCHAR(20);
BEGIN
  -- Check if family is active
  SELECT status INTO family_status FROM families WHERE id = p_family_id;
  IF family_status != 'active' THEN
    RAISE EXCEPTION 'Cannot add members to inactive family';
  END IF;
  
  -- Validate subscription limits
  IF NOT validate_family_limits(p_family_id) THEN
    RAISE EXCEPTION 'Family has reached maximum member limit for current subscription tier';
  END IF;
  
  -- Create the membership
  INSERT INTO family_memberships (
    family_id, user_id, role_id, invited_by, display_name, relationship
  ) VALUES (
    p_family_id, p_user_id, p_role_id, p_invited_by, p_display_name, p_relationship
  ) RETURNING id INTO membership_id;
  
  -- If this is the user's first family, make it their default
  IF NOT EXISTS (SELECT 1 FROM user_family_preferences WHERE user_id = p_user_id) THEN
    INSERT INTO user_family_preferences (user_id, default_family_id)
    VALUES (p_user_id, p_family_id);
  END IF;
  
  RETURN membership_id;
END;
$$ LANGUAGE plpgsql;

-- Function to set a user's default family
CREATE OR REPLACE FUNCTION set_default_family(p_user_id UUID, p_family_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Verify user is a member of the family
  IF NOT EXISTS (
    SELECT 1 FROM family_memberships 
    WHERE user_id = p_user_id AND family_id = p_family_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'User is not an active member of the specified family';
  END IF;
  
  -- Update user preferences
  INSERT INTO user_family_preferences (user_id, default_family_id)
  VALUES (p_user_id, p_family_id)
  ON CONFLICT (user_id) DO UPDATE SET
    default_family_id = EXCLUDED.default_family_id,
    updated_at = CURRENT_TIMESTAMP;
  
  -- Update the is_default_family flags
  UPDATE family_memberships 
  SET is_default_family = (family_id = p_family_id),
      updated_at = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update timestamps
CREATE TRIGGER update_subscription_tiers_updated_at
  BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_family_tables();

CREATE TRIGGER update_families_updated_at
  BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_family_tables();

CREATE TRIGGER update_family_memberships_updated_at
  BEFORE UPDATE ON family_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_family_tables();

CREATE TRIGGER update_family_invitations_updated_at
  BEFORE UPDATE ON family_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_family_tables();

CREATE TRIGGER update_user_family_preferences_updated_at
  BEFORE UPDATE ON user_family_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_family_tables();

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Subscription tiers indexes
CREATE INDEX idx_subscription_tiers_active ON subscription_tiers(is_active, sort_order);

-- Families indexes
CREATE INDEX idx_families_status ON families(status);
CREATE INDEX idx_families_subscription ON families(subscription_tier_id, subscription_status);
CREATE INDEX idx_families_created_by ON families(created_by);
CREATE INDEX idx_families_invite_code ON families(invite_code) WHERE invite_code IS NOT NULL;

-- Family memberships indexes (critical for performance)
CREATE INDEX idx_family_memberships_user_active ON family_memberships(user_id, status) WHERE status = 'active';
CREATE INDEX idx_family_memberships_family_active ON family_memberships(family_id, status) WHERE status = 'active';
CREATE INDEX idx_family_memberships_role ON family_memberships(role_id);
CREATE INDEX idx_family_memberships_default ON family_memberships(user_id, is_default_family) WHERE is_default_family = true;
CREATE INDEX idx_family_memberships_invited_by ON family_memberships(invited_by);

-- Family invitations indexes
CREATE INDEX idx_family_invitations_email_status ON family_invitations(invited_email, status);
CREATE INDEX idx_family_invitations_token ON family_invitations(invitation_token);
CREATE INDEX idx_family_invitations_family ON family_invitations(family_id, status);
CREATE INDEX idx_family_invitations_expires ON family_invitations(expires_at) WHERE status = 'pending';

-- User preferences indexes
CREATE INDEX idx_user_family_preferences_default ON user_family_preferences(default_family_id);

-- ============================================================================
-- MATERIALIZED VIEW FOR FAMILY ACCESS CONTROL
-- ============================================================================

-- Materialized view for efficient family access queries
CREATE MATERIALIZED VIEW user_family_access AS
SELECT 
  fm.user_id,
  fm.family_id,
  f.name as family_name,
  f.status as family_status,
  fm.role_id,
  r.type as role_type,
  r.priority as role_priority,
  fm.status as membership_status,
  fm.is_default_family,
  fm.access_valid_from,
  fm.access_valid_until,
  st.name as subscription_tier,
  st.features as tier_features,
  f.subscription_status,
  CASE 
    WHEN fm.access_valid_until IS NOT NULL AND fm.access_valid_until < CURRENT_TIMESTAMP 
    THEN false
    ELSE true 
  END as access_currently_valid
FROM family_memberships fm
JOIN families f ON fm.family_id = f.id
JOIN roles r ON fm.role_id = r.id
JOIN subscription_tiers st ON f.subscription_tier_id = st.id
WHERE fm.status = 'active' 
  AND f.status = 'active'
  AND r.state = 'active';

-- Index for the materialized view
CREATE UNIQUE INDEX idx_user_family_access_unique ON user_family_access(user_id, family_id);
CREATE INDEX idx_user_family_access_user ON user_family_access(user_id);
CREATE INDEX idx_user_family_access_family ON user_family_access(family_id);
CREATE INDEX idx_user_family_access_valid ON user_family_access(user_id, access_currently_valid);

-- Function to refresh the family access materialized view
CREATE OR REPLACE FUNCTION refresh_user_family_access() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_family_access;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all family tables
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_family_preferences ENABLE ROW LEVEL SECURITY;

-- Subscription tiers - readable by all authenticated users
CREATE POLICY "subscription_tiers_read_policy" ON subscription_tiers 
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- Only system admins can manage subscription tiers
CREATE POLICY "subscription_tiers_admin_policy" ON subscription_tiers 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      WHERE ur.user_id = auth.uid() 
      AND r.type = 'system_admin' 
      AND ur.state = 'active'
    )
  );

-- Families - users can see families they belong to
CREATE POLICY "families_member_policy" ON families 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM family_memberships fm
      WHERE fm.family_id = families.id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

-- Family coordinators and system admins can modify family settings
CREATE POLICY "families_coordinator_policy" ON families 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = families.id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
    )
  );

-- Users can create new families (will become family_coordinator)
CREATE POLICY "families_create_policy" ON families 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Family memberships - users can see memberships for families they belong to
CREATE POLICY "family_memberships_family_policy" ON family_memberships 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM family_memberships fm2
      WHERE fm2.family_id = family_id 
      AND fm2.user_id = auth.uid() 
      AND fm2.status = 'active'
    )
  );

-- Users can always see their own memberships
CREATE POLICY "family_memberships_self_policy" ON family_memberships 
  FOR SELECT USING (user_id = auth.uid());

-- Family coordinators can manage memberships
CREATE POLICY "family_memberships_coordinator_policy" ON family_memberships 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
    )
  );

-- Family invitations - family coordinators can manage them
CREATE POLICY "family_invitations_coordinator_policy" ON family_invitations 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('family_coordinator', 'system_admin')
    )
  );

-- Invited users can view invitations sent to their email
CREATE POLICY "family_invitations_invited_policy" ON family_invitations 
  FOR SELECT USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pending'
  );

-- User preferences - users can only access their own preferences
CREATE POLICY "user_family_preferences_self_policy" ON user_family_preferences 
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- SEED DATA - SUBSCRIPTION TIERS
-- ============================================================================

-- Insert default subscription tiers
INSERT INTO subscription_tiers (name, display_name, description, monthly_price_cents, yearly_price_cents, max_family_members, max_storage_gb, max_documents, max_families_per_user, features, billing_interval, sort_order) VALUES
  ('free', 'Free', 'Perfect for small families getting started', 0, 0, 3, 1, 25, 1, 
   '{"basic_calendar": true, "basic_tasks": true, "email_support": true}', 'free', 1),
   
  ('standard', 'Standard', 'Great for most families with growing coordination needs', 999, 9990, 8, 5, 100, 2, 
   '{"basic_calendar": true, "basic_tasks": true, "email_support": true, "advanced_scheduling": true, "document_storage": true, "phone_support": true}', 'monthly', 2),
   
  ('premium', 'Premium', 'Perfect for larger families and complex coordination', 1999, 19990, 15, 25, 500, 5, 
   '{"basic_calendar": true, "basic_tasks": true, "email_support": true, "advanced_scheduling": true, "document_storage": true, "phone_support": true, "ai_assistance": true, "priority_support": true, "custom_integrations": true}', 'monthly', 3);

-- Initial refresh of materialized view
SELECT refresh_user_family_access();

COMMIT;

-- ============================================================================
-- MIGRATION DOWN (Rollback)
-- ============================================================================
-- Uncomment and run the following to rollback this migration:

-- BEGIN;
-- 
-- -- Drop materialized view
-- DROP MATERIALIZED VIEW IF EXISTS user_family_access CASCADE;
-- 
-- -- Drop RLS policies
-- DROP POLICY IF EXISTS "subscription_tiers_read_policy" ON subscription_tiers;
-- DROP POLICY IF EXISTS "subscription_tiers_admin_policy" ON subscription_tiers;
-- DROP POLICY IF EXISTS "families_member_policy" ON families;
-- DROP POLICY IF EXISTS "families_coordinator_policy" ON families;
-- DROP POLICY IF EXISTS "families_create_policy" ON families;
-- DROP POLICY IF EXISTS "family_memberships_family_policy" ON family_memberships;
-- DROP POLICY IF EXISTS "family_memberships_self_policy" ON family_memberships;
-- DROP POLICY IF EXISTS "family_memberships_coordinator_policy" ON family_memberships;
-- DROP POLICY IF EXISTS "family_invitations_coordinator_policy" ON family_invitations;
-- DROP POLICY IF EXISTS "family_invitations_invited_policy" ON family_invitations;
-- DROP POLICY IF EXISTS "user_family_preferences_self_policy" ON user_family_preferences;
-- 
-- -- Drop triggers
-- DROP TRIGGER IF EXISTS update_subscription_tiers_updated_at ON subscription_tiers;
-- DROP TRIGGER IF EXISTS update_families_updated_at ON families;
-- DROP TRIGGER IF EXISTS update_family_memberships_updated_at ON family_memberships;
-- DROP TRIGGER IF EXISTS update_family_invitations_updated_at ON family_invitations;
-- DROP TRIGGER IF EXISTS update_user_family_preferences_updated_at ON user_family_preferences;
-- 
-- -- Drop functions
-- DROP FUNCTION IF EXISTS update_updated_at_family_tables();
-- DROP FUNCTION IF EXISTS generate_family_invite_code();
-- DROP FUNCTION IF EXISTS validate_family_limits(UUID);
-- DROP FUNCTION IF EXISTS add_family_member(UUID, UUID, UUID, UUID, VARCHAR(200), VARCHAR(50));
-- DROP FUNCTION IF EXISTS set_default_family(UUID, UUID);
-- DROP FUNCTION IF EXISTS refresh_user_family_access();
-- 
-- -- Drop tables in dependency order
-- DROP TABLE IF EXISTS user_family_preferences CASCADE;
-- DROP TABLE IF EXISTS family_invitations CASCADE;
-- DROP TABLE IF EXISTS family_memberships CASCADE;
-- DROP TABLE IF EXISTS families CASCADE;
-- DROP TABLE IF EXISTS subscription_tiers CASCADE;
-- 
-- COMMIT;

-- ============================================================================
-- EXAMPLE QUERIES FOR COMMON OPERATIONS
-- ============================================================================

-- Find all families a user belongs to:
-- SELECT f.*, fm.role_id, r.type as role_type, fm.is_default_family
-- FROM families f
-- JOIN family_memberships fm ON f.id = fm.family_id
-- JOIN roles r ON fm.role_id = r.id
-- WHERE fm.user_id = $1 AND fm.status = 'active' AND f.status = 'active';

-- Get a user's default family:
-- SELECT f.* FROM families f
-- JOIN user_family_preferences ufp ON f.id = ufp.default_family_id
-- WHERE ufp.user_id = $1;

-- Check if user can access a specific family:
-- SELECT EXISTS (
--   SELECT 1 FROM user_family_access ufa
--   WHERE ufa.user_id = $1 AND ufa.family_id = $2 AND ufa.access_currently_valid = true
-- );

-- Get all active members of a family with their roles:
-- SELECT u.email, fm.display_name, fm.relationship, r.name as role_name
-- FROM family_memberships fm
-- JOIN auth.users u ON fm.user_id = u.id
-- JOIN roles r ON fm.role_id = r.id
-- WHERE fm.family_id = $1 AND fm.status = 'active'
-- ORDER BY r.priority DESC, fm.joined_at;

-- Get family subscription status and limits:
-- SELECT f.name, f.subscription_status, st.display_name as tier,
--        st.max_family_members, st.max_storage_gb, st.features,
--        COUNT(fm.id) as current_members
-- FROM families f
-- JOIN subscription_tiers st ON f.subscription_tier_id = st.id
-- LEFT JOIN family_memberships fm ON f.id = fm.family_id AND fm.status = 'active'
-- WHERE f.id = $1
-- GROUP BY f.id, st.id;