-- Team member chapters junction table (supports multiple chapter assignments)
CREATE TABLE team_member_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_member_id, chapter_id)
);

CREATE INDEX idx_team_member_chapters_team_member_id ON team_member_chapters(team_member_id);
CREATE INDEX idx_team_member_chapters_chapter_id ON team_member_chapters(chapter_id);

-- Migrate existing chapter assignments to junction table
INSERT INTO team_member_chapters (team_member_id, chapter_id, is_primary)
SELECT id, chapter_id, true
FROM team_members
WHERE chapter_id IS NOT NULL;

-- RLS
ALTER TABLE team_member_chapters ENABLE ROW LEVEL SECURITY;

-- SELECT: same as team_members - users can see their own, admins can see all
CREATE POLICY "Users can view own chapter assignments"
  ON team_member_chapters FOR SELECT TO authenticated
  USING (
    team_member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all chapter assignments"
  ON team_member_chapters FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND ('super_admin' = ANY(tm.roles) OR 'national_admin' = ANY(tm.roles))
    )
  );

-- INSERT/UPDATE/DELETE: only super admins and national admins
CREATE POLICY "Admins can manage chapter assignments"
  ON team_member_chapters FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND ('super_admin' = ANY(tm.roles) OR 'national_admin' = ANY(tm.roles))
    )
  );
