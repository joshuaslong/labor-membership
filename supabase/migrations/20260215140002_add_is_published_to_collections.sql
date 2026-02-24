-- Add is_published column to resource_collections for public portal visibility
ALTER TABLE resource_collections ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;
