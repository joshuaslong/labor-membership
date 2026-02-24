# Admin → Team Member Migration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate `admin_users` table, make `team_members` the single source of truth for all roles and permissions, and bring volunteers into the workspace.

**Architecture:** Single migration rewrites all RLS policies and RPC functions from `admin_users` to `team_members`. App code updated to query `team_members` everywhere. Volunteer approval flow creates team_member records for workspace-access opportunities.

**Tech Stack:** Supabase (Postgres RLS, SECURITY DEFINER functions), Next.js App Router, `@supabase/ssr`

---

## Phase 1: Database Migration

### Task 1: Add `is_media_team` column to `team_members`

The `admin_users` table has `is_media_team BOOLEAN DEFAULT FALSE`. This needs to exist on `team_members` before we can drop `admin_users`.

**Files:**
- Create: `supabase/migrations/20260215150000_admin_to_team_member.sql`

**Step 1: Write the migration SQL (beginning of file)**

```sql
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
```

---

### Task 2: Create SECURITY DEFINER helper functions for team_members RLS

The current `team_members` RLS policies reference `admin_users` to avoid infinite recursion. We need new SECURITY DEFINER functions that read `team_members` directly (bypassing RLS).

**Append to the same migration file:**

```sql
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

-- Also a no-arg version for simple RLS policies (uses auth.uid())
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
```

---

### Task 3: Rewrite RPC functions to use team_members

Replace all RPC functions that currently query `admin_users`.

**Append to migration:**

```sql
-- Step 3: Rewrite RPC functions

-- Replace is_admin() - now checks team_members
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_admin_team_member(check_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Replace is_super_admin(UUID) - now checks team_members
CREATE OR REPLACE FUNCTION is_super_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_super_admin_team_member(check_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Replace is_super_admin() (no-arg) - now checks team_members
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT is_super_admin_team_member(auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Replace is_admin_or_super() - now checks team_members
CREATE OR REPLACE FUNCTION is_admin_or_super()
RETURNS BOOLEAN AS $$
  SELECT is_admin_team_member(auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Replace can_manage_chapter() - reads team_members (single row)
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

-- Replace can_manage_admin() - takes target team_member ID now
-- Note: This function signature changes from target_admin_id to target_team_member_id
CREATE OR REPLACE FUNCTION can_manage_admin(manager_user_id UUID, target_admin_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  tm_manager RECORD;
  tm_target RECORD;
BEGIN
  -- Get manager record
  SELECT roles, chapter_id INTO tm_manager
  FROM team_members WHERE user_id = manager_user_id AND active = true;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Super admin can manage anyone
  IF 'super_admin' = ANY(tm_manager.roles) THEN RETURN TRUE; END IF;

  -- Get target record (target_admin_id is now team_members.id)
  SELECT roles, chapter_id INTO tm_target
  FROM team_members WHERE id = target_admin_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Can't manage super_admins or national_admins unless you're a super_admin
  IF tm_target.roles && ARRAY['super_admin','national_admin'] THEN
    RETURN FALSE;
  END IF;

  -- Check if target's chapter is within manager's jurisdiction
  IF tm_target.chapter_id IS NOT NULL THEN
    RETURN can_manage_chapter(manager_user_id, tm_target.chapter_id);
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Replace can_access_file() - reads team_members
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

  -- Check team_members for remaining tiers
  SELECT roles, chapter_id, is_media_team INTO tm
  FROM team_members WHERE user_id = user_uuid AND active = true;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Super/national admin can access everything
  IF tm.roles && ARRAY['super_admin','national_admin'] THEN
    RETURN TRUE;
  END IF;

  -- Media team can access media files
  IF file_record.access_tier = 'media' AND tm.is_media_team THEN
    RETURN TRUE;
  END IF;

  -- Chapter admins/team members can access files in their jurisdiction
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
    -- Non-admin team members: exact chapter match only
    IF file_record.chapter_id = tm.chapter_id THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Replace can_upload_to_bucket() - reads team_members
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
```

---

### Task 4: Rewrite all RLS policies referencing admin_users

Drop and recreate every RLS policy that references `admin_users`, now using `team_members` (via the new helper functions).

**Append to migration:**

```sql
-- Step 4: Rewrite all RLS policies

-- ---- team_members policies (currently reference admin_users) ----
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

-- ---- chapter_groups policies (uses is_admin() which is now updated) ----
-- These use is_admin(auth.uid()) which is already rewritten above. No policy changes needed.

-- ---- admin_users policies (will be dropped with the table) ----
-- No action needed - these go away when we drop admin_users.
```

