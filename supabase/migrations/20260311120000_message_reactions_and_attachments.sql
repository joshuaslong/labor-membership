-- Message reactions table
CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, team_member_id, emoji)
);

CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_team_member_id ON message_reactions(team_member_id);

-- Message attachments table
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  r2_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX idx_message_attachments_file_id ON message_attachments(file_id);

-- RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- Reactions: channel members can view reactions on messages in their channels
CREATE POLICY "Channel members can view reactions"
  ON message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
        JOIN channel_members cm ON cm.channel_id = m.channel_id
        JOIN team_members tm ON tm.id = cm.team_member_id
      WHERE m.id = message_reactions.message_id
        AND tm.user_id = auth.uid()
    )
  );

-- Reactions: channel members can add reactions
CREATE POLICY "Channel members can add reactions"
  ON message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    team_member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM messages m
        JOIN channel_members cm ON cm.channel_id = m.channel_id
        JOIN team_members tm ON tm.id = cm.team_member_id
      WHERE m.id = message_reactions.message_id
        AND tm.user_id = auth.uid()
    )
  );

-- Reactions: users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
  ON message_reactions FOR DELETE TO authenticated
  USING (
    team_member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
  );

-- Attachments: channel members can view attachments on messages in their channels
CREATE POLICY "Channel members can view attachments"
  ON message_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
        JOIN channel_members cm ON cm.channel_id = m.channel_id
        JOIN team_members tm ON tm.id = cm.team_member_id
      WHERE m.id = message_attachments.message_id
        AND tm.user_id = auth.uid()
    )
  );

-- Attachments: channel members can add attachments (via API, not direct insert)
CREATE POLICY "Channel members can add attachments"
  ON message_attachments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
        JOIN channel_members cm ON cm.channel_id = m.channel_id
        JOIN team_members tm ON tm.id = cm.team_member_id
      WHERE m.id = message_attachments.message_id
        AND tm.user_id = auth.uid()
    )
  );

-- Add realtime for reactions
ALTER publication supabase_realtime ADD TABLE message_reactions;
