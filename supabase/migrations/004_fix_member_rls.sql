-- Fix RLS so admins can also read their own member profile
-- The issue is that "Admins can manage members" uses FOR ALL which might conflict

-- Drop and recreate member policies with proper ordering
DROP POLICY IF EXISTS "Members can view own profile" ON members;
DROP POLICY IF EXISTS "Members can update own profile" ON members;
DROP POLICY IF EXISTS "Admins can manage members" ON members;

-- Members can view their own profile (this should match for user_id)
CREATE POLICY "Members can view own profile" ON members
  FOR SELECT USING (auth.uid() = user_id);

-- Members can update their own contact info
CREATE POLICY "Members can update own profile" ON members
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all members
CREATE POLICY "Admins can view all members" ON members
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users
      WHERE role IN ('admin', 'super_admin')
    )
  );

-- Admins can insert members
CREATE POLICY "Admins can insert members" ON members
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM admin_users
      WHERE role IN ('admin', 'super_admin')
    )
  );

-- Admins can update any member
CREATE POLICY "Admins can update members" ON members
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users
      WHERE role IN ('admin', 'super_admin')
    )
  );

-- Admins can delete members
CREATE POLICY "Admins can delete members" ON members
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users
      WHERE role IN ('admin', 'super_admin')
    )
  );

-- Also fix admin_users read policy for the logged-in admin to see their own role
DROP POLICY IF EXISTS "Admins can view admin_users" ON admin_users;

CREATE POLICY "Admins can view own admin status" ON admin_users
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT user_id FROM admin_users
      WHERE role IN ('admin', 'super_admin')
    )
  );
