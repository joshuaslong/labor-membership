# Workspace Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the admin dashboard into a role-based organizing workspace with top navigation, contextual sidebars, member segments, team member roles, and VRTF task management.

**Architecture:** Phase-based implementation starting with database schema, then core infrastructure (permissions, role detection), UI primitives (badges, cards), navigation shell, and finally feature-specific pages. Keeps existing `/admin` routes functional while building new `/workspace` routes in parallel.

**Tech Stack:** Next.js 15 (App Router), React 19, Supabase (PostgreSQL + Auth), Tailwind CSS, Server Components

---

## Phase 1: Database Schema & Migrations

### Task 1.1: Create member_segments table

**Files:**
- Create: `supabase/migrations/20260204_create_member_segments.sql`

**Step 1: Write migration SQL**

Create the migration file:

```sql
-- Create member_segments table
CREATE TABLE member_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  segment TEXT NOT NULL CHECK (segment IN ('donor', 'volunteer', 'event_attendee', 'organizer', 'new_member')),
  applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
  applied_by UUID REFERENCES admin_users(id), -- will migrate to team_members later
  auto_applied BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT unique_member_segment UNIQUE(member_id, segment)
);

-- Create index for fast lookups
CREATE INDEX idx_member_segments_member_id ON member_segments(member_id);
CREATE INDEX idx_member_segments_segment ON member_segments(segment);

-- Enable RLS
ALTER TABLE member_segments ENABLE ROW LEVEL SECURITY;

-- RLS policy: authenticated users can read
CREATE POLICY "Allow authenticated read" ON member_segments
  FOR SELECT TO authenticated
  USING (true);

-- RLS policy: admins can insert/update/delete (refine later with team_members)
CREATE POLICY "Allow admin write" ON member_segments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );
```

**Step 2: Run migration locally**

Run: `supabase db push`
Expected: Migration applied successfully

**Step 3: Verify table exists**

Run:
```bash
supabase db query "SELECT table_name FROM information_schema.tables WHERE table_name = 'member_segments';"
```
Expected: Returns `member_segments`

**Step 4: Commit**

```bash
git add supabase/migrations/20260204_create_member_segments.sql
git commit -m "feat(db): create member_segments table

Adds member_segments table to support multiple segments per member.
Segments: donor, volunteer, event_attendee, organizer, new_member."
```

---

### Task 1.2: Create team_members table

**Files:**
- Create: `supabase/migrations/20260204_create_team_members.sql`

**Step 1: Write migration SQL**

```sql
-- Create team_members table (replaces admin_users eventually)
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id), -- link to member record (optional)
  chapter_id UUID REFERENCES chapters(id), -- chapter scope
  roles TEXT[] NOT NULL DEFAULT '{}', -- array of role names
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_team_member UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_chapter_id ON team_members(chapter_id);
CREATE INDEX idx_team_members_roles ON team_members USING GIN(roles); -- for array searches

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can read their own record
CREATE POLICY "Allow user read own" ON team_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- RLS policy: super admins can read/write all
CREATE POLICY "Allow super admin write" ON team_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.user_id = auth.uid()
        AND 'super_admin' = ANY(tm.roles)
    )
  );

-- Function to update updated_at
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

**Step 2: Run migration**

Run: `supabase db push`
Expected: Migration applied successfully

**Step 3: Verify table exists**

Run:
```bash
supabase db query "SELECT table_name FROM information_schema.tables WHERE table_name = 'team_members';"
```
Expected: Returns `team_members`

**Step 4: Commit**

```bash
git add supabase/migrations/20260204_create_team_members.sql
git commit -m "feat(db): create team_members table

