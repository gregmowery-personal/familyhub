-- Migration: Enhanced Family Invitations System
-- Date: 2025-08-12
-- Author: Elrond Half-elven, Lord of Rivendell, Keeper of Database Realms
-- Purpose: Implements Galadriel's vision for family member invitations with proper
--          token-based system, RLS policies, and helper functions

-- ============================================================================
-- MIGRATION UP - THE ENHANCEMENT OF INVITATION REALMS
-- ============================================================================

BEGIN;

-- ============================================================================
-- TYPE DEFINITIONS - THE INVITATION STATUS ENUM
-- ============================================================================

-- Create the invitation_status enum as specified by Galadriel
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- Create family_role_type enum for invitation roles (referencing existing role types)
CREATE TYPE family_role_type AS ENUM ('admin', 'caregiver', 'viewer', 'care_recipient', 'child', 'helper', 'emergency_contact');

-- ============================================================================
-- TABLE SCHEMA UPDATES - ALIGNING WITH GALADRIEL'S VISION
-- ============================================================================

-- Drop the existing family_invitations table to recreate with proper schema
DROP TABLE IF EXISTS family_invitations CASCADE;

-- Create the new family_invitations table as specified by Galadriel
CREATE TABLE family_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  inviter_id UUID NOT NULL, -- References auth.users(id) - the family member who sent the invitation
  email TEXT NOT NULL,
  role family_role_type NOT NULL,
  invitation_token UUID DEFAULT gen_random_uuid(),
  status invitation_status DEFAULT 'pending',
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  
  -- Additional helpful fields for invitation management
  personal_message TEXT,
  invitee_name TEXT, -- Optional name for the invitee
  reminder_sent_at TIMESTAMPTZ,
  
  -- Audit fields
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID, -- References auth.users(id)
  cancel_reason TEXT,
  
  UNIQUE(family_id, email) -- One active invitation per email per family
);

-- ============================================================================
-- PERFORMANCE INDEXES - FOR SWIFT ACCESS
-- ============================================================================

-- Indexes for efficient invitation queries
CREATE INDEX idx_family_invitations_family ON family_invitations(family_id);
CREATE INDEX idx_family_invitations_email ON family_invitations(email);
CREATE INDEX idx_family_invitations_token ON family_invitations(invitation_token);
CREATE INDEX idx_family_invitations_status ON family_invitations(status);
CREATE INDEX idx_family_invitations_expires ON family_invitations(expires_at) WHERE status = 'pending';
CREATE INDEX idx_family_invitations_inviter ON family_invitations(inviter_id);

-- Composite indexes for common query patterns
CREATE INDEX idx_family_invitations_family_status ON family_invitations(family_id, status);
CREATE INDEX idx_family_invitations_email_status ON family_invitations(email, status);

-- ============================================================================
-- HELPER FUNCTIONS - THE INVITATION MANAGEMENT WISDOM
-- ============================================================================

