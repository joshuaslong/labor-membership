-- Add per-channel notification preference to channel_members
ALTER TABLE channel_members
  ADD COLUMN notifications_enabled BOOLEAN NOT NULL DEFAULT false;

-- Store Web Push subscriptions per team member per device
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_member_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_team_member ON push_subscriptions(team_member_id);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
