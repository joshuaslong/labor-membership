-- Fix SECURITY DEFINER functions with proper search_path
-- The functions need SET search_path for security and to work correctly

-- Drop and recreate the is_admin function with proper search_path
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = check_user_id
    AND role IN ('super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Drop and recreate the is_super_admin function with proper search_path
CREATE OR REPLACE FUNCTION is_super_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = check_user_id
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Make sure the policies exist and use the functions
DROP POLICY IF EXISTS "Users can view own admin record" ON admin_users;
DROP POLICY IF EXISTS "Admins can view admin_users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin_users" ON admin_users;

-- Policy: Users can always view their own admin record(s)
CREATE POLICY "Users can view own admin record" ON admin_users
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Any admin can view all admin_users (needed for admin management UI)
CREATE POLICY "Admins can view admin_users" ON admin_users
  FOR SELECT USING (is_admin(auth.uid()));

-- Policy: Super admins can insert/update/delete admin_users
CREATE POLICY "Super admins can manage admin_users" ON admin_users
  FOR ALL USING (is_super_admin(auth.uid()));

-- Ensure RLS is enabled
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO anon;
GRANT EXECUTE ON FUNCTION is_super_admin(UUID) TO anon;
