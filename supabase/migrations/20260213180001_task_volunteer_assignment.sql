-- Add volunteer member assignment column to tasks
ALTER TABLE tasks
  ADD COLUMN assignee_member_id UUID REFERENCES members(id) ON DELETE SET NULL;

-- A task can be assigned to a team member (owner) OR a volunteer (assignee_member_id), not both
ALTER TABLE tasks
  ADD CONSTRAINT tasks_single_assignee
  CHECK (NOT (owner IS NOT NULL AND assignee_member_id IS NOT NULL));

-- Index for looking up tasks by volunteer assignee
CREATE INDEX idx_tasks_assignee_member_id ON tasks(assignee_member_id) WHERE assignee_member_id IS NOT NULL;

-- RLS: Allow members to read tasks assigned to them
CREATE POLICY "Members can view tasks assigned to them"
  ON tasks FOR SELECT
  USING (
    assignee_member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- RLS: Allow members to update status/notes on tasks assigned to them
CREATE POLICY "Members can update assigned tasks"
  ON tasks FOR UPDATE
  USING (
    assignee_member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    assignee_member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );
