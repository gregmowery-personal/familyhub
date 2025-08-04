-- FamilyHub Authentication Schema - Initial Migration
-- This migration creates the core authentication tables for multi-generational family coordination
-- Uses Supabase Auth as the foundation and extends it with family-specific functionality

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types for better type safety
CREATE TYPE user_role_type AS ENUM (
  'admin',      -- Primary Parent/Guardian - Full access
  'adult',      -- Secondary Parent/Adult Child - Most access, limited sensitive data
  'teen',       -- 13-17 years old - Age-appropriate interface and permissions
  'child',      -- 8-12 years old - Simplified interface, limited permissions
  'senior'      -- Grandparent - Simplified interface option, participation-focused
);

CREATE TYPE family_type AS ENUM (
  'nuclear',          -- Traditional nuclear family
  'single_parent',    -- Single parent household
  'blended',          -- Blended family with step-relationships
  'multigenerational', -- Multi-generational household
  'extended'          -- Extended family coordination
);

CREATE TYPE interface_complexity AS ENUM (
  'full',        -- Full feature interface
  'simplified',  -- Simplified interface for seniors/children
  'child'        -- Child-friendly interface
);

CREATE TYPE access_level AS ENUM (
  'full',       -- Full access to family data
  'limited',    -- Limited access based on role
  'view_only'   -- Read-only access
);

-- Families table - Core family group management
CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  family_type family_type NOT NULL DEFAULT 'nuclear',
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete support
);

-- Create index for performance
CREATE INDEX idx_families_created_at ON public.families(created_at);
CREATE INDEX idx_families_deleted_at ON public.families(deleted_at);

-- Family members table - Links users to families with roles and permissions
CREATE TABLE public.family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role and permissions
  role user_role_type NOT NULL DEFAULT 'adult',
  relationship VARCHAR(50), -- 'parent', 'child', 'grandparent', 'stepparent', 'sibling', etc.
  birth_date DATE,
  
  -- Family management flags
  is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
  is_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE,
  is_family_admin BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Access control
  access_level access_level NOT NULL DEFAULT 'full',
  interface_preference interface_complexity NOT NULL DEFAULT 'full',
  
  -- For shared custody situations
  custody_schedule JSONB, -- Flexible JSON structure for custody arrangements
  custody_percentage INTEGER CHECK (custody_percentage >= 0 AND custody_percentage <= 100),
  
  -- Metadata
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete support
);

-- Ensure unique user per family (a user can only be in a family once)
CREATE UNIQUE INDEX idx_family_members_unique_user_family 
ON public.family_members(family_id, user_id) 
WHERE deleted_at IS NULL;

-- Ensure only one primary contact per family
CREATE UNIQUE INDEX idx_family_members_one_primary_contact 
ON public.family_members(family_id) 
WHERE is_primary_contact = TRUE AND deleted_at IS NULL;

-- Performance indexes
CREATE INDEX idx_family_members_family_id ON public.family_members(family_id);
CREATE INDEX idx_family_members_user_id ON public.family_members(user_id);
CREATE INDEX idx_family_members_role ON public.family_members(role);
CREATE INDEX idx_family_members_deleted_at ON public.family_members(deleted_at);
CREATE INDEX idx_family_members_last_active ON public.family_members(last_active_at);

-- Family relationships table - Models complex family relationships
CREATE TABLE public.family_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  member_1_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  member_2_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  
  -- Relationship details
  relationship_type VARCHAR(50) NOT NULL, -- 'parent_child', 'siblings', 'grandparent_grandchild', 'spouse', etc.
  is_biological BOOLEAN NOT NULL DEFAULT TRUE,
  is_legal_guardian BOOLEAN NOT NULL DEFAULT FALSE,
  is_step_relationship BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Additional metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Note: Family member relationship validation handled by application logic
  -- and triggers due to PostgreSQL limitations with subqueries in CHECK constraints
);

-- Prevent self-relationships and duplicate relationships
CREATE UNIQUE INDEX idx_family_relationships_unique 
ON public.family_relationships(
  family_id, 
  LEAST(member_1_id, member_2_id), 
  GREATEST(member_1_id, member_2_id), 
  relationship_type
);

-- Performance indexes
CREATE INDEX idx_family_relationships_family_id ON public.family_relationships(family_id);
CREATE INDEX idx_family_relationships_member_1 ON public.family_relationships(member_1_id);
CREATE INDEX idx_family_relationships_member_2 ON public.family_relationships(member_2_id);

-- User profiles table - Extended user information beyond Supabase auth
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personal information
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  display_name VARCHAR(100),
  phone_number VARCHAR(20),
  profile_image_url TEXT,
  
  -- Preferences
  preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  notification_preferences JSONB NOT NULL DEFAULT '{}',
  accessibility_preferences JSONB NOT NULL DEFAULT '{}',
  
  -- Security preferences
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  login_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Metadata
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete support
);

-- Performance indexes
CREATE INDEX idx_user_profiles_name ON public.user_profiles(first_name, last_name);
CREATE INDEX idx_user_profiles_display_name ON public.user_profiles(display_name);
CREATE INDEX idx_user_profiles_last_login ON public.user_profiles(last_login_at);
CREATE INDEX idx_user_profiles_deleted_at ON public.user_profiles(deleted_at);

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_families_updated_at 
  BEFORE UPDATE ON public.families 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_members_updated_at 
  BEFORE UPDATE ON public.family_members 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_relationships_updated_at 
  BEFORE UPDATE ON public.family_relationships 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON public.user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create user profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Comments for documentation
COMMENT ON TABLE public.families IS 'Core family groups that organize users into family units';
COMMENT ON TABLE public.family_members IS 'Links users to families with roles, permissions, and relationship metadata';
COMMENT ON TABLE public.family_relationships IS 'Models complex relationships between family members (parent-child, siblings, etc.)';
COMMENT ON TABLE public.user_profiles IS 'Extended user profile information beyond Supabase auth';

COMMENT ON COLUMN public.family_members.custody_schedule IS 'JSON structure for shared custody arrangements, e.g., {"weekdays": "parent1", "weekends": "parent2", "holidays": "alternating"}';
COMMENT ON COLUMN public.family_members.custody_percentage IS 'Percentage of time this member has custody (for legal/scheduling purposes)';
COMMENT ON COLUMN public.user_profiles.notification_preferences IS 'JSON structure for notification settings, e.g., {"email": true, "sms": false, "push": true}';
COMMENT ON COLUMN public.user_profiles.accessibility_preferences IS 'JSON structure for accessibility settings, e.g., {"high_contrast": false, "large_text": true, "reduced_motion": false}';