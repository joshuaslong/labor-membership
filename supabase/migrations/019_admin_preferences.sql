-- Admin preferences table for storing default email settings
CREATE TABLE admin_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_reply_to TEXT,
  default_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE admin_preferences ENABLE ROW LEVEL SECURITY;

-- Admins can only read/write their own preferences
CREATE POLICY "Users can read own preferences"
  ON admin_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON admin_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON admin_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_admin_preferences_user_id ON admin_preferences(user_id);

-- Add comment for documentation
COMMENT ON TABLE admin_preferences IS 'Stores admin user preferences for email composition defaults';