-- Function to create a family invitation with proper validation
CREATE OR REPLACE FUNCTION create_family_invitation(
  p_family_id UUID,
  p_inviter_id UUID,
  p_email TEXT,
  p_role family_role_type,
  p_personal_message TEXT DEFAULT NULL,
  p_invitee_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  invitation_id UUID;
  family_status VARCHAR(20);
  inviter_is_member BOOLEAN;
BEGIN
  -- Validate that the family exists and is active
  SELECT status INTO family_status FROM families WHERE id = p_family_id;
  IF family_status != 'active' THEN
    RAISE EXCEPTION 'Cannot create invitations for inactive family (status: %)', family_status;
  END IF;
  
  -- Validate that the inviter is an active family member with admin/caregiver privileges
  SELECT EXISTS (
    SELECT 1 FROM family_memberships fm
    JOIN roles r ON fm.role_id = r.id
    WHERE fm.family_id = p_family_id 
    AND fm.user_id = p_inviter_id 
    AND fm.status = 'active'
    AND r.type IN ('admin', 'caregiver')
  ) INTO inviter_is_member;
  
  IF NOT inviter_is_member THEN
    RAISE EXCEPTION 'Only family administrators and caregivers can create invitations';
  END IF;
  
  -- Check if the invitee is already a family member
  IF EXISTS (
    SELECT 1 FROM family_memberships fm
    JOIN auth.users u ON fm.user_id = u.id
    WHERE fm.family_id = p_family_id 
    AND u.email = p_email 
    AND fm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'User with email % is already a member of this family', p_email;
  END IF;
  
  -- Cancel any existing pending invitations for this email/family combination
  UPDATE family_invitations 
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancelled_by = p_inviter_id,
      cancel_reason = 'Replaced by new invitation'
  WHERE family_id = p_family_id 
  AND email = p_email 
  AND status = 'pending';
  
  -- Create the new invitation
  INSERT INTO family_invitations (
    family_id, inviter_id, email, role, personal_message, invitee_name
  ) VALUES (
    p_family_id, p_inviter_id, p_email, p_role, p_personal_message, p_invitee_name
  ) RETURNING id INTO invitation_id;
  
  RETURN invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept a family invitation
CREATE OR REPLACE FUNCTION accept_family_invitation(
  p_invitation_token UUID,
  p_user_id UUID DEFAULT NULL -- Can be null for token-based acceptance
) RETURNS UUID AS $$
DECLARE
  invitation_record RECORD;
  new_user_id UUID;
  membership_id UUID;
  role_id UUID;
BEGIN
  -- Get the invitation details
  SELECT * INTO invitation_record
  FROM family_invitations 
  WHERE invitation_token = p_invitation_token;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invitation token';
  END IF;
  
  -- Check invitation status and expiration
  IF invitation_record.status != 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer valid (status: %)', invitation_record.status;
  END IF;
  
  IF invitation_record.expires_at < NOW() THEN
    -- Auto-expire the invitation
    UPDATE family_invitations 
    SET status = 'expired' 
    WHERE id = invitation_record.id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;
  
  -- If no user_id provided, try to find user by email
  IF p_user_id IS NULL THEN
    SELECT id INTO new_user_id 
    FROM auth.users 
    WHERE email = invitation_record.email;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No user found with email %. Please create an account first.', invitation_record.email;
    END IF;
  ELSE
    new_user_id := p_user_id;
    
    -- Verify the user's email matches the invitation
    IF NOT EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = new_user_id AND email = invitation_record.email
    ) THEN
      RAISE EXCEPTION 'User email does not match invitation email';
    END IF;
  END IF;
  
  -- Check if user is already a family member
  IF EXISTS (
    SELECT 1 FROM family_memberships 
    WHERE family_id = invitation_record.family_id 
    AND user_id = new_user_id 
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'User is already a member of this family';
  END IF;
  
  -- Get the role ID for the invited role
  SELECT id INTO role_id 
  FROM roles 
  WHERE type = invitation_record.role::text 
  AND state = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid role: %', invitation_record.role;
  END IF;
  
  -- Add the user to the family
  INSERT INTO family_memberships (
    family_id, 
    user_id, 
    role_id, 
    invited_by, 
    display_name,
    status
  ) VALUES (
    invitation_record.family_id,
    new_user_id,
    role_id,
    invitation_record.inviter_id,
    invitation_record.invitee_name,
    'active'
  ) RETURNING id INTO membership_id;
  
  -- Mark the invitation as accepted
  UPDATE family_invitations 
  SET status = 'accepted',
      accepted_at = NOW()
  WHERE id = invitation_record.id;
  
  RETURN membership_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel a family invitation
CREATE OR REPLACE FUNCTION cancel_family_invitation(
  p_invitation_id UUID,
  p_cancelled_by UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Get the invitation details
  SELECT * INTO invitation_record
  FROM family_invitations 
  WHERE id = p_invitation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  
  -- Only allow cancellation if pending
  IF invitation_record.status != 'pending' THEN
    RAISE EXCEPTION 'Cannot cancel invitation with status: %', invitation_record.status;
  END IF;
  
  -- Verify the canceller has permission (inviter or family admin/caregiver)
  IF NOT (
    invitation_record.inviter_id = p_cancelled_by OR
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = invitation_record.family_id 
      AND fm.user_id = p_cancelled_by 
      AND fm.status = 'active'
      AND r.type IN ('admin', 'caregiver')
    )
  ) THEN
    RAISE EXCEPTION 'Only the inviter or family administrators can cancel invitations';
  END IF;
  
  -- Cancel the invitation
  UPDATE family_invitations 
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancelled_by = p_cancelled_by,
      cancel_reason = COALESCE(p_reason, 'Cancelled by user')
  WHERE id = p_invitation_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations() RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE family_invitations 
  SET status = 'expired'
  WHERE status = 'pending' 
  AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get invitation details by token (for display before acceptance)
CREATE OR REPLACE FUNCTION get_invitation_details(p_invitation_token UUID)
RETURNS TABLE (
  family_name TEXT,
  inviter_name TEXT,
  invited_role TEXT,
  personal_message TEXT,
  expires_at TIMESTAMPTZ,
  is_valid BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.name as family_name,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) as inviter_name,
    fi.role::text as invited_role,
    fi.personal_message,
    fi.expires_at,
    (fi.status = 'pending' AND fi.expires_at > NOW()) as is_valid
  FROM family_invitations fi
  JOIN families f ON fi.family_id = f.id
  JOIN auth.users u ON fi.inviter_id = u.id
  WHERE fi.invitation_token = p_invitation_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS - THE AUTOMATIC GUARDIANS
-- ============================================================================

-- Function for updating timestamps
CREATE OR REPLACE FUNCTION update_family_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.created_at = COALESCE(NEW.created_at, OLD.created_at);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES - THE SHIELDS OF RIVENDELL
-- ============================================================================

-- Enable RLS on family_invitations
ALTER TABLE family_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Family admins and caregivers can create and manage invitations
CREATE POLICY "family_invitations_admin_policy" ON family_invitations 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM family_memberships fm
      JOIN roles r ON fm.role_id = r.id
      WHERE fm.family_id = family_id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
      AND r.type IN ('admin', 'caregiver')
    )
  );

