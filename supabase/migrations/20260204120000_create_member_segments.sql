-- Create member_segments table
CREATE TABLE member_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  segment TEXT NOT NULL CHECK (segment IN ('donor', 'volunteer', 'event_attendee', 'organizer', 'new_member')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by UUID REFERENCES admin_users(id) ON DELETE SET NULL, -- will migrate to team_members later
  auto_applied BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_member_segment UNIQUE(member_id, segment)
);

-- Create index for fast lookups
CREATE INDEX idx_member_segments_member_id ON member_segments(member_id);
CREATE INDEX idx_member_segments_segment ON member_segments(segment);

-- Create trigger for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON member_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE member_segments ENABLE ROW LEVEL SECURITY;

-- RLS policy: members can view their own segments
CREATE POLICY "Members can view own segments" ON member_segments
  FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- RLS policy: admins can view all segments
CREATE POLICY "Admins can view all segments" ON member_segments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

-- RLS policy: admins can insert (refine later with team_members)
CREATE POLICY "Admins can insert segments" ON member_segments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- RLS policy: admins can update (refine later with team_members)
CREATE POLICY "Admins can update segments" ON member_segments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- RLS policy: admins can delete (refine later with team_members)
CREATE POLICY "Admins can delete segments" ON member_segments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );
