-- Allow team members to be created before the person has an account
-- When they sign up later, user_id gets linked via member_id

-- Drop the NOT NULL constraint on user_id
ALTER TABLE team_members ALTER COLUMN user_id DROP NOT NULL;

-- Drop the unique constraint and recreate it to allow multiple NULLs
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS unique_user_team_member;
CREATE UNIQUE INDEX unique_user_team_member ON team_members (user_id) WHERE user_id IS NOT NULL;

-- Add a unique constraint on member_id to prevent duplicate team member entries
CREATE UNIQUE INDEX unique_member_team_member ON team_members (member_id) WHERE member_id IS NOT NULL;
