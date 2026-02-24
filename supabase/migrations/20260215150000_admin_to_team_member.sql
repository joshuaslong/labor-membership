-- ============================================================
-- Migration: admin_users → team_members
-- Eliminates admin_users table, makes team_members the single
-- source of truth for all roles, permissions, and RLS policies.
-- ============================================================

-- Step 1: Add is_media_team to team_members
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_media_team BOOLEAN DEFAULT FALSE;

-- Backfill is_media_team from admin_users
UPDATE team_members tm
SET is_media_team = TRUE
WHERE EXISTS (
  SELECT 1 FROM admin_users au
  WHERE au.user_id = tm.user_id
  AND au.is_media_team = TRUE
);

-- Step 2: Create SECURITY DEFINER functions that read team_members directly
-- These bypass RLS to avoid infinite recursion when used in team_members policies

CREATE OR REPLACE FUNCTION is_admin_team_member(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = check_user_id
    AND active = true
    AND roles && ARRAY['super_admin','national_admin','state_admin','county_admin','city_admin']
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION is_super_admin_team_member(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = check_user_id
    AND active = true
    AND 'super_admin' = ANY(roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION is_top_admin_team_member(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = check_user_id
    AND active = true
    AND roles && ARRAY['super_admin','national_admin']
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION is_active_team_member()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid()
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION is_admin_team_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_team_member(UUID) TO anon;
GRANT EXECUTE ON FUNCTION is_super_admin_team_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin_team_member(UUID) TO anon;
GRANT EXECUTE ON FUNCTION is_top_admin_team_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_top_admin_team_member(UUID) TO anon;
GRANT EXECUTE ON FUNCTION is_active_team_member() TO authenticated;

-- Step 3: Rewrite RPC functions to use team_members

CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_admin_team_member(check_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION is_super_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_super_admin_team_member(check_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT is_super_admin_team_member(auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin_or_super()
RETURNS BOOLEAN AS $$
  SELECT is_admin_team_member(auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_manage_chapter(admin_user_id UUID, target_chapter_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  tm RECORD;
BEGIN
  SELECT roles, chapter_id INTO tm
  FROM team_members
  WHERE user_id = admin_user_id AND active = true;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF 'super_admin' = ANY(tm.roles) THEN RETURN TRUE; END IF;
  IF 'national_admin' = ANY(tm.roles) THEN RETURN TRUE; END IF;

  IF tm.chapter_id IS NOT NULL AND tm.roles && ARRAY['state_admin','county_admin','city_admin'] THEN
    RETURN EXISTS (
      SELECT 1 FROM get_chapter_descendants(tm.chapter_id)
      WHERE id = target_chapter_id
    );
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_manage_admin(manager_user_id UUID, target_admin_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  tm_manager RECORD;
  tm_target RECORD;
BEGIN
  SELECT roles, chapter_id INTO tm_manager
  FROM team_members WHERE user_id = manager_user_id AND active = true;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF 'super_admin' = ANY(tm_manager.roles) THEN RETURN TRUE; END IF;

  -- target_admin_id is now team_members.id
  SELECT roles, chapter_id INTO tm_target
  FROM team_members WHERE id = target_admin_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF tm_target.roles && ARRAY['super_admin','national_admin'] THEN
    RETURN FALSE;
  END IF;

  IF tm_target.chapter_id IS NOT NULL THEN
    RETURN can_manage_chapter(manager_user_id, tm_target.chapter_id);
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_access_file(file_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  file_record RECORD;
  tm RECORD;
BEGIN
  SELECT access_tier, chapter_id INTO file_record
  FROM files WHERE id = file_uuid AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF file_record.access_tier = 'public' THEN RETURN TRUE; END IF;
  IF user_uuid IS NULL THEN RETURN FALSE; END IF;
  IF file_record.access_tier = 'members' THEN RETURN TRUE; END IF;

  SELECT roles, chapter_id, is_media_team INTO tm
  FROM team_members WHERE user_id = user_uuid AND active = true;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF tm.roles && ARRAY['super_admin','national_admin'] THEN
    RETURN TRUE;
  END IF;

  IF file_record.access_tier = 'media' AND tm.is_media_team THEN
    RETURN TRUE;
  END IF;

  IF file_record.access_tier = 'chapter' AND tm.chapter_id IS NOT NULL THEN
    IF file_record.chapter_id IS NULL THEN
      RETURN FALSE;
    END IF;
    IF tm.roles && ARRAY['state_admin','county_admin','city_admin'] THEN
      RETURN EXISTS (
        SELECT 1 FROM get_chapter_descendants(tm.chapter_id)
        WHERE id = file_record.chapter_id
      );
    END IF;
    IF file_record.chapter_id = tm.chapter_id THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_upload_to_bucket(bucket TEXT, chapter_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  tm RECORD;
BEGIN
  IF user_uuid IS NULL THEN RETURN FALSE; END IF;

  SELECT roles, chapter_id, is_media_team INTO tm
  FROM team_members WHERE user_id = user_uuid AND active = true;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF 'super_admin' = ANY(tm.roles) THEN RETURN TRUE; END IF;

  IF 'national_admin' = ANY(tm.roles) THEN
    IF bucket != 'internal-docs' THEN RETURN TRUE; END IF;
  END IF;

  IF tm.is_media_team AND bucket IN ('media/social', 'media/podcast') THEN
    RETURN TRUE;
  END IF;

  IF bucket = 'chapters' AND tm.chapter_id IS NOT NULL THEN
    IF chapter_uuid IS NULL THEN RETURN TRUE; END IF;
    IF EXISTS (
      SELECT 1 FROM get_chapter_descendants(tm.chapter_id)
      WHERE id = chapter_uuid
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  IF bucket = 'public' AND tm.roles && ARRAY['super_admin','national_admin','state_admin','county_admin','city_admin'] THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Step 4: Rewrite all RLS policies

-- ---- team_members policies ----
DROP POLICY IF EXISTS "Admins can view all team members" ON team_members;
DROP POLICY IF EXISTS "Allow super admin write" ON team_members;

CREATE POLICY "Admins can view all team members" ON team_members
  FOR SELECT TO authenticated
  USING (is_top_admin_team_member(auth.uid()));

CREATE POLICY "Allow super admin write" ON team_members
  FOR ALL TO authenticated
  USING (is_super_admin_team_member(auth.uid()));

-- ---- members policies ----
DROP POLICY IF EXISTS "Admins can view all members" ON members;
DROP POLICY IF EXISTS "Admins can insert members" ON members;
DROP POLICY IF EXISTS "Admins can update members" ON members;
DROP POLICY IF EXISTS "Admins can delete members" ON members;

CREATE POLICY "Admins can view all members" ON members
  FOR SELECT USING (is_admin_team_member(auth.uid()));
CREATE POLICY "Admins can insert members" ON members
  FOR INSERT WITH CHECK (is_admin_team_member(auth.uid()));
CREATE POLICY "Admins can update members" ON members
  FOR UPDATE USING (is_admin_team_member(auth.uid()));
CREATE POLICY "Admins can delete members" ON members
  FOR DELETE USING (is_admin_team_member(auth.uid()));

-- ---- chapters policies ----
DROP POLICY IF EXISTS "Admins can manage chapters" ON chapters;
CREATE POLICY "Admins can manage chapters" ON chapters
  FOR ALL USING (is_admin_team_member(auth.uid()));

-- ---- member_chapters policies ----
DROP POLICY IF EXISTS "Admins can manage member_chapters" ON member_chapters;
CREATE POLICY "Admins can manage member_chapters" ON member_chapters
  FOR ALL USING (is_admin_team_member(auth.uid()));

-- ---- payments policies ----
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT USING (is_admin_team_member(auth.uid()));

-- ---- member_subscriptions policies ----
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON member_subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON member_subscriptions
  FOR SELECT USING (is_admin_team_member(auth.uid()));

-- ---- mailing_list policies ----
DROP POLICY IF EXISTS "Admins can view mailing list" ON mailing_list;
CREATE POLICY "Admins can view mailing list" ON mailing_list
  FOR SELECT USING (is_admin_team_member(auth.uid()));

-- ---- event_guest_rsvps policies ----
DROP POLICY IF EXISTS "Admins can view guest RSVPs" ON event_guest_rsvps;
CREATE POLICY "Admins can view guest RSVPs" ON event_guest_rsvps
  FOR SELECT TO authenticated
  USING (is_admin_team_member(auth.uid()));

-- ---- email_templates policies ----
DROP POLICY IF EXISTS "Admins can view email templates" ON email_templates;
DROP POLICY IF EXISTS "Super admins can update email templates" ON email_templates;

CREATE POLICY "Admins can view email templates" ON email_templates
  FOR SELECT TO authenticated
  USING (is_top_admin_team_member(auth.uid()));

CREATE POLICY "Super admins can update email templates" ON email_templates
  FOR UPDATE TO authenticated
  USING (is_super_admin_team_member(auth.uid()));

-- ---- automated_email_logs policies ----
DROP POLICY IF EXISTS "Admins can view automated email logs" ON automated_email_logs;
CREATE POLICY "Admins can view automated email logs" ON automated_email_logs
  FOR SELECT TO authenticated
  USING (is_top_admin_team_member(auth.uid()));

-- ---- files policies ----
DROP POLICY IF EXISTS "Admins can view chapter files" ON files;
DROP POLICY IF EXISTS "Media team can view media files" ON files;
DROP POLICY IF EXISTS "Super admins can view internal docs" ON files;
DROP POLICY IF EXISTS "Admins can insert files" ON files;
DROP POLICY IF EXISTS "Admins can update files" ON files;
DROP POLICY IF EXISTS "Admins can delete files" ON files;

CREATE POLICY "Team members can view chapter files" ON files
  FOR SELECT TO authenticated
  USING (
    access_tier = 'chapter' AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid() AND tm.active = true
      AND (
        tm.roles && ARRAY['super_admin','national_admin']
        OR (
          tm.chapter_id IS NOT NULL
          AND files.chapter_id IN (SELECT id FROM get_chapter_descendants(tm.chapter_id))
        )
      )
    )
  );

CREATE POLICY "Media team can view media files" ON files
  FOR SELECT TO authenticated
  USING (
    access_tier = 'media' AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid() AND tm.active = true
      AND (tm.roles && ARRAY['super_admin','national_admin'] OR tm.is_media_team = TRUE)
    )
  );

CREATE POLICY "Top admins can view internal docs" ON files
  FOR SELECT TO authenticated
  USING (
    access_tier = 'internal' AND deleted_at IS NULL
    AND is_top_admin_team_member(auth.uid())
  );

CREATE POLICY "Team members can insert files" ON files
  FOR INSERT TO authenticated
  WITH CHECK (is_active_team_member());

CREATE POLICY "Team members can update files" ON files
  FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR is_top_admin_team_member(auth.uid())
  );

CREATE POLICY "Team members can delete files" ON files
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR is_top_admin_team_member(auth.uid())
  );

-- ---- initiatives policies ----
DROP POLICY IF EXISTS "Admins can view all initiatives" ON initiatives;
DROP POLICY IF EXISTS "Admins can insert initiatives" ON initiatives;
DROP POLICY IF EXISTS "Admins can update initiatives" ON initiatives;
DROP POLICY IF EXISTS "Super admins can delete initiatives" ON initiatives;

CREATE POLICY "Admins can view all initiatives" ON initiatives
  FOR SELECT TO authenticated USING (is_top_admin_team_member(auth.uid()));
CREATE POLICY "Admins can insert initiatives" ON initiatives
  FOR INSERT TO authenticated WITH CHECK (is_top_admin_team_member(auth.uid()));
CREATE POLICY "Admins can update initiatives" ON initiatives
  FOR UPDATE TO authenticated USING (is_top_admin_team_member(auth.uid()));
CREATE POLICY "Super admins can delete initiatives" ON initiatives
  FOR DELETE TO authenticated USING (is_super_admin_team_member(auth.uid()));

-- ---- polls/poll_questions/poll_options/poll_responses policies ----
DROP POLICY IF EXISTS "Admins can manage polls" ON polls;
DROP POLICY IF EXISTS "Admins can manage poll_questions" ON poll_questions;
DROP POLICY IF EXISTS "Admins can manage poll_options" ON poll_options;
DROP POLICY IF EXISTS "Admins can manage poll_responses" ON poll_responses;

CREATE POLICY "Admins can manage polls" ON polls
  FOR ALL USING (is_admin_team_member(auth.uid()));
CREATE POLICY "Admins can manage poll_questions" ON poll_questions
  FOR ALL USING (is_admin_team_member(auth.uid()));
CREATE POLICY "Admins can manage poll_options" ON poll_options
  FOR ALL USING (is_admin_team_member(auth.uid()));
CREATE POLICY "Admins can manage poll_responses" ON poll_responses
  FOR ALL USING (is_admin_team_member(auth.uid()));

-- ---- member_segments policies ----
DROP POLICY IF EXISTS "Admins can view all segments" ON member_segments;
DROP POLICY IF EXISTS "Admins can insert segments" ON member_segments;
DROP POLICY IF EXISTS "Admins can update segments" ON member_segments;
DROP POLICY IF EXISTS "Admins can delete segments" ON member_segments;

CREATE POLICY "Admins can view all segments" ON member_segments
  FOR SELECT TO authenticated USING (is_admin_team_member(auth.uid()));
CREATE POLICY "Admins can insert segments" ON member_segments
  FOR INSERT TO authenticated WITH CHECK (is_admin_team_member(auth.uid()));
CREATE POLICY "Admins can update segments" ON member_segments
  FOR UPDATE TO authenticated USING (is_admin_team_member(auth.uid()));
CREATE POLICY "Admins can delete segments" ON member_segments
  FOR DELETE TO authenticated USING (is_admin_team_member(auth.uid()));

-- ---- email_logs policies ----
DROP POLICY IF EXISTS "Admins can view email logs" ON email_logs;
DROP POLICY IF EXISTS "Admins can insert email logs" ON email_logs;

CREATE POLICY "Admins can view email logs" ON email_logs
  FOR SELECT TO authenticated USING (is_admin_team_member(auth.uid()));
CREATE POLICY "Admins can insert email logs" ON email_logs
  FOR INSERT TO authenticated WITH CHECK (is_admin_team_member(auth.uid()));

-- ---- folders policies ----
DROP POLICY IF EXISTS "Admins can view folders in jurisdiction" ON folders;
DROP POLICY IF EXISTS "Admins can insert folders" ON folders;
DROP POLICY IF EXISTS "Admins can update folders" ON folders;
DROP POLICY IF EXISTS "Admins can delete folders" ON folders;

CREATE POLICY "Team members can view folders in jurisdiction" ON folders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid() AND tm.active = true
      AND (
        tm.roles && ARRAY['super_admin','national_admin']
        OR (
          tm.chapter_id IS NOT NULL
          AND folders.chapter_id IN (SELECT id FROM get_chapter_descendants(tm.chapter_id))
        )
      )
    )
  );

CREATE POLICY "Team members can insert folders" ON folders
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid() AND tm.active = true
      AND (
        tm.roles && ARRAY['super_admin','national_admin']
        OR (
          tm.chapter_id IS NOT NULL
          AND folders.chapter_id IN (SELECT id FROM get_chapter_descendants(tm.chapter_id))
        )
      )
    )
  );

CREATE POLICY "Team members can update folders" ON folders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid() AND tm.active = true
      AND (
        tm.roles && ARRAY['super_admin','national_admin']
        OR (
          tm.chapter_id IS NOT NULL
          AND folders.chapter_id IN (SELECT id FROM get_chapter_descendants(tm.chapter_id))
        )
      )
    )
  );

CREATE POLICY "Team members can delete folders" ON folders
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid() AND tm.active = true
      AND (
        tm.roles && ARRAY['super_admin','national_admin']
        OR (
          tm.chapter_id IS NOT NULL
          AND folders.chapter_id IN (SELECT id FROM get_chapter_descendants(tm.chapter_id))
        )
      )
    )
  );

-- ---- resource_collections policies ----
DROP POLICY IF EXISTS "Admins can manage collections" ON resource_collections;
CREATE POLICY "Team members can manage collections" ON resource_collections
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid() AND tm.active = true
      AND (
        tm.roles && ARRAY['super_admin','national_admin']
        OR (
          tm.chapter_id IS NOT NULL
          AND resource_collections.chapter_id IS NOT NULL
          AND resource_collections.chapter_id IN (SELECT id FROM get_chapter_descendants(tm.chapter_id))
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid() AND tm.active = true
      AND (
        tm.roles && ARRAY['super_admin','national_admin']
        OR (
          tm.chapter_id IS NOT NULL
          AND resource_collections.chapter_id IS NOT NULL
          AND resource_collections.chapter_id IN (SELECT id FROM get_chapter_descendants(tm.chapter_id))
        )
      )
    )
  );

-- ---- resource_sections policies ----
DROP POLICY IF EXISTS "Admins can manage sections" ON resource_sections;
CREATE POLICY "Team members can manage sections" ON resource_sections
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM resource_collections rc
      JOIN team_members tm ON tm.user_id = auth.uid()
      WHERE rc.id = resource_sections.collection_id
      AND tm.active = true
      AND (
        tm.roles && ARRAY['super_admin','national_admin']
        OR (
          tm.chapter_id IS NOT NULL
          AND rc.chapter_id IS NOT NULL
          AND rc.chapter_id IN (SELECT id FROM get_chapter_descendants(tm.chapter_id))
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM resource_collections rc
      JOIN team_members tm ON tm.user_id = auth.uid()
      WHERE rc.id = resource_sections.collection_id
      AND tm.active = true
      AND (
        tm.roles && ARRAY['super_admin','national_admin']
        OR (
          tm.chapter_id IS NOT NULL
          AND rc.chapter_id IS NOT NULL
          AND rc.chapter_id IN (SELECT id FROM get_chapter_descendants(tm.chapter_id))
        )
      )
    )
  );

-- ---- resource_section_files policies ----
DROP POLICY IF EXISTS "Admins can manage section files" ON resource_section_files;
CREATE POLICY "Team members can manage section files" ON resource_section_files
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM resource_sections rs
      JOIN resource_collections rc ON rc.id = rs.collection_id
      JOIN team_members tm ON tm.user_id = auth.uid()
      WHERE rs.id = resource_section_files.section_id
      AND tm.active = true
      AND (
        tm.roles && ARRAY['super_admin','national_admin']
        OR (
          tm.chapter_id IS NOT NULL
          AND rc.chapter_id IS NOT NULL
          AND rc.chapter_id IN (SELECT id FROM get_chapter_descendants(tm.chapter_id))
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM resource_sections rs
      JOIN resource_collections rc ON rc.id = rs.collection_id
      JOIN team_members tm ON tm.user_id = auth.uid()
      WHERE rs.id = resource_section_files.section_id
      AND tm.active = true
      AND (
        tm.roles && ARRAY['super_admin','national_admin']
        OR (
          tm.chapter_id IS NOT NULL
          AND rc.chapter_id IS NOT NULL
          AND rc.chapter_id IN (SELECT id FROM get_chapter_descendants(tm.chapter_id))
        )
      )
    )
  );

-- Step 5: Migrate foreign keys from admin_users to team_members

-- events.created_by
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
UPDATE events SET created_by = tm.id
FROM admin_users au
JOIN team_members tm ON tm.user_id = au.user_id
WHERE events.created_by = au.id;
ALTER TABLE events ADD CONSTRAINT events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES team_members(id) ON DELETE SET NULL;

-- polls.created_by
ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_created_by_fkey;
UPDATE polls SET created_by = tm.id
FROM admin_users au
JOIN team_members tm ON tm.user_id = au.user_id
WHERE polls.created_by = au.id;
ALTER TABLE polls ADD CONSTRAINT polls_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES team_members(id) ON DELETE SET NULL;

-- member_segments.applied_by
ALTER TABLE member_segments DROP CONSTRAINT IF EXISTS member_segments_applied_by_fkey;
UPDATE member_segments SET applied_by = tm.id
FROM admin_users au
JOIN team_members tm ON tm.user_id = au.user_id
WHERE member_segments.applied_by = au.id;
ALTER TABLE member_segments ADD CONSTRAINT member_segments_applied_by_fkey
  FOREIGN KEY (applied_by) REFERENCES team_members(id) ON DELETE SET NULL;

-- email_logs.admin_id
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_admin_id_fkey;
UPDATE email_logs SET admin_id = tm.id
FROM admin_users au
JOIN team_members tm ON tm.user_id = au.user_id
WHERE email_logs.admin_id = au.id;
ALTER TABLE email_logs ADD CONSTRAINT email_logs_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES team_members(id) ON DELETE SET NULL;

-- Step 6: Add grants_workspace_access to volunteer_opportunities
ALTER TABLE volunteer_opportunities
  ADD COLUMN IF NOT EXISTS grants_workspace_access BOOLEAN DEFAULT FALSE;
