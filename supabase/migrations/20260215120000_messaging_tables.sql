-- Messaging: channels, channel_members, messages

-- channels table
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chapter_id, name)
);

-- channel_members table
CREATE TABLE channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, team_member_id)
);

-- messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES team_members(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_channels_chapter_id ON channels(chapter_id);
CREATE INDEX idx_channels_is_archived ON channels(is_archived);

CREATE INDEX idx_channel_members_channel_id ON channel_members(channel_id);
CREATE INDEX idx_channel_members_team_member_id ON channel_members(team_member_id);

CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);

-- RLS
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- channels policies
-- ============================================================

-- SELECT: authenticated users can read channels they've joined
CREATE POLICY "Members can view joined channels"
  ON channels FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members cm
        JOIN team_members tm ON tm.id = cm.team_member_id
      WHERE cm.channel_id = channels.id
        AND tm.user_id = auth.uid()
    )
  );

-- INSERT: chapter admins can create channels
CREATE POLICY "Chapter admins can create channels"
  ON channels FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
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

-- UPDATE: channel admins or chapter admins can update channels
CREATE POLICY "Channel or chapter admins can update channels"
  ON channels FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members cm
        JOIN team_members tm ON tm.id = cm.team_member_id
      WHERE cm.channel_id = channels.id
        AND tm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
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
-- channel_members policies
-- ============================================================

-- SELECT: users can see members of channels they've joined
CREATE POLICY "Members can view channel members"
  ON channel_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members my_cm
        JOIN team_members tm ON tm.id = my_cm.team_member_id
      WHERE my_cm.channel_id = channel_members.channel_id
        AND tm.user_id = auth.uid()
    )
  );

-- INSERT: channel admins can add members, or users can join themselves
CREATE POLICY "Channel admins or self can add members"
  ON channel_members FOR INSERT TO authenticated
  WITH CHECK (
    -- Channel admin adding someone
    EXISTS (
      SELECT 1 FROM channel_members cm
        JOIN team_members tm ON tm.id = cm.team_member_id
      WHERE cm.channel_id = channel_members.channel_id
        AND tm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
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

-- UPDATE: channel members can update their own row (e.g. last_read_at)
CREATE POLICY "Members can update own membership"
  ON channel_members FOR UPDATE TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- DELETE: channel admins can remove members, or users can remove themselves
CREATE POLICY "Channel admins or self can remove members"
  ON channel_members FOR DELETE TO authenticated
  USING (
    -- Channel admin removing someone
    EXISTS (
      SELECT 1 FROM channel_members cm
        JOIN team_members tm ON tm.id = cm.team_member_id
      WHERE cm.channel_id = channel_members.channel_id
        AND tm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
    OR
    -- User removing themselves
    team_member_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- messages policies
-- ============================================================

-- SELECT: users can read messages in channels they've joined
CREATE POLICY "Members can view channel messages"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members cm
        JOIN team_members tm ON tm.id = cm.team_member_id
      WHERE cm.channel_id = messages.channel_id
        AND tm.user_id = auth.uid()
    )
  );

-- INSERT: users can post to channels they've joined
CREATE POLICY "Members can send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channel_members cm
        JOIN team_members tm ON tm.id = cm.team_member_id
      WHERE cm.channel_id = messages.channel_id
        AND tm.user_id = auth.uid()
    )
    AND sender_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- UPDATE: users can edit their own messages only
CREATE POLICY "Users can edit own messages"
  ON messages FOR UPDATE TO authenticated
  USING (
    sender_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- DELETE: users can soft-delete their own messages only
CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE TO authenticated
  USING (
    sender_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION update_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW
  EXECUTE FUNCTION update_channels_updated_at();

CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_messages_updated_at();

-- ============================================================
-- Realtime
-- ============================================================

ALTER publication supabase_realtime ADD TABLE messages;
