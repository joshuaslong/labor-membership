-- Migration: Create mailing list table for non-member signups
-- Description: Allows guests to sign up for the mailing list during initiatives

CREATE TABLE IF NOT EXISTS mailing_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  source TEXT, -- Where they signed up from (e.g., 'care-packages-initiative')
  subscribed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT mailing_list_email_unique UNIQUE (email)
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_mailing_list_email ON mailing_list(email);
CREATE INDEX IF NOT EXISTS idx_mailing_list_source ON mailing_list(source);

-- Enable RLS
ALTER TABLE mailing_list ENABLE ROW LEVEL SECURITY;

-- Only admins can view mailing list
CREATE POLICY "Admins can view mailing list" ON mailing_list
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- Service role can manage mailing list
CREATE POLICY "Service role manages mailing list" ON mailing_list
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_mailing_list_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mailing_list_updated_at ON mailing_list;
CREATE TRIGGER mailing_list_updated_at
  BEFORE UPDATE ON mailing_list
  FOR EACH ROW
  EXECUTE FUNCTION update_mailing_list_timestamp();
