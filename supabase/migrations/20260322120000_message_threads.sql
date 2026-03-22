-- Add threading support to messages
ALTER TABLE messages ADD COLUMN parent_message_id UUID REFERENCES messages(id) ON DELETE CASCADE;

-- Index for fetching thread replies efficiently
CREATE INDEX idx_messages_parent_message_id ON messages(parent_message_id) WHERE parent_message_id IS NOT NULL;

-- Composite index for ordering thread replies
CREATE INDEX idx_messages_parent_created ON messages(parent_message_id, created_at) WHERE parent_message_id IS NOT NULL;

-- RPC function to get thread reply counts and latest reply timestamps
CREATE OR REPLACE FUNCTION get_thread_info(message_ids UUID[])
RETURNS TABLE(parent_message_id UUID, reply_count BIGINT, latest_reply_at TIMESTAMPTZ)
LANGUAGE sql STABLE
AS $$
  SELECT
    m.parent_message_id,
    COUNT(*) AS reply_count,
    MAX(m.created_at) AS latest_reply_at
  FROM messages m
  WHERE m.parent_message_id = ANY(message_ids)
    AND m.is_deleted = false
  GROUP BY m.parent_message_id;
$$;
