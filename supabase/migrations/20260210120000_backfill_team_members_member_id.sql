-- Backfill member_id on team_members for existing records
-- The original migration from admin_users never set member_id,
-- so team member name lookups via the members FK were returning null.

UPDATE team_members tm
SET member_id = m.id
FROM members m
WHERE tm.user_id = m.user_id
  AND tm.member_id IS NULL;