---

### Task 5: Migrate foreign key references from admin_users to team_members

Four tables have FK columns pointing to `admin_users(id)`. Migrate the data and repoint the FKs.

**Append to migration:**

```sql
-- Step 5: Migrate foreign keys from admin_users to team_members

-- events.created_by: admin_users(id) → team_members(id)
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
UPDATE events SET created_by = tm.id
FROM admin_users au
JOIN team_members tm ON tm.user_id = au.user_id
WHERE events.created_by = au.id;
ALTER TABLE events ADD CONSTRAINT events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES team_members(id) ON DELETE SET NULL;

-- polls.created_by: admin_users(id) → team_members(id)
ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_created_by_fkey;
UPDATE polls SET created_by = tm.id
FROM admin_users au
JOIN team_members tm ON tm.user_id = au.user_id
WHERE polls.created_by = au.id;
ALTER TABLE polls ADD CONSTRAINT polls_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES team_members(id) ON DELETE SET NULL;

-- member_segments.applied_by: admin_users(id) → team_members(id)
ALTER TABLE member_segments DROP CONSTRAINT IF EXISTS member_segments_applied_by_fkey;
UPDATE member_segments SET applied_by = tm.id
FROM admin_users au
JOIN team_members tm ON tm.user_id = au.user_id
WHERE member_segments.applied_by = au.id;
ALTER TABLE member_segments ADD CONSTRAINT member_segments_applied_by_fkey
  FOREIGN KEY (applied_by) REFERENCES team_members(id) ON DELETE SET NULL;

-- email_logs.admin_id: admin_users(id) → team_members(id)
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_admin_id_fkey;
UPDATE email_logs SET admin_id = tm.id
FROM admin_users au
JOIN team_members tm ON tm.user_id = au.user_id
WHERE email_logs.admin_id = au.id;
ALTER TABLE email_logs ADD CONSTRAINT email_logs_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES team_members(id) ON DELETE SET NULL;
```

---

### Task 6: Add grants_workspace_access to volunteer_opportunities

**Append to migration:**

```sql
-- Step 6: Add grants_workspace_access to volunteer_opportunities
ALTER TABLE volunteer_opportunities
  ADD COLUMN IF NOT EXISTS grants_workspace_access BOOLEAN DEFAULT FALSE;
```

---

### Task 7: Drop admin_users table

**Create separate migration:** `supabase/migrations/20260215150001_drop_admin_users.sql`

```sql
-- Drop admin_users table and all its policies/indexes
-- This runs AFTER all references have been migrated

-- Drop RLS policies on admin_users
DROP POLICY IF EXISTS "Users can view own admin record" ON admin_users;
DROP POLICY IF EXISTS "Admins can view admin_users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin_users" ON admin_users;

-- Drop indexes
DROP INDEX IF EXISTS idx_admin_users_user_id;
DROP INDEX IF EXISTS idx_admin_users_chapter_id;

-- Drop the table
DROP TABLE IF EXISTS admin_users;

-- Drop old helper functions that are no longer needed
DROP FUNCTION IF EXISTS is_admin_or_super();
```

---

## Phase 2: Core Application Files

### Task 8: Rewrite `src/lib/adminAuth.js`

This is the central auth module. Change it to query `team_members` instead of `admin_users`.

**Files:**
- Modify: `src/lib/adminAuth.js`

**Changes:**

The `getAuthenticatedAdmin()` function currently:
1. Gets the auth user
2. Queries `admin_users` for all records matching user_id
3. Returns the highest-priority record with role, chapterId, isMediaTeam

Replace with:
1. Gets the auth user
2. Queries `team_members` for the single record (with chapter join)
3. Extracts admin roles from the roles array
4. Returns similar shape but adapted for array-based roles

Key return shape change:
- Before: `{ userId, email, role: 'state_admin', chapterId, isMediaTeam, adminId }`
- After: `{ userId, email, roles: ['state_admin','event_coordinator'], role: 'state_admin' (highest), chapterId, isMediaTeam, teamMemberId }`

Keep backward compatibility by including `role` (highest admin role) alongside `roles` array.

`getAdminRolesForUser()` currently returns all admin_users rows. Change to return the single team_member record.

`hasRole()` and `isSuperAdmin()` already work with the role string, no changes needed.

---

### Task 9: Update `src/middleware.js`

**Files:**
- Modify: `src/middleware.js`

**Change:** Replace the admin_users query with team_members:

