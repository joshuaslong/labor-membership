-- Add chapter group targeting and visibility to events
-- Matches the pattern used by polls (target_type + group_id)

-- Target type: chapter (default) or group
ALTER TABLE events ADD COLUMN target_type TEXT NOT NULL DEFAULT 'chapter'
  CHECK (target_type IN ('chapter', 'group'));

-- Group reference (required when target_type='group')
ALTER TABLE events ADD COLUMN group_id UUID REFERENCES chapter_groups(id) ON DELETE SET NULL;

-- Visibility: public (default, shown on /events) or internal (workspace only)
ALTER TABLE events ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'internal'));

-- Constraint: group_id required when target_type='group', null otherwise
ALTER TABLE events ADD CONSTRAINT events_target_type_group_check
  CHECK ((target_type = 'chapter' AND group_id IS NULL) OR (target_type = 'group' AND group_id IS NOT NULL));