-- Policy: Invited users can view invitations sent to their email (token-based access)
CREATE POLICY "family_invitations_invited_policy" ON family_invitations 
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR 
    -- Allow access via invitation token (for unauthenticated users)
    invitation_token IS NOT NULL
  );

-- Policy: Family members can view all invitations for their family
CREATE POLICY "family_invitations_family_view_policy" ON family_invitations 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM family_memberships fm
      WHERE fm.family_id = family_id 
      AND fm.user_id = auth.uid() 
      AND fm.status = 'active'
    )
  );

-- Policy: Allow invitation acceptance through function calls
-- (The functions handle their own validation)

-- ============================================================================
-- UTILITY FUNCTIONS FOR INVITATION MANAGEMENT
-- ============================================================================

-- Function to get pending invitations for a family
CREATE OR REPLACE FUNCTION get_family_pending_invitations(p_family_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  role family_role_type,
  inviter_name TEXT,
  personal_message TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fi.id,
    fi.email,
    fi.role,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) as inviter_name,
    fi.personal_message,
    fi.expires_at,
    fi.created_at
  FROM family_invitations fi
  JOIN auth.users u ON fi.inviter_id = u.id
  WHERE fi.family_id = p_family_id 
  AND fi.status = 'pending'
  AND fi.expires_at > NOW()
  ORDER BY fi.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send reminder emails (to be called by external processes)
CREATE OR REPLACE FUNCTION mark_invitation_reminder_sent(p_invitation_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE family_invitations 
  SET reminder_sent_at = NOW()
  WHERE id = p_invitation_id 
  AND status = 'pending';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SCHEDULED CLEANUP - AUTOMATIC MAINTENANCE
-- ============================================================================

-- Function that can be called periodically to clean up expired invitations
-- This should be called by a cron job or scheduled task
CREATE OR REPLACE FUNCTION cleanup_expired_invitations() RETURNS TABLE (
  expired_count INTEGER,
  deleted_count INTEGER
) AS $$
DECLARE
  expired_cnt INTEGER;
  deleted_cnt INTEGER;
BEGIN
  -- Mark expired invitations
  UPDATE family_invitations 
  SET status = 'expired'
  WHERE status = 'pending' 
  AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_cnt = ROW_COUNT;
  
  -- Delete old expired invitations (older than 30 days)
  DELETE FROM family_invitations 
  WHERE status = 'expired' 
  AND expires_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_cnt = ROW_COUNT;
  
  RETURN QUERY SELECT expired_cnt, deleted_cnt;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================================================
-- EXAMPLE USAGE QUERIES
-- ============================================================================

-- Example: Create an invitation
-- SELECT create_family_invitation(
--   '<family-id>',
--   '<inviter-user-id>',
--   'new-member@example.com',
--   'caregiver',
--   'Welcome to our family coordination system!',
--   'John Doe'
-- );

-- Example: Accept an invitation
-- SELECT accept_family_invitation('<invitation-token>', '<user-id>');

-- Example: Get invitation details for display
-- SELECT * FROM get_invitation_details('<invitation-token>');

-- Example: Get pending invitations for a family
-- SELECT * FROM get_family_pending_invitations('<family-id>');

-- Example: Clean up expired invitations
-- SELECT * FROM cleanup_expired_invitations();

-- ============================================================================
-- MIGRATION DOWN (Rollback)
-- ============================================================================
-- Uncomment and run the following to rollback this migration:

-- BEGIN;
-- 
-- -- Drop all functions
-- DROP FUNCTION IF EXISTS create_family_invitation(UUID, UUID, TEXT, family_role_type, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS accept_family_invitation(UUID, UUID);
-- DROP FUNCTION IF EXISTS cancel_family_invitation(UUID, UUID, TEXT);
-- DROP FUNCTION IF EXISTS expire_old_invitations();
-- DROP FUNCTION IF EXISTS get_invitation_details(UUID);
-- DROP FUNCTION IF EXISTS get_family_pending_invitations(UUID);
-- DROP FUNCTION IF EXISTS mark_invitation_reminder_sent(UUID);
-- DROP FUNCTION IF EXISTS cleanup_expired_invitations();
-- DROP FUNCTION IF EXISTS update_family_invitations_updated_at();
-- 
-- -- Drop table
-- DROP TABLE IF EXISTS family_invitations CASCADE;
-- 
-- -- Drop types
-- DROP TYPE IF EXISTS invitation_status CASCADE;
-- DROP TYPE IF EXISTS family_role_type CASCADE;
-- 
-- COMMIT;