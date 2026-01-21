-- Allow users to have multiple admin roles (e.g., National Admin + State Admin for Colorado)
-- This removes the unique constraint on user_id and adds a composite unique constraint

-- Drop the old unique constraint on user_id
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_user_id_key;

-- Add composite unique constraint to prevent duplicate role+chapter combos for same user
ALTER TABLE admin_users ADD CONSTRAINT admin_users_user_role_chapter_unique
  UNIQUE (user_id, role, chapter_id);

-- Update can_manage_chapter to handle multiple admin records
-- Returns true if ANY of the user's admin records can manage the target chapter
CREATE OR REPLACE FUNCTION can_manage_chapter(admin_user_id UUID, target_chapter_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  admin_record RECORD;
BEGIN
  -- Check each admin record for this user
  FOR admin_record IN
    SELECT role, chapter_id
    FROM admin_users
    WHERE user_id = admin_user_id
  LOOP
    -- Super admin can manage everything
    IF admin_record.role = 'super_admin' THEN
      RETURN TRUE;
    END IF;

    -- National admin can manage everything
    IF admin_record.role = 'national_admin' THEN
      RETURN TRUE;
    END IF;

    -- If admin has a chapter assigned, check if target is in their jurisdiction
    IF admin_record.chapter_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM get_chapter_descendants(admin_record.chapter_id)
        WHERE id = target_chapter_id
      ) THEN
        RETURN TRUE;
      END IF;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Update can_manage_admin to handle multiple admin records
-- Uses the highest privilege admin record to determine management capability
CREATE OR REPLACE FUNCTION can_manage_admin(manager_user_id UUID, target_admin_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  manager_record RECORD;
  target_record RECORD;
  has_super_admin BOOLEAN;
BEGIN
  -- Check if manager is a super_admin (can manage anyone)
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = manager_user_id AND role = 'super_admin'
  ) INTO has_super_admin;

  IF has_super_admin THEN
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

  -- Can't manage super_admins or national_admins unless you're a super_admin
  IF target_record.role IN ('super_admin', 'national_admin') THEN
    RETURN FALSE;
  END IF;

  -- Check if target's chapter is within manager's jurisdiction (using any admin record)
  RETURN can_manage_chapter(manager_user_id, target_record.chapter_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON CONSTRAINT admin_users_user_role_chapter_unique ON admin_users IS
  'Allows users to have multiple admin roles but prevents duplicate role+chapter combinations';
