-- Create get_user_families RPC function
-- This function returns all families a user belongs to

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_user_families(UUID);

CREATE OR REPLACE FUNCTION get_user_families(user_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(200),
  description TEXT,
  status VARCHAR(20),
  subscription_status VARCHAR(20),
  subscription_tier_id UUID,
  timezone VARCHAR(50),
  invite_code VARCHAR(50),
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  role_type VARCHAR(30),
  role_name VARCHAR(100),
  is_default_family BOOLEAN,
  joined_at TIMESTAMPTZ
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.description,
    f.status,
    f.subscription_status,
    f.subscription_tier_id,
    f.timezone,
    f.invite_code,
    f.created_by,
    f.created_at,
    f.updated_at,
    r.type as role_type,
    r.name as role_name,
    fm.is_default_family,
    fm.joined_at
  FROM families f
  JOIN family_memberships fm ON f.id = fm.family_id
  JOIN roles r ON fm.role_id = r.id
  WHERE fm.user_id = get_user_families.user_id
    AND fm.status = 'active'
    AND f.status = 'active'
  ORDER BY fm.is_default_family DESC, fm.joined_at;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_families(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_user_families(UUID) IS 'Returns all active families a user belongs to with their role information';