Adds team_members table to support both admin roles and functional team member roles.
Supports multiple roles per user via TEXT[] array."
```

---

### Task 1.3: Create tasks table (VRTF)

**Files:**
- Create: `supabase/migrations/20260204_create_tasks.sql`

**Step 1: Write migration SQL**

```sql
-- Create tasks table (VRTF format)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project TEXT NOT NULL, -- groups tasks by plan/initiative
  phase TEXT, -- production phase
  name TEXT NOT NULL, -- task name (action-verb, under 10 words)
  owner UUID REFERENCES team_members(id), -- assigned to (can be null if unassigned)
  deliverable TEXT NOT NULL, -- exact description of deliverable
  time_estimate_min INTEGER NOT NULL, -- estimated minutes
  deadline DATE NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3')),
  status TEXT NOT NULL CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE')) DEFAULT 'NOT_STARTED',
  dependencies UUID[] DEFAULT '{}', -- array of task IDs
  references TEXT[] DEFAULT '{}', -- links or file names
  skill_type TEXT CHECK (skill_type IN ('WRITING', 'DESIGN', 'VIDEO', 'TECHNICAL', 'RESEARCH', 'COORDINATION')),
  notes TEXT, -- block reasons, feedback, context
  created_by UUID NOT NULL REFERENCES team_members(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_tasks_owner ON tasks(owner);
CREATE INDEX idx_tasks_project ON tasks(project);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_dependencies ON tasks USING GIN(dependencies);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS policy: authenticated users can read all tasks (scope by chapter in app logic)
CREATE POLICY "Allow authenticated read" ON tasks
  FOR SELECT TO authenticated
  USING (true);

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

-- Trigger for updated_at
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_team_members_updated_at(); -- reuse same function
```

**Step 2: Run migration**

Run: `supabase db push`
Expected: Migration applied successfully

**Step 3: Verify table exists**

Run:
```bash
supabase db query "SELECT table_name FROM information_schema.tables WHERE table_name = 'tasks';"
```
Expected: Returns `tasks`

**Step 4: Commit**

```bash
git add supabase/migrations/20260204_create_tasks.sql
git commit -m "feat(db): create tasks table for VRTF task management

Implements 7-field VRTF task format with statuses, priorities, dependencies.
Supports volunteer coordination and project tracking."
```

---

### Task 1.4: Migrate existing admin_users to team_members

**Files:**
- Create: `supabase/migrations/20260204_migrate_admin_users.sql`

**Step 1: Write data migration SQL**

```sql
-- Migrate existing admin_users to team_members
INSERT INTO team_members (user_id, chapter_id, roles, created_at, updated_at)
SELECT
  user_id,
  chapter_id,
  ARRAY[role]::TEXT[], -- convert single role to array
  NOW(),
  NOW()
FROM admin_users
ON CONFLICT (user_id) DO NOTHING; -- skip if already exists

-- Note: We keep admin_users table for now to avoid breaking existing code
-- Will deprecate gradually as we migrate to team_members
```

**Step 2: Run migration**

Run: `supabase db push`
Expected: Existing admin records migrated to team_members

**Step 3: Verify migration**

Run:
```bash
supabase db query "SELECT COUNT(*) FROM team_members;"
supabase db query "SELECT COUNT(*) FROM admin_users;"
```
Expected: Both counts match (all admins migrated)

**Step 4: Commit**

```bash
git add supabase/migrations/20260204_migrate_admin_users.sql
git commit -m "feat(db): migrate admin_users to team_members

Copies existing admin records to new team_members table.
Keeps admin_users for backward compatibility during transition."
```

---

### Task 1.5: Auto-apply new_member segment

**Files:**
- Create: `supabase/migrations/20260204_auto_new_member_segment.sql`

**Step 1: Write SQL to auto-apply new_member segment**

```sql
-- Auto-apply 'new_member' segment to members joined < 90 days ago
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

-- Create function to auto-apply new_member on insert
CREATE OR REPLACE FUNCTION auto_apply_new_member_segment()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-apply new_member segment for newly joined members
  IF NEW.joined_date > NOW() - INTERVAL '90 days' THEN
    INSERT INTO member_segments (member_id, segment, auto_applied)
    VALUES (NEW.id, 'new_member', true)
    ON CONFLICT (member_id, segment) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-apply on new member insert
CREATE TRIGGER auto_new_member_segment
  AFTER INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION auto_apply_new_member_segment();
```

**Step 2: Run migration**

Run: `supabase db push`
Expected: new_member segments applied to recent members

**Step 3: Verify auto-application**

Run:
```bash
supabase db query "SELECT COUNT(*) FROM member_segments WHERE segment = 'new_member';"
```
Expected: Count > 0 for recently joined members

**Step 4: Commit**

```bash
git add supabase/migrations/20260204_auto_new_member_segment.sql
git commit -m "feat(db): auto-apply new_member segment

Auto-applies new_member segment to members joined < 90 days.
Includes trigger for automatic application on insert."
```

---

## Phase 2: Core Infrastructure & Utilities

### Task 2.1: Create permission utilities

**Files:**
- Create: `src/lib/permissions.js`

**Step 1: Write permission utility functions**

```javascript
/**
 * Permission utilities for role-based access control
 */

/**
 * Check if user has any of the specified roles
 */
export function hasRole(userRoles, requiredRoles) {
  if (!userRoles || !Array.isArray(userRoles)) return false
  if (!Array.isArray(requiredRoles)) requiredRoles = [requiredRoles]
  return userRoles.some(role => requiredRoles.includes(role))
}

/**
 * Check if user can access a section
 */
export function canAccessSection(userRoles, section) {
  if (!userRoles || !Array.isArray(userRoles)) return false

  // Super admin can access everything
  if (userRoles.includes('super_admin')) return true

  const sectionPermissions = {
    members: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'membership_coordinator', 'data_manager'],
    events: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'event_coordinator'],
    communicate: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'communications_lead'],
    chapters: ['national_admin', 'state_admin', 'county_admin', 'city_admin'],
    resources: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'content_creator'],
    tasks: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'volunteer_manager'],
    admin: ['super_admin', 'national_admin']
  }

  const allowedRoles = sectionPermissions[section]
  if (!allowedRoles) return false

  return hasRole(userRoles, allowedRoles)
}

