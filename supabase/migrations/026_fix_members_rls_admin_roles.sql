-- Fix members RLS policies to recognize all admin roles
-- The is_admin_or_super() function only checks for 'admin' and 'super_admin'
-- but we now have national_admin, state_admin, county_admin, city_admin roles
-- This causes admins with these roles to see "Member not found" on member profiles

-- Drop the outdated policies that use is_admin_or_super()
DROP POLICY IF EXISTS "Admins can view all members" ON members;
DROP POLICY IF EXISTS "Admins can insert members" ON members;
DROP POLICY IF EXISTS "Admins can update members" ON members;
DROP POLICY IF EXISTS "Admins can delete members" ON members;

-- Recreate policies using the is_admin() function which checks all admin roles
-- is_admin() checks: super_admin, national_admin, state_admin, county_admin, city_admin

CREATE POLICY "Admins can view all members" ON members
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert members" ON members
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update members" ON members
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete members" ON members
  FOR DELETE USING (is_admin(auth.uid()));
