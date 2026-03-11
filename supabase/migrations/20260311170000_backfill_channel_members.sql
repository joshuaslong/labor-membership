-- Backfill: auto-add all active team members to channels in their chapters
-- This ensures existing team members see all channels in their chapter

INSERT INTO channel_members (channel_id, team_member_id, role)
SELECT DISTINCT c.id, tm.id, 'member'
FROM channels c
JOIN team_members tm ON tm.chapter_id = c.chapter_id AND tm.active = true
WHERE c.is_archived = false
  AND c.is_private = false
  AND NOT EXISTS (
    SELECT 1 FROM channel_members cm
    WHERE cm.channel_id = c.id AND cm.team_member_id = tm.id
  );

-- Also cover team members assigned via the junction table
INSERT INTO channel_members (channel_id, team_member_id, role)
SELECT DISTINCT c.id, tmc.team_member_id, 'member'
FROM channels c
JOIN team_member_chapters tmc ON tmc.chapter_id = c.chapter_id
JOIN team_members tm ON tm.id = tmc.team_member_id AND tm.active = true
WHERE c.is_archived = false
  AND c.is_private = false
  AND NOT EXISTS (
    SELECT 1 FROM channel_members cm
    WHERE cm.channel_id = c.id AND cm.team_member_id = tmc.team_member_id
  );
