-- Create junction table for many-to-many member-chapter relationships
-- Members belong to their assigned chapter AND all ancestor chapters

CREATE TABLE member_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE, -- TRUE for the member's most local chapter
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, chapter_id)
);

-- Enable RLS
ALTER TABLE member_chapters ENABLE ROW LEVEL SECURITY;

-- Members can view their own chapter memberships
CREATE POLICY "Members can view own chapter memberships" ON member_chapters
  FOR SELECT USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Admins can manage all
CREATE POLICY "Admins can manage member_chapters" ON member_chapters
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Indexes for performance
CREATE INDEX idx_member_chapters_member ON member_chapters(member_id);
CREATE INDEX idx_member_chapters_chapter ON member_chapters(chapter_id);
CREATE INDEX idx_member_chapters_primary ON member_chapters(chapter_id) WHERE is_primary = TRUE;

-- Function to assign member to a chapter AND all its ancestors
CREATE OR REPLACE FUNCTION assign_member_to_chapter_hierarchy(
  p_member_id UUID,
  p_chapter_id UUID
) RETURNS void AS $$
DECLARE
  ancestor RECORD;
BEGIN
  -- First, remove any existing chapter assignments for this member
  DELETE FROM member_chapters WHERE member_id = p_member_id;

  -- Also update the legacy chapter_id field on members table
  UPDATE members SET chapter_id = p_chapter_id WHERE id = p_member_id;

  -- Insert the primary chapter (the most local one)
  INSERT INTO member_chapters (member_id, chapter_id, is_primary)
  VALUES (p_member_id, p_chapter_id, TRUE)
  ON CONFLICT (member_id, chapter_id) DO NOTHING;

  -- Insert all ancestor chapters
  FOR ancestor IN
    SELECT id FROM get_chapter_ancestors(p_chapter_id)
    WHERE id != p_chapter_id  -- exclude the chapter itself (already added)
  LOOP
    INSERT INTO member_chapters (member_id, chapter_id, is_primary)
    VALUES (p_member_id, ancestor.id, FALSE)
    ON CONFLICT (member_id, chapter_id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get member count for a chapter (direct members only, using junction table)
CREATE OR REPLACE FUNCTION get_chapter_direct_member_count(p_chapter_id UUID)
RETURNS BIGINT AS $$
  SELECT COUNT(DISTINCT mc.member_id)
  FROM member_chapters mc
  JOIN members m ON mc.member_id = m.id
  WHERE mc.chapter_id = p_chapter_id
  AND m.status = 'active';
$$ LANGUAGE sql STABLE;

-- Migrate existing members to the junction table
-- This adds them to their current chapter AND all ancestors
DO $$
DECLARE
  member_record RECORD;
BEGIN
  FOR member_record IN
    SELECT id, chapter_id FROM members WHERE chapter_id IS NOT NULL
  LOOP
    PERFORM assign_member_to_chapter_hierarchy(member_record.id, member_record.chapter_id);
  END LOOP;
END $$;

-- Trigger to automatically update junction table when chapter_id changes
CREATE OR REPLACE FUNCTION on_member_chapter_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.chapter_id IS DISTINCT FROM OLD.chapter_id THEN
    IF NEW.chapter_id IS NOT NULL THEN
      PERFORM assign_member_to_chapter_hierarchy(NEW.id, NEW.chapter_id);
    ELSE
      -- If chapter_id is set to NULL, remove all chapter assignments
      DELETE FROM member_chapters WHERE member_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER member_chapter_change_trigger
  AFTER UPDATE OF chapter_id ON members
  FOR EACH ROW
  EXECUTE FUNCTION on_member_chapter_change();

-- Trigger for new members
CREATE OR REPLACE FUNCTION on_member_insert_chapter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.chapter_id IS NOT NULL THEN
    PERFORM assign_member_to_chapter_hierarchy(NEW.id, NEW.chapter_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER member_insert_chapter_trigger
  AFTER INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION on_member_insert_chapter();

COMMENT ON TABLE member_chapters IS 'Junction table linking members to chapters. Members belong to their primary chapter and all ancestor chapters.';
COMMENT ON COLUMN member_chapters.is_primary IS 'TRUE for the members most local/specific chapter assignment';
