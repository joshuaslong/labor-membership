# Workspace Redesign - Design Document

**Date:** February 4, 2026
**Project:** Labor Membership Platform
**Status:** Design Complete - Ready for Implementation

---

## Overview

This document defines a complete redesign of the organizing workspace (formerly "Admin Dashboard") for the Labor Membership Platform. The redesign addresses critical usability issues while introducing new capabilities for team member roles, member segments, and task management.

### Goals

1. **Solve navigation overload** - Reduce cognitive load from 14+ sidebar links
2. **Improve information hierarchy** - Prioritize what matters for each role
3. **Increase workflow efficiency** - Common tasks require fewer clicks
4. **Create logical organization** - Group features by function, not alphabetically
5. **Support diverse roles** - Personalize for admins and specialized team members
6. **Enable task coordination** - Implement VRTF task management system

---

## Problems Solved

### Current State Issues

**Navigation Overload**
- 14+ links in a single sidebar list
- No visual hierarchy or grouping
- Hard to scan and find what you need

**Poor Information Hierarchy**
- Everything weighted equally
- No distinction between primary and secondary actions
- Stats don't match role priorities

**Workflow Inefficiency**
- Common tasks buried in long lists
- No role-based shortcuts
- Same interface for all users regardless of needs

**Unclear Organization**
- Features listed alphabetically or randomly
- No functional grouping
- Doesn't match organizing workflows

### Solution Approach

**Hybrid Navigation System**
- Top nav for 6 major functional areas
- Contextual sidebars within each area
- Direct to main view (no intermediate pages)

**Role-Based Personalization**
- Different workspace views for different roles
- Relevant stats and actions for each person
- Chapter-scoped access for team members

**Functional Grouping**
- Organize by workflow (Members, Events, Communicate, etc.)
- Specialized tools grouped logically
- Clear separation of system admin functions

---

## Navigation Structure

### Top Navigation Bar

Always visible across the platform:

```
┌─────────────────────────────────────────────────────────────────┐
│ [Logo/Org] | Members Events Communicate Chapters Resources Tasks Admin | [User Menu] │
└─────────────────────────────────────────────────────────────────┘
```

**Sections:**
1. **Members** - Member management, segments, import
2. **Events** - Event coordination, RSVPs, calendar
3. **Communicate** - Email campaigns, templates, history
4. **Chapters** - Chapter hierarchy, geographic organization
5. **Resources** - Files, documents, shared materials
6. **Tasks** - VRTF task management system
7. **Admin** - System tools (conditional: super/national admins only)

**Behavior:**
- Clicking a section → direct to main view (e.g., Members → member list)
- Contextual sidebar appears with filters, sub-sections, actions
- No intermediate landing pages (except Workspace home)

### Workspace Home

Default landing page when logging in. Shows personalized dashboard based on role.

**Path:** `/workspace` (replaces `/admin`)

---

## User Roles & Permissions

### Admin Roles (Geographic Hierarchy)

Full access within their geographic scope:

| Role | Scope | Access |
|------|-------|--------|
| **Super Admin** | Organization-wide | All features, all chapters, system settings |
| **National Admin** | Organization-wide | All features except system settings |
| **State Admin** | State + descendants | All features for their state and below |
| **County Admin** | County + descendants | All features for their county and below |
| **City Admin** | City chapter only | All features for their chapter |

### Team Member Roles (Functional Access)

Chapter-scoped roles with specific functional access. Multiple roles per person allowed.

| Role | Access | Permissions |
|------|--------|-------------|
| **Communications Lead** | Communicate, Email Templates | Send emails, manage templates, view history |
| **Event Coordinator** | Events | Create/manage events, view RSVPs, manage calendar |
| **Volunteer Manager** | Tasks, Members (view) | Create/assign tasks, view volunteer list |
| **Membership Coordinator** | Members | Approve members, import, manage segments |
| **Data Manager** | Members, Chapters | View/export data (read-only) |
| **Content Creator** | Resources | Upload/manage files and documents |

