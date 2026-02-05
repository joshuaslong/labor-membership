-- Migration: Migrate existing admin_users to team_members
-- Expected Performance: Should complete in <1 second for typical datasets (<1000 records)

BEGIN;

-- Migrate existing admin_users to team_members
-- Aggregate roles for users with multiple admin_users entries
INSERT INTO team_members (user_id, chapter_id, roles, active, created_at, updated_at)
SELECT
  user_id,
  (array_agg(chapter_id ORDER BY created_at) FILTER (WHERE chapter_id IS NOT NULL))[1], -- first non-null chapter
  array_agg(DISTINCT role)::TEXT[], -- aggregate all roles into array
  true, -- all existing admins are active
  MIN(created_at), -- preserve earliest creation time
  NOW()
FROM admin_users
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE SET
  roles = EXCLUDED.roles,
  updated_at = NOW();

COMMIT;

-- Verification queries (run after migration):
-- SELECT COUNT(DISTINCT user_id) as admin_count FROM admin_users;
-- SELECT COUNT(*) as team_members_count FROM team_members;

-- Note: We keep admin_users table for now to avoid breaking existing code
-- The table will be deprecated gradually as we migrate all references to team_members
-- DO NOT drop admin_users until all application code has been updated
