-- Backfill member_chapters for members who only have chapter_id set
-- This ensures all members are properly linked to their chapters in the junction table

-- First, insert records for members who have chapter_id but no member_chapters entries
INSERT INTO member_chapters (member_id, chapter_id, is_primary)
SELECT m.id, m.chapter_id, true
FROM members m
WHERE m.chapter_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM member_chapters mc
    WHERE mc.member_id = m.id AND mc.chapter_id = m.chapter_id
  );

-- Now add parent chapter memberships for members who are missing them
-- We need to traverse up the hierarchy and add all parent chapters

-- Create a function to add all parent chapters for a member
CREATE OR REPLACE FUNCTION backfill_parent_chapters()
RETURNS void AS $$
DECLARE
  member_rec RECORD;
  parent_chapter_id UUID;
  current_chapter_id UUID;
BEGIN
  -- Loop through all member_chapters entries that are primary
  FOR member_rec IN
    SELECT mc.member_id, mc.chapter_id
    FROM member_chapters mc
    WHERE mc.is_primary = true
  LOOP
    -- Get the parent of this chapter
    SELECT c.parent_id INTO current_chapter_id
    FROM chapters c
    WHERE c.id = member_rec.chapter_id;

    -- Walk up the hierarchy and add each parent
    WHILE current_chapter_id IS NOT NULL LOOP
      -- Insert if not exists
      INSERT INTO member_chapters (member_id, chapter_id, is_primary)
      VALUES (member_rec.member_id, current_chapter_id, false)
      ON CONFLICT (member_id, chapter_id) DO NOTHING;

      -- Get the next parent
      SELECT c.parent_id INTO parent_chapter_id
      FROM chapters c
      WHERE c.id = current_chapter_id;

      current_chapter_id := parent_chapter_id;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the backfill
SELECT backfill_parent_chapters();

-- Drop the function after use
DROP FUNCTION backfill_parent_chapters();

-- Add comment for documentation
COMMENT ON TABLE member_chapters IS 'Junction table linking members to chapters. Each member has one primary chapter and inherits membership in all parent chapters up to national.';