**Chapter Scoping:**
- Team members are assigned to a specific chapter
- They only see/access data for their chapter
- Cannot access other chapters' data

**Multiple Roles:**
- A team member can have multiple roles (e.g., Event Coordinator + Communications Lead)
- Their workspace combines stats and actions from all their roles
- Navigation shows all sections they can access

---

## Member Segments

### Concept

Replaces the single "status" field (active/inactive/pending) with multiple segments per member. Members can be tagged with any combination of segments.

**Why:** More meaningful categorization for organizing. A member can be both a Donor and a Volunteer and an Event Attendee.

### Predefined Segments

| Segment | Description | Application |
|---------|-------------|-------------|
| **Donor** | Has made financial contribution | Manual or auto-applied on payment |
| **Volunteer** | Actively volunteers / takes tasks | Manual assignment |
| **Event Attendee** | Attends events | Manual or auto-applied on RSVP |
| **Organizer** | Active in organizing efforts | Manual assignment |
| **New Member** | Recently joined | Auto-applied for 90 days after join date |

### Visual Design

**Segment Badges:**
- Small pill badges with semantic colors
- Multiple badges per member (in table and detail views)

```
Donor: text-green-700 bg-green-50 border-green-200
Volunteer: text-labor-red bg-red-50 border-red-200
Event Attendee: text-amber-700 bg-amber-50 border-amber-200
Organizer: text-gray-900 bg-stone-100 border-stone-300
New Member: text-blue-700 bg-blue-50 border-blue-200
```

### Filtering & Management

**Sidebar Filtering:**
- Click "Donors" → shows all members with Donor segment
- Multi-select to show members with ANY selected segments

**Bulk Management:**
- Select multiple members → "Add Segment" or "Remove Segment"
- Useful for bulk operations (e.g., event attendees → add Volunteer)

**Individual Member:**
- Checkbox list to add/remove segments
- New Member segment is auto-applied, not removable until 90 days

**Future:** Allow custom segments (not in initial implementation)

---

## Workspace Home Page

### Layout: Balanced Side-by-Side

```
┌─────────────────────────────────────────────────────────┐
│ Header: "ORGANIZING WORKSPACE"                          │
├──────────────────────────────┬──────────────────────────┤
│                              │                          │
│  Stats Grid (2/3 width)      │  Quick Actions (1/3)     │
│                              │                          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐│  [Primary Action Btn]    │
│  │Stat│ │Stat│ │Stat│ │Stat││                          │
│  │  1 │ │  2 │ │  3 │ │  4 ││  - Action link           │
│  └────┘ └────┘ └────┘ └────┘│  - Action link           │
│                              │  - Action link           │
│  Recent Members List         │  - Action link           │
│  ┌──────────────────────────┐│  - Action link           │
│  │ Member 1                 ││  - Action link           │
│  │ Member 2                 ││                          │
│  │ Member 3                 ││                          │
│  └──────────────────────────┘│                          │
│                              │                          │
└──────────────────────────────┴──────────────────────────┘
```

### Personalization by Role

Different roles see different stats and quick actions:

---

#### Chapter/City Admin View

**Stats Grid (4 stats):**
1. **Members** - Total members in chapter | Active count
2. **Pending** - Pending members needing approval | "Need review"
3. **Events** - Upcoming events this month | Next event date
4. **Tasks** - Tasks assigned to them | Due this week

**Quick Actions:**
- 🔴 **Approve Members** (if pending > 0, else "Import Members")
- Send Email to Chapter
- Create Event
- View My Tasks
- View Chapter Members
- Files & Resources

**Recent Members:** Last 5 members joined (chapter-scoped)

---

#### Regional Admin (State/County) View

**Stats Grid:**
1. **Members** - Total across region | Growth this month
2. **Chapters** - Chapters in region | Active count
3. **Events** - Regional events this month | Cross-chapter events
4. **Tasks** - Regional coordination tasks | Due this week

