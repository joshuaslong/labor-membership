-- Fix RLS policies on admin_users table to include all current admin roles
-- The old policies only checked for 'admin' and 'super_admin' roles

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can manage admin_users" ON admin_users;
DROP POLICY IF EXISTS "Admins can view admin_users" ON admin_users;

-- All admins can view admin_users (needed to load their own role)
CREATE POLICY "Admins can view admin_users" ON admin_users
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users
      WHERE role IN ('super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin')
    )
  );

-- Super admins can insert/update/delete admin_users
CREATE POLICY "Super admins can manage admin_users" ON admin_users
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users
      WHERE role = 'super_admin'
    )
  );

-- Also allow users to read their own admin record (fallback)
CREATE POLICY "Users can view own admin record" ON admin_users
  FOR SELECT USING (auth.uid() = user_id);
