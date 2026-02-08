-- Aggregate member counts per chapter in the database
-- Fixes PostgREST 1000-row default limit silently truncating results
CREATE OR REPLACE FUNCTION get_chapter_member_counts()
RETURNS TABLE(chapter_id UUID, member_count BIGINT) AS $$
  SELECT mc.chapter_id, COUNT(DISTINCT mc.member_id) as member_count
  FROM member_chapters mc
  JOIN members m ON mc.member_id = m.id
  WHERE m.status = 'active'
  GROUP BY mc.chapter_id;
$$ LANGUAGE sql STABLE;
