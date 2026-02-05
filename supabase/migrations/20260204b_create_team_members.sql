-- Create team_members table (replaces admin_users eventually)
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL, -- link to member record (optional)
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL, -- chapter scope
  roles TEXT[] NOT NULL DEFAULT '{}', -- array of role names
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_team_member UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_chapter_id ON team_members(chapter_id);
CREATE INDEX idx_team_members_roles ON team_members USING GIN(roles); -- for array searches

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can read their own record
CREATE POLICY "Allow user read own" ON team_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- RLS policy: admins can view all team members
CREATE POLICY "Admins can view all team members" ON team_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND ('super_admin' = ANY(tm.roles) OR 'national_admin' = ANY(tm.roles))
    )
  );

-- Note: First super_admin must be created via direct SQL with RLS bypassed:
-- INSERT INTO team_members (user_id, roles, active) VALUES ('<user_id>', ARRAY['super_admin'], true);
-- Run this command in Supabase SQL editor or with service role key

-- RLS policy: super admins can write (insert/update/delete)
CREATE POLICY "Allow super admin write" ON team_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND 'super_admin' = ANY(tm.roles)
    )
  );

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_team_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_team_members_updated_at();
