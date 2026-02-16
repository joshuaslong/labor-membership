-- Drop admin_users table and all its policies/indexes
-- This runs AFTER all references have been migrated to team_members

-- Drop orphaned policies still referencing admin_users on other tables
DROP POLICY IF EXISTS "Admins can view all events" ON events;
DROP POLICY IF EXISTS "Allow admin write" ON member_segments;

-- Recreate them using team_members
CREATE POLICY "Admins can view all events" ON events
  FOR SELECT TO authenticated
  USING (is_admin_team_member(auth.uid()));

CREATE POLICY "Allow admin write" ON member_segments
  FOR ALL TO authenticated
  USING (is_admin_team_member(auth.uid()));

-- Drop RLS policies on admin_users
DROP POLICY IF EXISTS "Users can view own admin record" ON admin_users;
DROP POLICY IF EXISTS "Admins can view admin_users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin_users" ON admin_users;

-- Drop indexes
DROP INDEX IF EXISTS idx_admin_users_user_id;
DROP INDEX IF EXISTS idx_admin_users_chapter_id;

-- Drop the table
DROP TABLE IF EXISTS admin_users;

-- Drop old helper function that is no longer needed
DROP FUNCTION IF EXISTS is_admin_or_super();