**Quick Actions:**
- 🔴 **Import Members**
- Send Regional Email
- Create Regional Event
- View Chapter Health
- View All Tasks
- Coordinate Chapters

**Recent Members:** Last 5 members across region

---

#### National/Super Admin View

**Stats Grid:**
1. **Members** - Organization-wide | Growth trend
2. **Chapters** - Total chapters | By level breakdown (state/county/city)
3. **Revenue** - Total contributions | This month
4. **Initiatives** - Active initiatives | Completion status

**Quick Actions:**
- 🔴 **Import Members**
- Send National Email
- Manage Initiatives
- View All Tasks
- Sync Payments
- System Admin Tools

**Recent Members:** Last 5 members organization-wide

---

#### Team Member - Event Coordinator

**Stats Grid:**
1. **Upcoming Events** - Next 30 days | Chapter events
2. **RSVPs** - Total RSVPs this month | Avg per event
3. **Event Tasks** - Tasks for events | Due this week
4. **Chapter Members** - Total in chapter | Event attendees

**Quick Actions:**
- 🔴 **Create Event**
- View Event RSVPs
- Manage Event Tasks
- Chapter Calendar
- Event Attendee List

**Recent Activity:** Last 5 event RSVPs

---

#### Team Member - Communications Lead

**Stats Grid:**
1. **Emails Sent** - This month | Total sends
2. **Open Rate** - Average open rate | Last campaign
3. **Chapter Members** - Total recipients | By segment
4. **Scheduled** - Scheduled emails | Next send date

**Quick Actions:**
- 🔴 **Send Email**
- Manage Templates
- View Email History
- Chapter Contacts
- Email Preferences

**Recent Activity:** Last 5 sent emails

---

#### Team Member - Volunteer Manager

**Stats Grid:**
1. **Active Volunteers** - Chapter volunteers | With tasks
2. **Tasks Due** - Due this week | Overdue
3. **Completed Tasks** - This month | Total
4. **Completion Rate** - % on-time completion | Avg time

**Quick Actions:**
- 🔴 **Create Task**
- Assign Tasks
- View All Tasks
- Volunteer List
- Task Reports

**Recent Activity:** Last 5 completed tasks

---

#### Team Member - Membership Coordinator

**Stats Grid:**
1. **Total Members** - Chapter members | By segment
2. **Pending** - Need approval | Avg approval time
3. **New This Month** - New members | Growth rate
4. **Segments** - Donors, Volunteers, etc. | Breakdown

**Quick Actions:**
- 🔴 **Approve Members**
- Import Members
- Manage Segments
- View Member List
- Member Reports

**Recent Activity:** Last 5 member approvals

---

#### Team Member - Multiple Roles

**Stats Grid:** Combined view showing relevant stats from each role (max 4 most important)

**Quick Actions:** Combined actions from all roles (most frequently used at top)

**Recent Activity:** Mixed feed from all role activities

---

## Section Details

### Members Section

**Path:** `/members`

**Contextual Sidebar:**
- All Members
- Pending Approval
- By Segment (expandable):
  - Donors
  - Volunteers
  - Event Attendees
  - Organizers
  - New Members
- Import Members
- Manage Segments

**Main View: Member List**

Table columns:
- Name (first, last)
- Email
- Segments (multiple badges)
- Chapter
- Joined Date
- Actions (View, Edit)

**Features:**
- Search by name/email
- Filter by segment(s), chapter, join date
- Bulk actions: Add/Remove segments, Export
- Sort by any column

**Individual Member Page:**
- Member details (name, email, phone, address, etc.)
- Segment badges with "Manage Segments" button
- Chapter associations
- Activity history (events attended, emails received, tasks completed)
- Edit member info
- Notes/comments

**Pending Approval View:**
- Similar table but only pending members
- Bulk approve/reject
- Individual review with approve/reject buttons

