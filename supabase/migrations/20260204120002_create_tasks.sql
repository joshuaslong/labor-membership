-- Create tasks table (VRTF format)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project TEXT NOT NULL, -- groups tasks by plan/initiative
  phase TEXT, -- production phase
  name TEXT NOT NULL, -- task name (action-verb, under 10 words)
  owner UUID REFERENCES team_members(id) ON DELETE SET NULL, -- assigned to (can be null if unassigned)
  deliverable TEXT NOT NULL, -- exact description of deliverable
  time_estimate_min INTEGER NOT NULL CHECK (time_estimate_min > 0), -- estimated minutes
  deadline DATE NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3')),
  status TEXT NOT NULL CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE')) DEFAULT 'NOT_STARTED',
  dependencies UUID[] DEFAULT '{}', -- array of task IDs
  "references" TEXT[] DEFAULT '{}', -- links or file names
  skill_type TEXT CHECK (skill_type IN ('WRITING', 'DESIGN', 'VIDEO', 'TECHNICAL', 'RESEARCH', 'COORDINATION')),
  notes TEXT, -- block reasons, feedback, context
  created_by UUID NOT NULL REFERENCES team_members(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_tasks_owner ON tasks(owner);
CREATE INDEX idx_tasks_project ON tasks(project);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_dependencies ON tasks USING GIN(dependencies);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_skill_type ON tasks(skill_type) WHERE skill_type IS NOT NULL;

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS policy: team members can read tasks
-- Security: Only team members can view tasks, not all authenticated users
CREATE POLICY "Allow team member read" ON tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.user_id = auth.uid()
    )
  );

-- RLS policy: team members can create tasks
CREATE POLICY "Allow team member create" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.user_id = auth.uid()
    )
  );

-- RLS policy: owners and admins can update
CREATE POLICY "Allow owner and admin update" ON tasks
  FOR UPDATE TO authenticated
  USING (
    owner IN (SELECT id FROM team_members WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.user_id = auth.uid()
        AND ('super_admin' = ANY(roles) OR 'national_admin' = ANY(roles) OR 'volunteer_manager' = ANY(roles))
    )
  );

-- RLS policy: admins can delete tasks
CREATE POLICY "Allow admin delete" ON tasks
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.user_id = auth.uid()
        AND ('super_admin' = ANY(roles) OR 'national_admin' = ANY(roles))
    )
  );

-- NOTE: This migration depends on 20260204_create_team_members.sql
-- which must be run first to create the team_members table and the
-- update_team_members_updated_at() function that we reuse here.
--
-- We reuse the generic trigger function from team_members rather than
-- creating a task-specific one to follow DRY principles.
-- The function name is from team_members but it's generic enough to work
-- for any table with an updated_at column.

-- Trigger for updated_at
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_team_members_updated_at();
