-- Fix infinite recursion in team_members RLS policies
-- The admin read policy was querying team_members to check roles,
-- causing infinite recursion. Fix: use admin_users table instead.

BEGIN;

-- Drop the recursive policies
DROP POLICY IF EXISTS "Admins can view all team members" ON team_members;
DROP POLICY IF EXISTS "Allow super admin write" ON team_members;

-- Recreate admin read policy using admin_users (no recursion)
CREATE POLICY "Admins can view all team members" ON team_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.role IN ('super_admin', 'national_admin')
    )
  );

-- Recreate super admin write policy using admin_users (no recursion)
CREATE POLICY "Allow super admin write" ON team_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.role = 'super_admin'
    )
  );

COMMIT;
