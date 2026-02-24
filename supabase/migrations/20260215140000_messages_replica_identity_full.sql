-- Set REPLICA IDENTITY FULL on messages table so Realtime UPDATE events
-- deliver the complete row, not just the primary key.
ALTER TABLE messages REPLICA IDENTITY FULL;
