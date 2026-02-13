-- Backfill team_members for admin_users records that don't have a
-- corresponding team_members entry. Going forward the app syncs
-- automatically, but existing admins added before the sync code
-- need this one-time migration.

-- For each user in admin_users who does NOT have a team_members row,
-- create one with their admin roles aggregated into the roles array.
INSERT INTO team_members (user_id, member_id, chapter_id, roles, active)
SELECT
  au.user_id,
  m.id AS member_id,
  -- Pick chapter from highest-privilege role
  (array_agg(au.chapter_id ORDER BY
    CASE au.role
      WHEN 'super_admin' THEN 1
      WHEN 'national_admin' THEN 2
      WHEN 'state_admin' THEN 3
      WHEN 'county_admin' THEN 4
      WHEN 'city_admin' THEN 5
      ELSE 6
    END
  ))[1] AS chapter_id,
  array_agg(DISTINCT au.role) AS roles,
  true AS active
FROM admin_users au
LEFT JOIN members m ON m.user_id = au.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM team_members tm WHERE tm.user_id = au.user_id
)
GROUP BY au.user_id, m.id;

-- For users who DO have a team_members row but are missing some admin roles,
-- merge in any missing admin roles from admin_users.
UPDATE team_members tm
SET roles = (
  SELECT array_agg(DISTINCT r)
  FROM (
    SELECT unnest(tm.roles) AS r
    UNION
    SELECT au.role FROM admin_users au WHERE au.user_id = tm.user_id
  ) combined
)
FROM admin_users au
WHERE au.user_id = tm.user_id
  AND NOT (tm.roles @> ARRAY[au.role]);