/**
 * Get chapter scope for user based on roles
 * Returns null for full access, array of chapter IDs for scoped access
 */
export function getChapterScope(userRoles, userChapterId) {
  if (!userRoles || !Array.isArray(userRoles)) return []

  // Full access roles - no filtering
  if (hasRole(userRoles, ['super_admin', 'national_admin'])) {
    return null
  }

  // Geographic admin roles - chapter + descendants (needs RPC call in actual usage)
  if (hasRole(userRoles, ['state_admin', 'county_admin', 'city_admin'])) {
    return { chapterId: userChapterId, includeDescendants: true }
  }

  // Team member roles - only their chapter
  return { chapterId: userChapterId, includeDescendants: false }
}

/**
 * Check if user is admin (any admin role)
 */
export function isAdmin(userRoles) {
  return hasRole(userRoles, ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin'])
}

/**
 * Get highest admin role (for display)
 */
export function getHighestRole(userRoles) {
  const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
  for (const role of roleHierarchy) {
    if (userRoles.includes(role)) return role
  }
  return userRoles[0] || null
}
```

**Step 2: Commit**

```bash
git add src/lib/permissions.js
git commit -m "feat(lib): add permission utilities

Implements role-based access control helpers for sections and chapter scoping."
```

---

### Task 2.2: Create team member data utilities

**Files:**
- Create: `src/lib/teamMember.js`

**Step 1: Write team member utility functions**

```javascript
import { createClient } from '@/lib/supabase/server'

/**
 * Get team member record for current user
 */
export async function getCurrentTeamMember() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: teamMember } = await supabase
    .from('team_members')
    .select('*, chapters(id, name, level)')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  return teamMember
}

/**
 * Get accessible sections for user based on roles
 */