**Import Members:**
- CSV upload
- Field mapping
- Validation and error handling
- Auto-apply segments based on CSV data

**Manage Segments:**
- List of all segments with member counts
- Create custom segments (future)
- Archive unused segments (future)

---

### Events Section

**Path:** `/events`

**Contextual Sidebar:**
- All Events
- Upcoming Events
- Past Events
- By Type (if event types exist)
- Create Event
- Calendar View

**Main View: Event List**

Table columns:
- Event Name
- Date/Time
- Location
- RSVPs (count)
- Status (Upcoming, In Progress, Completed, Cancelled)
- Actions (View, Edit, Manage RSVPs)

**Calendar View:**
- Monthly calendar with events
- Click event to view details
- Drag to reschedule (if permissions allow)

**Individual Event Page:**
- Event details (name, date, time, location, description)
- RSVP list with member details
- Export RSVP list
- Send email to attendees
- Edit event
- Cancel event

**Create Event:**
- Form with event details
- Option to create associated tasks (VRTF format) for event promotion
- Send announcement email on creation

---

### Communicate Section

**Path:** `/communicate`

**Contextual Sidebar:**
- Send Email
- Sent Emails (history)
- Scheduled Emails
- Email Templates (if admin/super admin)
- Email Preferences

**Main View: Send Email**

Email composition interface:
- Recipient selector (by chapter, segment, group, custom list)
- Subject line
- Email body (rich text editor)
- Template selector (load pre-made template)
- Preview mode
- Schedule send (optional)
- Test send (to yourself)
- Send button

**Sent Emails:**
- Table of sent emails with subject, recipients count, send date, open rate
- Click to view details and analytics

**Email Templates:**
- List of templates (welcome email, event confirmation, etc.)
- Create/edit templates
- Template variables ({{first_name}}, {{chapter_name}}, etc.)
- Preview templates

---

### Chapters Section

**Path:** `/chapters`

**Contextual Sidebar:**
- All Chapters
- By Level:
  - State
  - County
  - City
- Create Chapter (if super admin)
- Map View

**Main View: Chapter List**

Table columns:
- Chapter Name
- Level (State, County, City)
- Parent Chapter
- Members (count)
- Active (yes/no)
- Actions (View, Edit)

**Individual Chapter Page:**
- Chapter details (name, level, parent, location)
- Member list (chapter-scoped)
- Chapter admins/team members
- Chapter stats (members, events, activity)
- Edit chapter
- View descendants (state → counties → cities)

**Map View:**
- Geographic map showing chapter locations
- Click chapter to view details
- Filter by level

**Create Chapter:**
- Form with chapter details
- Select parent chapter
- Assign level (state/county/city)
- Assign initial admin

---

### Resources Section

**Path:** `/resources`

**Contextual Sidebar:**
- All Files
- Recent Uploads
- By Type (Documents, Images, Videos, etc.)
- Upload File
- Categories (if organized by category)

**Main View: File List**

Table/grid view:
- File name
- Type (icon or badge)
- Size
- Uploaded by
- Upload date
- Actions (Download, Preview, Delete)

**Upload File:**
- Drag-and-drop or file picker
- Multiple file upload
- Auto-detect file type
- Add description/tags

**File Preview:**
- Modal showing file preview (if supported type)
- Download button
- Share link
- Edit details
- Delete

---

### Tasks Section (VRTF)

**Path:** `/tasks`

**Contextual Sidebar:**
- My Tasks
- All Tasks
- By Status:
  - Not Started
  - In Progress
  - Blocked
  - In Review
  - Done
- By Priority (P1/P2/P3)
- By Phase
- Create Task

**Main View: Task List (Default)**

Table columns:
- Task Name (clickable)
- Owner (avatar + name)
- Status (badge: NOT_STARTED | IN_PROGRESS | BLOCKED | IN_REVIEW | DONE)
- Priority (badge: P1 Critical / P2 High / P3 Standard)
- Deadline (date, highlight if overdue)
- Phase (project phase)
- Time Est. (hours/minutes)
- Actions (View, Edit, Mark Done)

