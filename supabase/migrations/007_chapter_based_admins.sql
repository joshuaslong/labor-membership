-- Update admin_users to support chapter-based administration
-- Roles: super_admin (global), state_admin, county_admin, city_admin

-- Add chapter_id to admin_users (null for super_admin = global access)
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE;

-- Update role check constraint to include new roles
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('super_admin', 'state_admin', 'county_admin', 'city_admin'));

-- Update existing 'admin' roles to appropriate level based on context
-- For now, keep super_admin as is (already correct)
UPDATE admin_users SET role = 'super_admin' WHERE role = 'admin';

-- Create index for chapter-based lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_chapter_id ON admin_users(chapter_id);

-- Function to check if user can manage a specific chapter
-- Returns true if:
-- 1. User is super_admin (can manage all)
-- 2. User is admin of the target chapter
-- 3. User is admin of an ancestor chapter (state admin can manage county/city in their state)
CREATE OR REPLACE FUNCTION can_manage_chapter(admin_user_id UUID, target_chapter_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  admin_record RECORD;
  target_chapter RECORD;
BEGIN
  -- Get admin info
  SELECT role, chapter_id INTO admin_record
  FROM admin_users
  WHERE user_id = admin_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Super admin can manage everything
  IF admin_record.role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- If admin has no chapter assigned, they can't manage anything
  IF admin_record.chapter_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if target chapter is the admin's chapter or a descendant
  RETURN EXISTS (
    SELECT 1 FROM get_chapter_descendants(admin_record.chapter_id)
    WHERE id = target_chapter_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to check if user can manage another admin
-- An admin can only manage admins at lower levels within their jurisdiction
CREATE OR REPLACE FUNCTION can_manage_admin(manager_user_id UUID, target_admin_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  manager_record RECORD;
  target_record RECORD;
  manager_level_index INT;
  target_level_index INT;
  levels TEXT[] := ARRAY['national', 'state', 'county', 'city'];
BEGIN
  -- Get manager info
  SELECT au.role, au.chapter_id, c.level INTO manager_record
  FROM admin_users au
  LEFT JOIN chapters c ON au.chapter_id = c.id
  WHERE au.user_id = manager_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Super admin can manage anyone
  IF manager_record.role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- Get target admin info
  SELECT au.role, au.chapter_id, c.level INTO target_record
  FROM admin_users au
  LEFT JOIN chapters c ON au.chapter_id = c.id
  WHERE au.id = target_admin_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Can't manage super_admins
  IF target_record.role = 'super_admin' THEN
    RETURN FALSE;
  END IF;

  -- Check if target's chapter is within manager's jurisdiction
  RETURN can_manage_chapter(manager_user_id, target_record.chapter_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Comment for documentation
COMMENT ON COLUMN admin_users.chapter_id IS 'The chapter this admin manages. NULL for super_admin (global access).';
COMMENT ON FUNCTION can_manage_chapter IS 'Check if a user can manage a specific chapter based on their admin role and chapter hierarchy.';
COMMENT ON FUNCTION can_manage_admin IS 'Check if a user can manage another admin based on hierarchy.';
