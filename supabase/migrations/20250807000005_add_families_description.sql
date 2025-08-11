-- Add missing description column to families table
-- The get_user_families function expects this column but it was missing from the schema

ALTER TABLE families 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN families.description IS 'Optional description or notes about the family group';