Before:
```js
const { data: adminRecords } = await supabase
  .from('admin_users')
  .select('role')
  .eq('user_id', user.id)
  .limit(1)
```

After:
```js
const { data: teamMember } = await supabase
  .from('team_members')
  .select('roles')
  .eq('user_id', user.id)
  .eq('active', true)
  .single()

// Check has admin role
const ADMIN_ROLES = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
const isAdmin = teamMember?.roles?.some(r => ADMIN_ROLES.includes(r))
```

---

### Task 10: Update `src/lib/permissions.js`

**Files:**
- Modify: `src/lib/permissions.js`

**Change:** Add `'team_member'` role to SECTION_PERMISSIONS for the sections volunteers should access:

```js
const SECTION_PERMISSIONS = {
  members: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'membership_coordinator', 'data_manager'],
  events: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'event_coordinator', 'team_member'],
  communicate: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'communications_lead'],
  chapters: ['national_admin', 'state_admin', 'county_admin', 'city_admin'],
  resources: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'content_creator', 'team_member'],
  polls: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'communications_lead'],
  volunteers: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'volunteer_manager', 'event_coordinator', 'team_member'],
  tasks: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'volunteer_manager', 'team_member'],
  messaging: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'communications_lead', 'event_coordinator', 'volunteer_manager', 'membership_coordinator', 'content_creator', 'data_manager', 'team_member'],
  admin: ['super_admin', 'national_admin']
}
```

Also add role category constants:

```js
export const ADMIN_ROLES = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
export const SPECIALIST_ROLES = ['event_coordinator', 'volunteer_manager', 'communications_lead', 'content_creator', 'data_manager', 'membership_coordinator']
export const BASE_ROLES = ['team_member']
```

---

## Phase 3: API Route Updates

### Task 11: Update admin management route (COMPLETE REWRITE)

**Files:**
- Modify: `src/app/api/admin/admins/route.js`
- Modify: `src/app/api/admin/admins/me/route.js`