**Color coding:**
- P1 Critical: text-red-700 bg-red-50 border-red-200
- P2 High: text-amber-700 bg-amber-50 border-amber-200
- P3 Standard: text-gray-700 bg-stone-50 border-stone-200

**Board View (Kanban):**
- 5 columns for statuses
- Drag tasks between columns to update status
- Grouped by priority within each column
- Filter by phase, owner, priority

**Task Detail Modal/Panel:**

Shows all 7 VRTF fields:
- **Task Name** (editable)
- **Owner** (dropdown to assign/reassign)
- **Deliverable** (textarea with detailed description of what gets handed in)
- **Time Estimate** (number input, minutes → display as hours/minutes)
- **Deadline** (date picker)
- **Dependencies** (multi-select of other tasks that must complete first)
- **Reference Materials** (links or file uploads)
- **Status** (dropdown)
- **Priority** (P1/P2/P3 selector)
- **Phase** (text input or dropdown if phases are predefined)
- **Notes** (textarea for blocks, feedback, context)

**Actions:**
- Save
- Mark as Done (updates status to DONE)
- Delete Task
- Duplicate Task

**Create Task:**
- Form with all 7 VRTF fields
- Owner defaults to creator (can reassign)
- Status defaults to NOT_STARTED
- Deadline required
- Dependencies optional
- Reference materials optional

**Notifications (future):**
- Task assigned → notify owner
- 48 hours before deadline → reminder
- Deadline passed + not done → alert coordinator
- Status → BLOCKED → alert coordinator
- Dependency completed → notify dependent task owner

---

### Admin Section

**Path:** `/admin`

**Visibility:** Super Admin and National Admin only

**Contextual Sidebar:**
- Team Management
- Email Templates
- Payment Sync
- Import Tools
- System Settings
- Audit Logs (future)

---

#### Team Management

**Path:** `/admin/team`

List of all users with admin or team member roles:

Table columns:
- Name
- Email
- Roles (badges for each role)
- Chapter (for team members)
- Status (Active, Inactive)
- Actions (Edit, Deactivate)

**Add New User:**
- Email (must match existing member email, or create member first)
- Role selection:
  - Admin: Select level (super/national/state/county/city) + chapter
  - Team Member: Multi-select roles + assign chapter
- Activate immediately or send invitation

**Edit User:**
- Change roles
- Change chapter assignment
- Deactivate/reactivate

---

#### Email Templates

**Path:** `/admin/email-templates`

List of system email templates:

- Welcome Email
- Event Confirmation
- Event Reminder
- Password Reset
- Membership Renewal
- Custom templates

**Edit Template:**
- Subject line (can use variables)
- Body (rich text, can use variables)
- Template variables: {{first_name}}, {{last_name}}, {{chapter_name}}, {{event_name}}, {{event_date}}, etc.
- Preview with sample data
- Test send

---

#### Payment Sync

**Path:** `/admin/sync-payments`

Sync Stripe payments to member records:

- Last sync date/time
- Sync status (in progress, completed, error)
- Manual sync button
- Auto-sync toggle (daily, weekly, manual only)
- Sync history table (date, payments synced, errors)

**Behavior:**
- Fetches Stripe payments since last sync
- Matches to members by email
- Creates payment records
- Auto-applies "Donor" segment to members with successful payments
- Logs errors for unmatched payments

---

#### Import Tools

**Path:** `/admin/import`

Bulk import utilities beyond regular member import:

- Import chapters (CSV)
- Import events (CSV)
- Import payments (CSV)
- Import tasks (CSV - VRTF format)

Each with:
- Template download
- Field mapping
- Validation
- Error reporting
- Import history

---

#### System Settings

**Path:** `/admin/settings`

Organization-level settings:

**Organization Info:**
- Organization name
- Logo upload
- Contact email
- Website URL

