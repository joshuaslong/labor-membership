-- Add national_admin role
-- National admins have access to all data like super_admin, but cannot:
-- - Create/edit chapters
-- - Manage other admins
-- They're essentially "read/write for members" but not system configuration

-- Update role check constraint to include national_admin
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin'));

-- Update can_manage_chapter to treat national_admin like super_admin for data access
CREATE OR REPLACE FUNCTION can_manage_chapter(admin_user_id UUID, target_chapter_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  admin_record RECORD;
BEGIN
  -- Get admin info
  SELECT role, chapter_id INTO admin_record
  FROM admin_users
  WHERE user_id = admin_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Super admin and national admin can manage all chapters
  IF admin_record.role IN ('super_admin', 'national_admin') THEN
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

-- Update can_manage_admin to prevent national_admin from managing admins
CREATE OR REPLACE FUNCTION can_manage_admin(manager_user_id UUID, target_admin_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  manager_record RECORD;
  target_record RECORD;
BEGIN
  -- Get manager info
  SELECT au.role, au.chapter_id, c.level INTO manager_record
  FROM admin_users au
  LEFT JOIN chapters c ON au.chapter_id = c.id
  WHERE au.user_id = manager_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Only super admin can manage admins
  IF manager_record.role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- National admin cannot manage other admins
  IF manager_record.role = 'national_admin' THEN
    RETURN FALSE;
  END IF;

  -- Get target admin info
  SELECT au.role, au.chapter_id, c.level INTO target_record
  FROM admin_users au
  LEFT JOIN chapters c ON au.chapter_id = c.id
  WHERE au.id = target_admin_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Can't manage super_admins or national_admins
  IF target_record.role IN ('super_admin', 'national_admin') THEN
    RETURN FALSE;
  END IF;

  -- Check if target's chapter is within manager's jurisdiction
  RETURN can_manage_chapter(manager_user_id, target_record.chapter_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Comment for documentation
COMMENT ON CONSTRAINT admin_users_role_check ON admin_users IS 'Valid admin roles: super_admin (full access), national_admin (all data, no admin management), state/county/city_admin (chapter-scoped)';
