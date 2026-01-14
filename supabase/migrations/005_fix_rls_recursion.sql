-- Fix infinite recursion in RLS policies
-- The issue is that admin_users policy checks admin_users, causing recursion

-- Drop all problematic policies
DROP POLICY IF EXISTS "Admins can view own admin status" ON admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin_users" ON admin_users;
DROP POLICY IF EXISTS "Admins can view all members" ON members;
DROP POLICY IF EXISTS "Admins can insert members" ON members;
DROP POLICY IF EXISTS "Admins can update members" ON members;
DROP POLICY IF EXISTS "Admins can delete members" ON members;
DROP POLICY IF EXISTS "Admins can manage chapters" ON chapters;

-- Admin users: simple policy - you can see your own record
CREATE POLICY "Users can view own admin status" ON admin_users
  FOR SELECT USING (auth.uid() = user_id);

-- Super admins can manage other admins (use a function to avoid recursion)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin_or_super()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Super admins can insert/update/delete admin_users
CREATE POLICY "Super admins can insert admin_users" ON admin_users
  FOR INSERT WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update admin_users" ON admin_users
  FOR UPDATE USING (is_super_admin());

CREATE POLICY "Super admins can delete admin_users" ON admin_users
  FOR DELETE USING (is_super_admin());

-- Members policies using the helper functions
CREATE POLICY "Admins can view all members" ON members
  FOR SELECT USING (is_admin_or_super());

CREATE POLICY "Admins can insert members" ON members
  FOR INSERT WITH CHECK (is_admin_or_super());

CREATE POLICY "Admins can update members" ON members
  FOR UPDATE USING (is_admin_or_super());

CREATE POLICY "Admins can delete members" ON members
  FOR DELETE USING (is_admin_or_super());

-- Chapters policies using the helper function
CREATE POLICY "Admins can manage chapters" ON chapters
  FOR ALL USING (is_admin_or_super());