**Branding:**
- Primary color (labor-red customization)
- Secondary colors
- Font choices (if customizable)

**Feature Flags:**
- Enable/disable sections (Events, Polls, Initiatives, etc.)
- Enable custom segments
- Enable task notifications

**Chapter Hierarchy:**
- Add/edit/delete chapter levels (state, county, city)
- Define geographic boundaries
- Set chapter name patterns

---

## Page Layout Pattern

Every section follows this consistent structure:

```
┌─────────────────────────────────────────────────────────┐
│ Top Nav: Logo | Members Events Communicate... | User    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────────────────────────────┐   │
│  │          │  │                                  │   │
│  │ Context  │  │  Main Content Area               │   │
│  │ Sidebar  │  │                                  │   │
│  │          │  │  ┌────────────────────────────┐ │   │
│  │ - Link 1 │  │  │ SECTION HEADER             │ │   │
│  │ - Link 2 │  │  │ [Action Btn] [Action Btn]  │ │   │
│  │ - Link 3 │  │  └────────────────────────────┘ │   │
│  │ ──────── │  │                                  │   │
│  │ - Filter │  │  Table or card grid:             │   │
│  │ - Filter │  │  ┌────────────────────────────┐ │   │
│  │          │  │  │ Row 1                      │ │   │
│  │ ──────── │  │  │ Row 2                      │ │   │
│  │ [Action] │  │  │ Row 3                      │ │   │
│  │          │  │  └────────────────────────────┘ │   │
│  │          │  │                                  │   │
│  │          │  │  Pagination                      │   │
│  └──────────┘  └──────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Design System Consistency

**Background:**
- Page background: `bg-stone-50`
- Cards/panels: `bg-white`

**Borders:**
- Standard: `border-stone-200`
- Hover emphasis: `border-stone-300`
- No drop shadows (borders-only depth strategy)

**Top Navigation:**
- `bg-white border-b border-stone-200`
- `max-w-7xl mx-auto px-4 sm:px-6 py-4`
- Links: `text-gray-700 hover:text-gray-900`
- Active section: `text-labor-red border-b-2 border-labor-red`

**Contextual Sidebar:**
- `bg-white border-r border-stone-200`
- Width: `240px` (fixed)
- Links: `block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded`
- Active: `bg-stone-100 text-gray-900 font-medium`
- Section headers: `text-xs uppercase tracking-wide text-gray-500 font-medium px-3 py-2`

**Main Content Area:**
- Container: `max-w-7xl mx-auto px-4 sm:px-6 py-6`
- Section headers: `text-sm font-semibold text-gray-900 uppercase tracking-wide`

**Buttons:**
- Primary: `bg-labor-red text-white hover:bg-labor-red-600 px-4 py-2 rounded font-medium`
- Secondary: `bg-white text-gray-700 border border-stone-200 hover:bg-stone-50 px-4 py-2 rounded font-medium`

**Tables:**
- Container: `bg-white border border-stone-200 rounded overflow-hidden`
- Header: `bg-stone-50 text-xs uppercase tracking-wide text-gray-500 font-medium`
- Rows: `border-t border-stone-100 hover:bg-stone-50`
- Cell padding: `px-4 py-3`

**Badges:**
- Base: `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium`
- Variants use semantic colors (green for success, red for critical, amber for warning, etc.)

**Stats Cards (Workspace home):**
- `bg-white border border-stone-200 rounded p-4`
- Label: `text-xs uppercase tracking-wide text-gray-500 font-medium mb-1`
- Value: `text-2xl font-semibold text-gray-900 tabular-nums`
- Subtext: `text-xs text-gray-600 mt-0.5`

---

## Implementation Notes

### Database Changes

**New Tables:**

```sql
-- Replace admin_users with team_members
CREATE TABLE team_members (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  member_id UUID REFERENCES members, -- link to member record
  chapter_id UUID REFERENCES chapters, -- chapter scope
  roles TEXT[], -- array of role names
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Roles can be:
-- Admin roles: 'super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin'
-- Team member roles: 'communications_lead', 'event_coordinator', 'volunteer_manager',
--                     'membership_coordinator', 'data_manager', 'content_creator'

-- Member segments (many-to-many)
CREATE TABLE member_segments (
  id UUID PRIMARY KEY,
  member_id UUID REFERENCES members,
  segment TEXT, -- 'donor', 'volunteer', 'event_attendee', 'organizer', 'new_member'
  applied_at TIMESTAMP,
  applied_by UUID REFERENCES team_members, -- who added this segment
  auto_applied BOOLEAN DEFAULT false, -- true if auto-applied (new_member, donor from payment)
  UNIQUE(member_id, segment)
);

-- Tasks (VRTF format)
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  project TEXT, -- groups tasks by plan/initiative
  phase TEXT, -- production phase
  name TEXT, -- task name (action-verb, under 10 words)
  owner UUID REFERENCES team_members, -- assigned to
  deliverable TEXT, -- exact description
  time_estimate_min INTEGER, -- estimated minutes
  deadline DATE,
  priority TEXT, -- 'P1', 'P2', 'P3'
  status TEXT, -- 'NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE'
  dependencies UUID[], -- array of task IDs
  references TEXT[], -- links or file names
  skill_type TEXT, -- 'WRITING', 'DESIGN', 'VIDEO', 'TECHNICAL', 'RESEARCH', 'COORDINATION'
  notes TEXT, -- block reasons, feedback, context
  created_by UUID REFERENCES team_members,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Modified Tables:**

```sql
-- Remove status field, it's now handled by segments
ALTER TABLE members DROP COLUMN status;

-- Keep joined_date for "new_member" segment logic
-- joined_date + 90 days → auto-apply new_member segment
```

### Migration Strategy

1. **Migrate admin_users to team_members**
   - Convert existing admin roles to new format
   - All existing admins get their role in the roles array
   - Link to member records where possible

2. **Add member segments**
   - Create member_segments table
   - Migrate existing status values:
     - active → no segment change (just a member)
     - pending → keep as separate pending system (not a segment)
     - inactive → add manual process to review and segment or remove
   - Auto-apply "new_member" to members joined < 90 days ago
   - Auto-apply "donor" to members with successful payments

3. **Create tasks table**
   - Fresh table, no migration needed

### Route Changes

**Old → New:**
- `/admin` → `/workspace`
- `/admin/page` → `/workspace` (home)
- Section routes stay similar:
  - `/members` (was partially admin, now consistent)
  - `/events` → `/events`
  - `/admin/email` → `/communicate`
  - `/chapters` → `/chapters`
  - `/admin/files` → `/resources`
  - New: `/tasks`
  - `/admin/[various]` → `/admin/[various]` (system tools)

### Permissions Logic

**Role-based access control:**

```javascript
// Example permission check
function canAccess(user, section, action) {
  const roles = user.team_member.roles;

  // Super admin has access to everything
  if (roles.includes('super_admin')) return true;

  // Section-specific permissions
  switch(section) {
    case 'members':
      return roles.includes('national_admin') ||
             roles.includes('state_admin') ||
             roles.includes('county_admin') ||
             roles.includes('city_admin') ||
             roles.includes('membership_coordinator') ||
             roles.includes('data_manager');

    case 'events':
      return roles.includes('national_admin') ||
             roles.includes('state_admin') ||
             roles.includes('county_admin') ||
             roles.includes('city_admin') ||
             roles.includes('event_coordinator');

    case 'communicate':
      return roles.includes('national_admin') ||
             roles.includes('state_admin') ||
             roles.includes('county_admin') ||
             roles.includes('city_admin') ||
             roles.includes('communications_lead');

    case 'tasks':
      return roles.includes('national_admin') ||
             roles.includes('state_admin') ||
             roles.includes('county_admin') ||
             roles.includes('city_admin') ||
             roles.includes('volunteer_manager');

    case 'admin':
      return roles.includes('super_admin') || roles.includes('national_admin');

    default:
      return false;
  }
}

// Scope filtering for data queries
function getChapterScope(user) {
  const roles = user.team_member.roles;

  // Full access roles
  if (roles.includes('super_admin') || roles.includes('national_admin')) {
    return null; // no filtering, see everything
  }

  // Geographic admin roles - return chapter + descendants
  if (roles.includes('state_admin') ||
      roles.includes('county_admin') ||
      roles.includes('city_admin')) {
    return getChapterDescendants(user.team_member.chapter_id);
  }

  // Team member roles - only their chapter
  return [user.team_member.chapter_id];
}
```

### UI Components to Build

**New components:**
- `<WorkspaceHome>` - personalized dashboard with role-based stats/actions
- `<TopNav>` - main navigation bar with active states
- `<ContextualSidebar>` - reusable sidebar with filters and actions
- `<SegmentBadges>` - displays multiple segment badges for a member
- `<SegmentSelector>` - checkbox UI for managing segments
- `<TaskCard>` - VRTF task display in list and board views
- `<TaskDetailModal>` - full task editor with all 7 fields
- `<KanbanBoard>` - drag-and-drop task board by status
- `<StatCard>` - reusable stat display for workspace home
- `<QuickActions>` - role-based action list component

**Modified components:**
- `<Navigation>` - update to new top nav pattern
- Member list/detail views - add segment display/management
- Email composer - update to new Communicate section

### Testing Considerations

**Role-based view testing:**
- Test each role sees correct workspace home (stats + actions)
- Test navigation shows only accessible sections
- Test contextual sidebars show role-appropriate options

**Segment testing:**
- Test multiple segments per member display
- Test segment filtering (single and multi-select)
- Test bulk segment operations
- Test auto-applied segments (new_member, donor)

**Task testing:**
- Test VRTF task creation with all fields
- Test task dependencies
- Test status transitions
- Test board view drag-and-drop
- Test filtering by status, priority, phase, owner

**Permission testing:**
- Test chapter-scoped access (team members only see their chapter)
- Test geographic hierarchy (state admin sees state + counties + cities)
- Test functional access (event coordinator can create events, not send emails)

---

## Next Steps

1. **Review & Approve Design** ✓ (Complete)
2. **Create Implementation Plan**
   - Break down into phases
   - Database migration scripts
   - Component build order
   - Testing strategy
3. **Database Schema Updates**
   - Create new tables
   - Write migration scripts
   - Update RLS policies
4. **Component Development**
   - Build in order of dependency
   - Start with primitives (badges, cards)
   - Then composites (sidebar, workspace home)
5. **Route Migration**
   - Create new routes alongside old
   - Gradual migration with feature flags
   - Sunset old admin routes
6. **Testing & QA**
   - Role-based testing
   - Permission verification
   - UI/UX validation
7. **Deployment**
   - Staging deployment
   - User acceptance testing
   - Production rollout

---

## Open Questions

None - design is complete and approved.

---

## Appendix: Quick Reference

### Top Nav Sections
Members | Events | Communicate | Chapters | Resources | Tasks | Admin

### Admin Roles
Super Admin, National Admin, State Admin, County Admin, City Admin

### Team Member Roles
Communications Lead, Event Coordinator, Volunteer Manager, Membership Coordinator, Data Manager, Content Creator

### Member Segments
Donor, Volunteer, Event Attendee, Organizer, New Member

### Task Statuses
NOT_STARTED, IN_PROGRESS, BLOCKED, IN_REVIEW, DONE

### Task Priorities
P1 (Critical), P2 (High), P3 (Standard)

### VRTF Task Fields
1. Task Name
2. Owner
3. Deliverable
4. Time Estimate
5. Deadline
6. Dependencies
7. Reference Materials
(+ Status, Priority, Phase, Notes)

---

**End of Design Document**
