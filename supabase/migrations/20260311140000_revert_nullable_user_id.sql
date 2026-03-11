-- Revert: user_id must be NOT NULL on team_members
-- Members need an account before being added as team members

-- Remove the partial unique index on member_id
DROP INDEX IF EXISTS unique_member_team_member;

-- Remove the partial unique index on user_id and restore the original constraint
DROP INDEX IF EXISTS unique_user_team_member;
ALTER TABLE team_members ADD CONSTRAINT unique_user_team_member UNIQUE(user_id);

-- Re-add NOT NULL (safe since no null user_id rows were created)
ALTER TABLE team_members ALTER COLUMN user_id SET NOT NULL;
