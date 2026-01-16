-- Add separate fields for volunteer interests and skills

-- Rename volunteer_details to volunteer_interests if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'members' AND column_name = 'volunteer_details') THEN
    ALTER TABLE members RENAME COLUMN volunteer_details TO volunteer_interests;
  END IF;
END $$;

-- Add volunteer_interests if it doesn't exist (in case rename didn't happen)
ALTER TABLE members ADD COLUMN IF NOT EXISTS volunteer_interests text;

-- Add volunteer_skills column
ALTER TABLE members ADD COLUMN IF NOT EXISTS volunteer_skills text;

-- Comments for documentation
COMMENT ON COLUMN members.volunteer_interests IS 'Types of volunteer work the member is interested in';
COMMENT ON COLUMN members.volunteer_skills IS 'Professional skills and experience the member can contribute';