This is the heaviest file. Key changes:
1. **Remove `syncTeamMember()`** entirely — no more dual tables
2. **GET handler**: Query `team_members` instead of `admin_users`
3. **POST handler**: Insert into `team_members` (or update existing record's roles array)
4. **PUT handler**: Update `team_members` roles array
5. **DELETE handler**: Remove role from `team_members` roles array (or deactivate if no roles left)

The `me` route changes from querying `admin_users` to `team_members`.

---

### Task 12: Update API routes - Common pattern

Most API routes follow this pattern. For each file, replace:

```js
// OLD: Query admin_users
const { data: adminRecords } = await adminClient
  .from('admin_users')
  .select('id, role, chapter_id')
  .eq('user_id', user.id)

if (!adminRecords?.length) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
}
```

With:

```js
// NEW: Query team_members
const { data: teamMember } = await adminClient
  .from('team_members')
  .select('id, roles, chapter_id, is_media_team')
  .eq('user_id', user.id)
  .eq('active', true)
  .single()

if (!teamMember || !teamMember.roles?.some(r =>
  ['super_admin','national_admin','state_admin','county_admin','city_admin'].includes(r)
)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
}
```

Then replace role checks:
- `adminRecords[0].role === 'super_admin'` → `teamMember.roles.includes('super_admin')`
- `['super_admin','national_admin'].includes(record.role)` → `teamMember.roles.some(r => ['super_admin','national_admin'].includes(r))`
- `record.chapter_id` → `teamMember.chapter_id`

**Files to update (group by area):**

**Events:**
- `src/app/api/events/route.js`
- `src/app/api/events/[id]/route.js`
- `src/app/api/events/[id]/rsvps/route.js`

**Files/Folders/Collections:**
- `src/app/api/files/route.js`
- `src/app/api/files/[id]/route.js`
- `src/app/api/files/[id]/move/route.js`
- `src/app/api/files/upload/route.js`
- `src/app/api/folders/route.js`
- `src/app/api/folders/[id]/route.js`
- `src/app/api/folders/[id]/move/route.js`
- `src/app/api/collections/route.js`
- `src/app/api/collections/[id]/route.js`
- `src/app/api/collections/[id]/sections/route.js`
- `src/app/api/collections/[id]/sections/[sectionId]/route.js`
- `src/app/api/collections/[id]/sections/[sectionId]/files/route.js`

**Members:**
- `src/app/api/members/route.js`
- `src/app/api/members/[id]/route.js` (also remove admin_users delete on member deletion)

**Email:**
- `src/app/api/admin/email-templates/route.js`
- `src/app/api/admin/email-templates/[key]/route.js`
- `src/app/api/admin/email/send/route.js` (uses requireAdmin — may need no changes after Task 8)
- `src/app/api/admin/email/test/route.js` (uses requireAdmin — may need no changes after Task 8)

**Polls:**
- `src/app/api/admin/polls/route.js`
- `src/app/api/admin/polls/[id]/route.js`
- `src/app/api/admin/polls/[id]/results/route.js`

**Initiatives:**
- `src/app/api/admin/initiatives/route.js`
- `src/app/api/admin/initiatives/[id]/route.js`

**Groups:**
- `src/app/api/admin/groups/route.js`
- `src/app/api/admin/groups/[id]/route.js`
- `src/app/api/admin/groups/[id]/members/route.js`

**Other:**
- `src/app/api/admin/sync-payments/route.js` (remove admin_users fallback)
- `src/app/api/admin/preferences/route.js`
- `src/app/api/admin/import-members/route.js`

---

## Phase 4: Client-Side Updates

### Task 13: Update client-side pages that query admin_users

These pages use the Supabase client directly to query `admin_users`. Replace with `team_members` queries.

**Files:**
- `src/app/dashboard/page.js`
- `src/components/Navigation.js`
- `src/app/chapters/page.js`
- `src/app/chapters/[id]/page.js`
- `src/app/admin/polls/page.js`
- `src/app/admin/groups/page.js`
- `src/app/admin/events/new/page.js`
- `src/app/admin/email/hooks/useAdminContext.js`
- `src/app/workspace/members/[id]/page.js`
- `src/app/workspace/admin/groups/page.js`
- `src/app/workspace/events/new/page.js`
- `src/app/workspace/volunteers/new/page.js`

Same pattern: `.from('admin_users')` → `.from('team_members')`, adjust for roles array.

---

## Phase 5: Volunteer Workspace Integration

### Task 14: Update volunteer approval flow

**Files:**
- Modify: `src/app/api/volunteers/[id]/applications/[applicationId]/route.js`

When a volunteer application is approved AND the opportunity has `grants_workspace_access = true`:

1. After updating application status to `'approved'`
2. Check if `grants_workspace_access` is true on the opportunity
3. Check if a `team_members` record already exists for the applicant's `user_id`
4. If not, create one with:
   - `user_id`: from the member's auth user
   - `member_id`: from the application's member_id
   - `chapter_id`: from the opportunity's chapter_id
   - `roles`: `['team_member']`
   - `active`: `true`
5. If exists but inactive, reactivate and add `'team_member'` to roles if not present

**Also modify:**
- `src/app/workspace/volunteers/new/page.js` or `NewOpportunityForm` — add a checkbox for `grants_workspace_access`

---

## Phase 6: Apply & Verify

### Task 15: Apply database migration

Run: Apply `20260215150000_admin_to_team_member.sql` to Supabase via the Supabase MCP tool.

Verify:
- `is_admin()` function works with team_members
- `can_manage_chapter()` function works
- `can_access_file()` function works
- RLS policies allow proper access

### Task 16: Build and test

Run: `npm run build` from the project root.

Verify:
- Build passes with no errors
- Test key flows: admin login → workspace → manage team → create event → upload file

### Task 17: Apply admin_users drop migration

Only after Task 16 passes:

Run: Apply `20260215150001_drop_admin_users.sql` to Supabase.

Run: `npm run build` again to verify.

### Task 18: Commit

```bash
git add -A
git commit -m "feat: eliminate admin_users, make team_members single source of truth

- Rewrote all RLS policies to use team_members instead of admin_users
- Rewrote all RPC functions (is_admin, can_manage_chapter, can_access_file, etc.)
- Migrated foreign keys from admin_users to team_members
- Updated all API routes (~35 files) to query team_members
- Updated middleware and adminAuth.js
- Added team_member base role for volunteers
- Added grants_workspace_access to volunteer_opportunities
- Dropped admin_users table

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Execution Notes

**Parallelization opportunities:**
- Phase 1 (SQL) must be sequential
- Phase 2 tasks (adminAuth, middleware, permissions) are independent of each other
- Phase 3 API route updates can be parallelized by area (events, files, members, etc.)
- Phase 4 client-side updates can run in parallel with Phase 3

**Risk mitigation:**
- Apply the main migration first, test RLS with existing app code (should still work since function signatures match)
- Then update app code
- Drop admin_users table last

**Total files to modify:** ~50 (35 API routes + 12 client pages + 3 lib files + 1 middleware)
**New migrations:** 2 SQL files
