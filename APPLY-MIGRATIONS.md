# Apply Database Migrations

## Instructions

1. Open Supabase SQL Editor: https://vzlqpihtmwqjolusyyqw.supabase.co/project/vzlqpihtmwqjolusyyqw/sql/new

2. For each migration below, copy the entire SQL block and click "Run"

3. Apply them IN ORDER (1 → 2 → 3 → 4 → 5)

---

## Migration 1: Create member_segments table

```sql
-- Create member_segments table
CREATE TABLE member_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  segment TEXT NOT NULL CHECK (segment IN ('donor', 'volunteer', 'event_attendee', 'organizer', 'new_member')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  auto_applied BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_member_segment UNIQUE(member_id, segment)
);

CREATE INDEX idx_member_segments_member_id ON member_segments(member_id);
CREATE INDEX idx_member_segments_segment ON member_segments(segment);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON member_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE member_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own segments" ON member_segments
  FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all segments" ON member_segments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Admins can insert segments" ON member_segments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Admins can update segments" ON member_segments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Admins can delete segments" ON member_segments
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );
```

---

## Migration 2: Create team_members table

```sql
-- Create team_members table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  roles TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_team_member UNIQUE(user_id)
);

CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_chapter_id ON team_members(chapter_id);
CREATE INDEX idx_team_members_roles ON team_members USING GIN(roles);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user read own" ON team_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all team members" ON team_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND ('super_admin' = ANY(tm.roles) OR 'national_admin' = ANY(tm.roles))
    )
  );

CREATE POLICY "Allow super admin write" ON team_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND 'super_admin' = ANY(tm.roles)
    )
  );

CREATE OR REPLACE FUNCTION update_team_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_team_members_updated_at();
```

---

## Migration 3: Create tasks table

```sql
-- Create tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project TEXT NOT NULL,
  phase TEXT,
  name TEXT NOT NULL,
  owner UUID REFERENCES team_members(id) ON DELETE SET NULL,
  deliverable TEXT NOT NULL,
  time_estimate_min INTEGER NOT NULL CHECK (time_estimate_min > 0),
  deadline DATE NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3')),
  status TEXT NOT NULL CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE')) DEFAULT 'NOT_STARTED',
  dependencies UUID[] DEFAULT '{}',
  references TEXT[] DEFAULT '{}',
  skill_type TEXT CHECK (skill_type IN ('WRITING', 'DESIGN', 'VIDEO', 'TECHNICAL', 'RESEARCH', 'COORDINATION')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES team_members(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_owner ON tasks(owner);
CREATE INDEX idx_tasks_project ON tasks(project);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_dependencies ON tasks USING GIN(dependencies);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_skill_type ON tasks(skill_type) WHERE skill_type IS NOT NULL;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow team member read" ON tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM team_members WHERE team_members.user_id = auth.uid())
  );

CREATE POLICY "Allow team member create" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM team_members WHERE team_members.user_id = auth.uid())
  );

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

CREATE POLICY "Allow admin delete" ON tasks
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.user_id = auth.uid()
        AND ('super_admin' = ANY(roles) OR 'national_admin' = ANY(roles))
    )
  );

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_team_members_updated_at();
```

---

## Migration 4: Migrate admin_users to team_members

```sql
-- Migrate existing admin_users to team_members
BEGIN;

INSERT INTO team_members (user_id, chapter_id, roles, active, created_at, updated_at)
SELECT
  user_id,
  chapter_id,
  ARRAY[role]::TEXT[],
  true,
  COALESCE(created_at, NOW()),
  NOW()
FROM admin_users
ON CONFLICT (user_id) DO UPDATE SET
  chapter_id = EXCLUDED.chapter_id,
  roles = EXCLUDED.roles,
  updated_at = NOW();

COMMIT;
```

---

## Migration 5: Auto-apply new_member segment

```sql
-- Auto-apply new_member segment
BEGIN;

CREATE INDEX IF NOT EXISTS idx_members_joined_date ON members(joined_date);

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

CREATE OR REPLACE FUNCTION auto_apply_new_member_segment()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.joined_date > NOW() - INTERVAL '90 days' THEN
    INSERT INTO member_segments (member_id, segment, auto_applied)
    VALUES (NEW.id, 'new_member', true)
    ON CONFLICT (member_id, segment) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_new_member_segment ON members;

CREATE TRIGGER auto_new_member_segment
  AFTER INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION auto_apply_new_member_segment();

COMMIT;
```

---

## After Migrations

Once all 5 migrations are applied, refresh http://localhost:3001/workspace and it should load!
