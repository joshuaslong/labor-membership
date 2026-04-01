-- Add private channel support
-- Private channels are invite-only; public channels auto-add all chapter team members

ALTER TABLE channels ADD COLUMN is_private boolean NOT NULL DEFAULT false;
