-- Fix RLS infinite recursion on channel_members
-- The channel_members SELECT policy self-references channel_members,
-- causing infinite recursion when PostgreSQL evaluates RLS.
-- Fix: use SECURITY DEFINER helper functions to break the cycle.

-- ============================================================
-- Helper functions (SECURITY DEFINER bypasses RLS)
-- ============================================================

-- Returns channel IDs that a user is a member of
CREATE OR REPLACE FUNCTION get_my_channel_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT cm.channel_id
  FROM channel_members cm
  JOIN team_members tm ON tm.id = cm.team_member_id
  WHERE tm.user_id = p_user_id;
$$;

-- Checks if a user is a channel admin
CREATE OR REPLACE FUNCTION is_channel_admin(p_channel_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM channel_members cm
    JOIN team_members tm ON tm.id = cm.team_member_id
    WHERE cm.channel_id = p_channel_id
      AND tm.user_id = p_user_id
      AND cm.role = 'admin'
  );
$$;

-- ============================================================
-- Fix channels policies
-- ============================================================

-- SELECT: allow viewing any channel in user's chapters (enables browsing)
DROP POLICY IF EXISTS "Members can view joined channels" ON channels;
CREATE POLICY IF NOT EXISTS "Members can view chapter channels"
  ON channels FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.chapter_id = channels.chapter_id
    )
  );

-- UPDATE: use helper function instead of direct channel_members query
DROP POLICY IF EXISTS "Channel or chapter admins can update channels" ON channels;
CREATE POLICY "Channel or chapter admins can update channels"
  ON channels FOR UPDATE TO authenticated
  USING (
    is_channel_admin(channels.id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.chapter_id = channels.chapter_id
        AND (
          'super_admin' = ANY(tm.roles)
          OR 'national_admin' = ANY(tm.roles)
          OR 'state_admin' = ANY(tm.roles)
          OR 'county_admin' = ANY(tm.roles)
          OR 'city_admin' = ANY(tm.roles)
        )
    )
  );

-- ============================================================
-- Fix channel_members policies
-- ============================================================

-- SELECT: use helper function to break self-reference
DROP POLICY IF EXISTS "Members can view channel members" ON channel_members;
CREATE POLICY "Members can view channel members"
  ON channel_members FOR SELECT TO authenticated
  USING (channel_id IN (SELECT get_my_channel_ids(auth.uid())));

-- INSERT: use helper function for admin check
DROP POLICY IF EXISTS "Channel admins or self can add members" ON channel_members;
CREATE POLICY "Channel admins or self can add members"
  ON channel_members FOR INSERT TO authenticated
  WITH CHECK (
    -- Channel admin adding someone
    is_channel_admin(channel_members.channel_id, auth.uid())
    OR
    -- User joining themselves in an accessible chapter
    (
      channel_members.team_member_id IN (
        SELECT id FROM team_members WHERE user_id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM channels c
          JOIN team_members tm ON tm.chapter_id = c.chapter_id
        WHERE c.id = channel_members.channel_id
          AND tm.user_id = auth.uid()
      )
    )
  );

-- DELETE: use helper function for admin check
DROP POLICY IF EXISTS "Channel admins or self can remove members" ON channel_members;
CREATE POLICY "Channel admins or self can remove members"
  ON channel_members FOR DELETE TO authenticated
  USING (
    is_channel_admin(channel_members.channel_id, auth.uid())
    OR
    team_member_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- Fix messages policies
-- ============================================================

-- SELECT: use helper function
DROP POLICY IF EXISTS "Members can view channel messages" ON messages;
CREATE POLICY "Members can view channel messages"
  ON messages FOR SELECT TO authenticated
  USING (channel_id IN (SELECT get_my_channel_ids(auth.uid())));

-- INSERT: use helper function for membership check
DROP POLICY IF EXISTS "Members can send messages" ON messages;
CREATE POLICY "Members can send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    channel_id IN (SELECT get_my_channel_ids(auth.uid()))
    AND sender_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid()
    )
  );
