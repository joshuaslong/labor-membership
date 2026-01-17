-- Assign all members without a chapter to the national chapter
-- This ensures everyone is at least part of the national party

-- First, get the national chapter ID
DO $$
DECLARE
  national_chapter_uuid UUID;
BEGIN
  -- Get the national chapter
  SELECT id INTO national_chapter_uuid
  FROM chapters
  WHERE level = 'national'
  LIMIT 1;

  IF national_chapter_uuid IS NULL THEN
    RAISE EXCEPTION 'No national chapter found. Please create one first.';
  END IF;

  -- Update members.chapter_id for members without one
  UPDATE members
  SET chapter_id = national_chapter_uuid
  WHERE chapter_id IS NULL;

  -- Add member_chapters entries for members who don't have any
  INSERT INTO member_chapters (member_id, chapter_id, is_primary)
  SELECT m.id, national_chapter_uuid, true
  FROM members m
  WHERE NOT EXISTS (
    SELECT 1 FROM member_chapters mc WHERE mc.member_id = m.id
  );

  RAISE NOTICE 'All unassigned members have been assigned to the national chapter.';
END $$;