export function getAccessibleSections(roles) {
  if (!roles || !Array.isArray(roles)) return []

  const sections = []

  // Check each section
  const sectionChecks = [
    { name: 'members', roles: ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin', 'membership_coordinator', 'data_manager'] },
    { name: 'events', roles: ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin', 'event_coordinator'] },
    { name: 'communicate', roles: ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin', 'communications_lead'] },
    { name: 'chapters', roles: ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin'] },
    { name: 'resources', roles: ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin', 'content_creator'] },
    { name: 'tasks', roles: ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin', 'volunteer_manager'] },
    { name: 'admin', roles: ['super_admin', 'national_admin'] }
  ]

  for (const check of sectionChecks) {
    if (roles.some(role => check.roles.includes(role))) {
      sections.push(check.name)
    }
  }

  return sections
}

/**
 * Check if user has team member access (any role)
 */
export async function hasTeamMemberAccess() {
  const teamMember = await getCurrentTeamMember()
  return teamMember !== null && teamMember.roles.length > 0
}
```

**Step 2: Commit**

```bash
git add src/lib/teamMember.js
git commit -m "feat(lib): add team member utilities

Server-side helpers for fetching current team member and accessible sections."
```

---

### Task 2.3: Create segment utilities

**Files:**
- Create: `src/lib/segments.js`

**Step 1: Write segment utility functions**

```javascript
/**
 * Segment utilities and constants
 */

export const SEGMENTS = {
  DONOR: 'donor',
  VOLUNTEER: 'volunteer',
  EVENT_ATTENDEE: 'event_attendee',
  ORGANIZER: 'organizer',
  NEW_MEMBER: 'new_member'
}

export const SEGMENT_LABELS = {
  [SEGMENTS.DONOR]: 'Donor',
  [SEGMENTS.VOLUNTEER]: 'Volunteer',
  [SEGMENTS.EVENT_ATTENDEE]: 'Event Attendee',
  [SEGMENTS.ORGANIZER]: 'Organizer',
  [SEGMENTS.NEW_MEMBER]: 'New Member'
}

export const SEGMENT_COLORS = {
  [SEGMENTS.DONOR]: 'text-green-700 bg-green-50 border-green-200',
  [SEGMENTS.VOLUNTEER]: 'text-labor-red bg-red-50 border-red-200',
  [SEGMENTS.EVENT_ATTENDEE]: 'text-amber-700 bg-amber-50 border-amber-200',
  [SEGMENTS.ORGANIZER]: 'text-gray-900 bg-stone-100 border-stone-300',
  [SEGMENTS.NEW_MEMBER]: 'text-blue-700 bg-blue-50 border-blue-200'
}

/**
 * Get segment color classes
 */
export function getSegmentColor(segment) {
  return SEGMENT_COLORS[segment] || 'text-gray-700 bg-stone-50 border-stone-200'
}

/**
 * Get segment label
 */
export function getSegmentLabel(segment) {
  return SEGMENT_LABELS[segment] || segment
}

/**
 * Check if segment is auto-applied (cannot be manually removed)
 */
export function isAutoAppliedSegment(segment, autoApplied) {
  return segment === SEGMENTS.NEW_MEMBER && autoApplied
}
```

**Step 2: Commit**

```bash
git add src/lib/segments.js
git commit -m "feat(lib): add segment utilities

Constants and helpers for member segments including colors and labels."
```

---

## Phase 3: UI Primitives & Design System Components

### Task 3.1: Create SegmentBadge component

**Files:**
- Create: `src/components/SegmentBadge.js`

**Step 1: Write SegmentBadge component**

```javascript
import { getSegmentColor, getSegmentLabel } from '@/lib/segments'

export default function SegmentBadge({ segment }) {
  const colorClasses = getSegmentColor(segment)
  const label = getSegmentLabel(segment)

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClasses}`}>
      {label}
    </span>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/SegmentBadge.js
git commit -m "feat(components): add SegmentBadge component

Displays member segment badges with semantic colors from design system."
```

---

### Task 3.2: Create StatCard component

**Files:**
- Create: `src/components/StatCard.js`

**Step 1: Write StatCard component**

```javascript
export default function StatCard({ label, value, subtext, valueColor = 'text-gray-900' }) {
  return (
    <div className="bg-white border border-stone-200 rounded p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">
        {label}
      </div>
      <div className={`text-2xl font-semibold ${valueColor} tabular-nums`}>
        {value}
      </div>
      {subtext && (
        <div className="text-xs text-gray-600 mt-0.5">
          {subtext}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/StatCard.js
git commit -m "feat(components): add StatCard component

Reusable stat display for workspace home dashboard."
```

---

### Task 3.3: Create QuickActions component

**Files:**
- Create: `src/components/QuickActions.js`

**Step 1: Write QuickActions component**

```javascript
import Link from 'next/link'

export default function QuickActions({ primaryAction, actions = [] }) {
  return (
    <div className="bg-white border border-stone-200 rounded">
      <div className="px-4 py-3 border-b border-stone-200">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Actions</h2>
      </div>
      <div className="p-2">
        {primaryAction && (
          <Link
            href={primaryAction.href}
            className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium bg-labor-red text-white hover:bg-labor-red-600 transition-colors mb-2"
          >
            {primaryAction.icon && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={primaryAction.icon} />
              </svg>
            )}
            {primaryAction.label}
          </Link>
        )}

        <div className="space-y-0.5">
          {actions.map((action, index) => (
            <Link
              key={index}
              href={action.href}
              className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/QuickActions.js
git commit -m "feat(components): add QuickActions component

Role-based quick action list with primary action button."
```

---

### Task 3.4: Create TopNav component

**Files:**
- Create: `src/components/TopNav.js`

**Step 1: Write TopNav component**

```javascript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function TopNav({ sections = [] }) {
  const pathname = usePathname()

  const isActive = (section) => {
    if (section === 'workspace') return pathname === '/workspace'
    return pathname.startsWith(`/${section}`)
  }

  const sectionLabels = {
    workspace: 'Workspace',
    members: 'Members',
    events: 'Events',
    communicate: 'Communicate',
    chapters: 'Chapters',
    resources: 'Resources',
    tasks: 'Tasks',
    admin: 'Admin'
  }

  return (
    <div className="border-b border-stone-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-6">
            <Link href="/workspace" className="text-lg font-semibold text-gray-900">
              Labor Party
            </Link>
            <nav className="flex gap-4">
              {sections.map(section => (
                <Link
                  key={section}
                  href={section === 'workspace' ? '/workspace' : `/${section}`}
                  className={`text-sm font-medium ${
                    isActive(section)
                      ? 'text-labor-red border-b-2 border-labor-red pb-1'
                      : 'text-gray-700 hover:text-gray-900 pb-1'
                  }`}
                >
                  {sectionLabels[section]}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            {/* User menu placeholder */}
            <Link href="/api/auth/logout" className="text-sm text-gray-700 hover:text-gray-900">
              Logout
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/TopNav.js
git commit -m "feat(components): add TopNav component

Main navigation bar with active section highlighting."
```

---

### Task 3.5: Create ContextualSidebar component

**Files:**
- Create: `src/components/ContextualSidebar.js`

**Step 1: Write ContextualSidebar component**

```javascript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function ContextualSidebar({ items = [] }) {
  const pathname = usePathname()

  const isActive = (href) => pathname === href

  return (
    <div className="w-60 bg-white border-r border-stone-200 min-h-screen">
      <div className="p-4 space-y-1">
        {items.map((item, index) => {
          if (item.type === 'header') {
            return (
              <div key={index} className="text-xs uppercase tracking-wide text-gray-500 font-medium px-3 py-2 mt-4 first:mt-0">
                {item.label}
              </div>
            )
          }

          if (item.type === 'divider') {
            return <div key={index} className="border-t border-stone-200 my-2" />
          }

          return (
            <Link
              key={index}
              href={item.href}
              className={`block px-3 py-1.5 text-sm rounded ${
                isActive(item.href)
                  ? 'bg-stone-100 text-gray-900 font-medium'
                  : 'text-gray-700 hover:bg-stone-50'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/ContextualSidebar.js
git commit -m "feat(components): add ContextualSidebar component

Reusable contextual sidebar for section navigation and filters."
```

---

## Phase 4: Workspace Home Page

### Task 4.1: Create workspace route structure

**Files:**
- Create: `src/app/workspace/page.js`
- Create: `src/app/workspace/layout.js`

**Step 1: Create workspace layout with TopNav**

File: `src/app/workspace/layout.js`

```javascript
import TopNav from '@/components/TopNav'
import { getCurrentTeamMember, getAccessibleSections } from '@/lib/teamMember'
import { redirect } from 'next/navigation'

export default async function WorkspaceLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember) {
    redirect('/login')
  }

  const sections = ['workspace', ...getAccessibleSections(teamMember.roles)]

  return (
    <div className="min-h-screen bg-stone-50">
      <TopNav sections={sections} />
      {children}
    </div>
  )
}
```

**Step 2: Create basic workspace home page**

File: `src/app/workspace/page.js`

```javascript
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import StatCard from '@/components/StatCard'
import QuickActions from '@/components/QuickActions'

export default async function WorkspacePage() {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember) {
    redirect('/login')
  }

  // Placeholder stats - will implement role-specific logic later
  const stats = [
    { label: 'Members', value: '0', subtext: 'Loading...' },
    { label: 'Pending', value: '0', subtext: 'Loading...' },
    { label: 'Events', value: '0', subtext: 'Loading...' },
    { label: 'Tasks', value: '0', subtext: 'Loading...' }
  ]

  const primaryAction = {
    label: 'Import Members',
    href: '/members/import',
    icon: 'M12 4v16m8-8H4'
  }

  const actions = [
    { label: 'View Members', href: '/members' },
    { label: 'Create Event', href: '/events/new' },
    { label: 'Send Email', href: '/communicate' },
    { label: 'View Tasks', href: '/tasks' }
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">ORGANIZING WORKSPACE</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Stats and recent activity - 2/3 width */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 mb-6">
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>

          {/* Recent members placeholder */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Recent Members</h2>
            </div>
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              Coming soon
            </div>
          </div>
        </div>

        {/* Quick actions - 1/3 width */}
        <div>
          <QuickActions primaryAction={primaryAction} actions={actions} />
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Test the route**

Run: `npm run dev`
Navigate to: `http://localhost:3000/workspace`
Expected: Workspace page loads with placeholder stats and quick actions

**Step 4: Commit**

```bash
git add src/app/workspace/layout.js src/app/workspace/page.js
git commit -m "feat(workspace): create workspace home page

Basic workspace layout with TopNav and placeholder stats.
Role-based section visibility implemented."
```

---

### Task 4.2: Implement role-specific workspace stats

**Files:**
- Create: `src/lib/workspaceStats.js`
- Modify: `src/app/workspace/page.js`

**Step 1: Create workspace stats utility**

File: `src/lib/workspaceStats.js`

```javascript
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { hasRole } from '@/lib/permissions'

/**
 * Get stats for workspace home based on user role
 */
export async function getWorkspaceStats(teamMember) {
  const supabase = createAdminClient()
  const roles = teamMember.roles

  // Determine if user has full access
  const hasFullAccess = hasRole(roles, ['super_admin', 'national_admin'])

  // Build chapter filter
  let chapterFilter = null
  if (!hasFullAccess && teamMember.chapter_id) {
    // For geographic admins, get chapter + descendants
    if (hasRole(roles, ['state_admin', 'county_admin', 'city_admin'])) {
      const { data: descendants } = await supabase
        .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
      chapterFilter = descendants?.map(d => d.id) || [teamMember.chapter_id]
    } else {
      // For team members, just their chapter
      chapterFilter = [teamMember.chapter_id]
    }
  }

  // Get member counts
  let memberQuery = supabase.from('members').select('id, chapter_id', { count: 'exact', head: true })
  if (chapterFilter) {
    memberQuery = memberQuery.in('chapter_id', chapterFilter)
  }
  const { count: memberCount } = await memberQuery

  // Get pending member count
  let pendingQuery = supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  if (chapterFilter) {
    pendingQuery = pendingQuery.in('chapter_id', chapterFilter)
  }
  const { count: pendingCount } = await pendingQuery

  // Get event count (upcoming this month)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  let eventQuery = supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .gte('start_time', startOfMonth.toISOString())
  if (chapterFilter) {
    eventQuery = eventQuery.in('chapter_id', chapterFilter)
  }
  const { count: eventCount } = await eventQuery

  // Get task count (assigned to user)
  const { count: taskCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('owner', teamMember.id)
    .neq('status', 'DONE')

  return {
    members: memberCount || 0,
    pending: pendingCount || 0,
    events: eventCount || 0,
    tasks: taskCount || 0
  }
}
```

**Step 2: Update workspace page to use real stats**

File: `src/app/workspace/page.js` - replace stats section:

```javascript
import { getWorkspaceStats } from '@/lib/workspaceStats'

// ... inside WorkspacePage function
const statsData = await getWorkspaceStats(teamMember)

const stats = [
  { label: 'Members', value: statsData.members, subtext: `${statsData.pending} pending` },
  { label: 'Pending', value: statsData.pending, subtext: 'Need review', valueColor: 'text-amber-600' },
  { label: 'Events', value: statsData.events, subtext: 'This month' },
  { label: 'Tasks', value: statsData.tasks, subtext: 'Assigned to you' }
]
```

**Step 3: Test with real data**

Run: `npm run dev`
Navigate to: `http://localhost:3000/workspace`
Expected: Real counts displayed based on user's permissions

**Step 4: Commit**

```bash
git add src/lib/workspaceStats.js src/app/workspace/page.js
git commit -m "feat(workspace): implement role-specific stats

Real member, event, and task counts based on chapter scope."
```

---

## Phase 5: Members Section with Segments

### Task 5.1: Create members route with sidebar

**Files:**
- Create: `src/app/members/layout.js`
- Modify: `src/app/members/page.js`

**Step 1: Create members layout with contextual sidebar**

File: `src/app/members/layout.js`

```javascript
import ContextualSidebar from '@/components/ContextualSidebar'
import TopNav from '@/components/TopNav'
import { getCurrentTeamMember, getAccessibleSections } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection } from '@/lib/permissions'

export default async function MembersLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'members')) {
    redirect('/workspace')
  }

  const sections = ['workspace', ...getAccessibleSections(teamMember.roles)]

  const sidebarItems = [
    { type: 'link', label: 'All Members', href: '/members' },
    { type: 'link', label: 'Pending Approval', href: '/members?status=pending' },
    { type: 'header', label: 'By Segment' },
    { type: 'link', label: 'Donors', href: '/members?segment=donor' },
    { type: 'link', label: 'Volunteers', href: '/members?segment=volunteer' },
    { type: 'link', label: 'Event Attendees', href: '/members?segment=event_attendee' },
    { type: 'link', label: 'Organizers', href: '/members?segment=organizer' },
    { type: 'link', label: 'New Members', href: '/members?segment=new_member' },
    { type: 'divider' },
    { type: 'link', label: 'Import Members', href: '/admin/import' }
  ]

  return (
    <div className="min-h-screen bg-stone-50">
      <TopNav sections={sections} />
      <div className="flex">
        <ContextualSidebar items={sidebarItems} />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**Step 2: Update members page to show segments**

File: `src/app/members/page.js` - update to include segments:

```javascript
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import SegmentBadge from '@/components/SegmentBadge'

export default async function MembersPage({ searchParams }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const supabase = createAdminClient()

  // Build query with filters
  let query = supabase
    .from('members')
    .select(`
      id,
      first_name,
      last_name,
      email,
      joined_date,
      chapter_id,
      chapters(name),
      member_segments(segment, auto_applied)
    `)
    .order('joined_date', { ascending: false })
    .limit(50)

  // Filter by segment if specified
  if (searchParams?.segment) {
    query = query.filter('member_segments.segment', 'eq', searchParams.segment)
  }

  // Filter by status if specified
  if (searchParams?.status) {
    query = query.eq('status', searchParams.status)
  }

  const { data: members } = await query

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Members</h1>
      </div>

      <div className="bg-white border border-stone-200 rounded overflow-hidden">
        <table className="min-w-full divide-y divide-stone-200">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Segments</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Chapter</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {members?.map(member => (
              <tr key={member.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {member.first_name} {member.last_name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{member.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {member.member_segments?.map((seg, idx) => (
                      <SegmentBadge key={idx} segment={seg.segment} />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{member.chapters?.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                  {new Date(member.joined_date).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 3: Test members page**

Run: `npm run dev`
Navigate to: `http://localhost:3000/members`
Expected: Member list with segments displayed, sidebar with filters

**Step 4: Commit**

```bash
git add src/app/members/layout.js src/app/members/page.js
git commit -m "feat(members): add members section with segment display

Members page with contextual sidebar and segment badges."
```

---

## Phase 6: Tasks Section (VRTF)

### Task 6.1: Create tasks route with list view

**Files:**
- Create: `src/app/tasks/layout.js`
- Create: `src/app/tasks/page.js`

**Step 1: Create tasks layout**

File: `src/app/tasks/layout.js`

```javascript
import ContextualSidebar from '@/components/ContextualSidebar'
import TopNav from '@/components/TopNav'
import { getCurrentTeamMember, getAccessibleSections } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection } from '@/lib/permissions'

export default async function TasksLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'tasks')) {
    redirect('/workspace')
  }

  const sections = ['workspace', ...getAccessibleSections(teamMember.roles)]

  const sidebarItems = [
    { type: 'link', label: 'My Tasks', href: '/tasks?owner=me' },
    { type: 'link', label: 'All Tasks', href: '/tasks' },
    { type: 'header', label: 'By Status' },
    { type: 'link', label: 'Not Started', href: '/tasks?status=NOT_STARTED' },
    { type: 'link', label: 'In Progress', href: '/tasks?status=IN_PROGRESS' },
    { type: 'link', label: 'Blocked', href: '/tasks?status=BLOCKED' },
    { type: 'link', label: 'In Review', href: '/tasks?status=IN_REVIEW' },
    { type: 'link', label: 'Done', href: '/tasks?status=DONE' },
    { type: 'header', label: 'By Priority' },
    { type: 'link', label: 'P1 - Critical', href: '/tasks?priority=P1' },
    { type: 'link', label: 'P2 - High', href: '/tasks?priority=P2' },
    { type: 'link', label: 'P3 - Standard', href: '/tasks?priority=P3' },
    { type: 'divider' },
    { type: 'link', label: 'Create Task', href: '/tasks/new' }
  ]

  return (
    <div className="min-h-screen bg-stone-50">
      <TopNav sections={sections} />
      <div className="flex">
        <ContextualSidebar items={sidebarItems} />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**Step 2: Create tasks list page**

File: `src/app/tasks/page.js`

```javascript
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'

export default async function TasksPage({ searchParams }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const supabase = createAdminClient()

  // Build query
  let query = supabase
    .from('tasks')
    .select(`
      id,
      name,
      status,
      priority,
      deadline,
      phase,
      time_estimate_min,
      owner:team_members(id, member:members(first_name, last_name))
    `)
    .order('deadline', { ascending: true })
    .limit(50)

  // Filter by owner if specified
  if (searchParams?.owner === 'me') {
    query = query.eq('owner', teamMember.id)
  }

  // Filter by status if specified
  if (searchParams?.status) {
    query = query.eq('status', searchParams.status)
  }

  // Filter by priority if specified
  if (searchParams?.priority) {
    query = query.eq('priority', searchParams.priority)
  }

  const { data: tasks } = await query

  const priorityColors = {
    P1: 'text-red-700 bg-red-50 border-red-200',
    P2: 'text-amber-700 bg-amber-50 border-amber-200',
    P3: 'text-gray-700 bg-stone-50 border-stone-200'
  }

  const statusColors = {
    NOT_STARTED: 'text-gray-700 bg-stone-50 border-stone-200',
    IN_PROGRESS: 'text-blue-700 bg-blue-50 border-blue-200',
    BLOCKED: 'text-red-700 bg-red-50 border-red-200',
    IN_REVIEW: 'text-amber-700 bg-amber-50 border-amber-200',
    DONE: 'text-green-700 bg-green-50 border-green-200'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Tasks</h1>
        <a
          href="/tasks/new"
          className="px-4 py-2 bg-labor-red text-white rounded font-medium hover:bg-labor-red-600"
        >
          Create Task
        </a>
      </div>

      <div className="bg-white border border-stone-200 rounded overflow-hidden">
        <table className="min-w-full divide-y divide-stone-200">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Task</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Deadline</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Est. Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {tasks?.map(task => (
              <tr key={task.id} className="hover:bg-stone-50">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{task.name}</div>
                  {task.phase && <div className="text-xs text-gray-500">{task.phase}</div>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {task.owner?.member ? `${task.owner.member.first_name} ${task.owner.member.last_name}` : 'Unassigned'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusColors[task.status]}`}>
                    {task.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${priorityColors[task.priority]}`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                  {new Date(task.deadline).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                  {Math.floor(task.time_estimate_min / 60)}h {task.time_estimate_min % 60}m
                </td>
              </tr>
            ))}
            {(!tasks || tasks.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  No tasks found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 3: Test tasks page**

Run: `npm run dev`
Navigate to: `http://localhost:3000/tasks`
Expected: Tasks list with status/priority badges, sidebar filters

**Step 4: Commit**

```bash
git add src/app/tasks/layout.js src/app/tasks/page.js
git commit -m "feat(tasks): add tasks section with VRTF list view

Task list with status, priority, and owner display. Sidebar filtering."
```

---

## Implementation Notes

This plan covers the **foundational phases** of the workspace redesign:

**Phase 1:** Database schema (member_segments, team_members, tasks tables)
**Phase 2:** Core infrastructure (permissions, team member utilities)
**Phase 3:** UI primitives (badges, stat cards, navigation components)
**Phase 4:** Workspace home page with role-based stats
**Phase 5:** Members section with segment display
**Phase 6:** Tasks section with VRTF task list

**Remaining work (not in this plan):**

- Events, Communicate, Chapters, Resources sections
- Task creation/editing forms
- Member segment management UI
- Team member management (Admin section)
- Role-specific workspace personalization (9 different views)
- Kanban board view for tasks
- Advanced filtering and search
- Route migration from /admin to /workspace

**Testing Strategy:**

Each task includes verification steps. After completing each phase:
1. Run `npm run dev` and manually test the UI
2. Verify database changes with `supabase db query`
3. Test with different user roles (create test team members)

**Deployment:**

After completing all phases, deploy to staging with:
```bash
git push origin feature/workspace-redesign
# Create PR, review, merge
# Deploy to staging: vercel --prod
```

---

**End of Implementation Plan**
