-- Chapter Groups: named subgroups within a chapter for targeted communications and polls

CREATE TABLE chapter_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chapter_id, name)
);

CREATE TABLE member_group_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES chapter_groups(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(member_id, group_id)
);

-- Enable RLS
ALTER TABLE chapter_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_group_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can manage groups
CREATE POLICY "Admins can manage chapter_groups" ON chapter_groups
  FOR ALL USING (is_admin(auth.uid()));

-- Members can view groups they belong to
CREATE POLICY "Members can view their groups" ON chapter_groups
  FOR SELECT USING (
    id IN (
      SELECT group_id FROM member_group_assignments
      WHERE member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    )
  );

-- Admins can manage group assignments
CREATE POLICY "Admins can manage group assignments" ON member_group_assignments
  FOR ALL USING (is_admin(auth.uid()));

-- Members can view their own assignments
CREATE POLICY "Members can view own group assignments" ON member_group_assignments
  FOR SELECT USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_chapter_groups_chapter ON chapter_groups(chapter_id);
CREATE INDEX idx_member_group_assignments_group ON member_group_assignments(group_id);
CREATE INDEX idx_member_group_assignments_member ON member_group_assignments(member_id);

-- Auto-update updated_at
CREATE TRIGGER chapter_groups_updated_at
  BEFORE UPDATE ON chapter_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Clean up group assignments when a member changes chapters
CREATE OR REPLACE FUNCTION cleanup_group_assignments_on_chapter_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.chapter_id IS DISTINCT FROM OLD.chapter_id THEN
    DELETE FROM member_group_assignments
    WHERE member_id = NEW.id
    AND group_id IN (
      SELECT cg.id FROM chapter_groups cg
      WHERE cg.chapter_id NOT IN (
        SELECT mc.chapter_id FROM member_chapters mc WHERE mc.member_id = NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER member_chapter_change_cleanup_groups
  AFTER UPDATE OF chapter_id ON members
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_group_assignments_on_chapter_change();

COMMENT ON TABLE chapter_groups IS 'Named subgroups within a chapter for targeted communications and polls';
COMMENT ON TABLE member_group_assignments IS 'Junction table linking members to chapter groups';
