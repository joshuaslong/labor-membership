-- Enhanced admin permissions
-- Only super_admin and admin can modify members and chapters

-- Drop existing policies that need updating
DROP POLICY IF EXISTS "Admins can manage members" ON members;
DROP POLICY IF EXISTS "Admins can manage chapters" ON chapters;
DROP POLICY IF EXISTS "Anyone can view chapters" ON chapters;
DROP POLICY IF EXISTS "Public can view active chapters" ON chapters;

-- Chapters policies
-- Public can view active chapters (read only)
CREATE POLICY "Public can view active chapters" ON chapters
  FOR SELECT USING (is_active = true);

-- Admins and super_admins can manage all chapters
CREATE POLICY "Admins can manage chapters" ON chapters
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users
      WHERE role IN ('admin', 'super_admin')
    )
  );

-- Members policies (keep existing read policies, update management)
-- Admins and super_admins can manage all members
CREATE POLICY "Admins can manage members" ON members
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users
      WHERE role IN ('admin', 'super_admin')
    )
  );

-- Admin users table policies
DROP POLICY IF EXISTS "Admins can view admin_users" ON admin_users;

-- Super admins can manage admin_users (add/remove admins)
CREATE POLICY "Super admins can manage admin_users" ON admin_users
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users
      WHERE role = 'super_admin'
    )
  );

-- All admins can view admin_users
CREATE POLICY "Admins can view admin_users" ON admin_users
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users
      WHERE role IN ('admin', 'super_admin')
    )
  );
