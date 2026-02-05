-- Auto-apply new_member segment migration
-- This migration:
-- 1. Backfills new_member segment for existing members joined < 90 days ago
-- 2. Creates trigger to auto-apply segment to new member inserts

BEGIN;

-- Create index for performance on joined_date queries
CREATE INDEX IF NOT EXISTS idx_members_joined_date ON members(joined_date);

-- Backfill: Auto-apply 'new_member' segment to members joined < 90 days ago
-- The 90-day rule defines "new members" as those who joined within the last 90 days
INSERT INTO member_segments (member_id, segment, auto_applied)
SELECT
  id,
  'new_member',
  true
FROM members
WHERE joined_date > NOW() - INTERVAL '90 days'
  AND NOT EXISTS (
    SELECT 1 FROM member_segments
    WHERE member_segments.member_id = members.id
      AND member_segments.segment = 'new_member'
  );

-- Create function to auto-apply new_member segment on member insert
-- This ensures new members are automatically tagged when they join
-- SECURITY DEFINER allows the function to bypass RLS policies when inserting into member_segments
CREATE OR REPLACE FUNCTION auto_apply_new_member_segment()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
  -- Auto-apply new_member segment for newly joined members
  -- Only applies if member joined within last 90 days
  IF NEW.joined_date > NOW() - INTERVAL '90 days' THEN
    INSERT INTO member_segments (member_id, segment, auto_applied)
    VALUES (NEW.id, 'new_member', true)
    ON CONFLICT (member_id, segment) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists to ensure idempotency
DROP TRIGGER IF EXISTS auto_new_member_segment ON members;

-- Create trigger to auto-apply new_member segment on member insert
-- Fires after each new member is inserted into the members table
CREATE TRIGGER auto_new_member_segment
  AFTER INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION auto_apply_new_member_segment();

-- Verification: Count members with auto-applied new_member segment
-- This should match the count of members joined in the last 90 days
DO $$
DECLARE
  segment_count INTEGER;
  member_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO segment_count
  FROM member_segments
  WHERE segment = 'new_member' AND auto_applied = true;

  SELECT COUNT(*) INTO member_count
  FROM members
  WHERE joined_date > NOW() - INTERVAL '90 days';

  RAISE NOTICE 'Auto-applied new_member segment to % members (% total new members)', segment_count, member_count;
END $$;

COMMIT;
