-- Migration: Migrate existing admin_users to team_members
-- Expected Performance: Should complete in <1 second for typical datasets (<1000 records)

BEGIN;

-- Migrate existing admin_users to team_members
INSERT INTO team_members (user_id, chapter_id, roles, active, created_at, updated_at)
SELECT
  user_id,
  chapter_id, -- NULL for super_admins (global access)
  ARRAY[role]::TEXT[], -- convert single role to array
  true, -- all existing admins are active
  COALESCE(created_at, NOW()), -- preserve original creation time
  NOW()
FROM admin_users
ON CONFLICT (user_id) DO UPDATE SET
  chapter_id = EXCLUDED.chapter_id,
  roles = EXCLUDED.roles,
  updated_at = NOW(); -- update existing records to ensure consistency

COMMIT;

-- Verification queries (run after migration):
-- SELECT COUNT(*) as admin_count FROM admin_users;
-- SELECT COUNT(*) as team_members_count FROM team_members;
-- Both counts should match after successful migration

-- Note: We keep admin_users table for now to avoid breaking existing code
-- The table will be deprecated gradually as we migrate all references to team_members
-- DO NOT drop admin_users until all application code has been updated
