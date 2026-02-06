-- Migration: Email Logs Table
-- Creates table for tracking manually sent broadcast emails

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id),
  subject TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  chapter_id UUID REFERENCES chapters(id),
  group_id UUID REFERENCES chapter_groups(id),
  recipient_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_logs_admin ON email_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_chapter ON email_logs(chapter_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);

-- RLS Policies
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view their own email logs
CREATE POLICY "Admins can view email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Admins can insert email logs
CREATE POLICY "Admins can insert email logs"
  ON email_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );
