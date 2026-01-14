# Product Requirements Document
## Labor Party Membership Platform

**Version**: 1.0
**Last Updated**: January 2025
**Status**: Active Development

---

## Table of Contents
1. [Product Overview](#product-overview)
2. [Tech Stack](#tech-stack)
3. [User Types & Roles](#user-types--roles)
4. [Public Features](#public-features)
5. [Member Features](#member-features)
6. [Admin Features](#admin-features)
7. [Database Schema](#database-schema)
8. [API Reference](#api-reference)
9. [Authentication & Authorization](#authentication--authorization)
10. [Chapter Hierarchy Model](#chapter-hierarchy-model)
11. [Business Rules](#business-rules)
12. [Future Enhancements](#future-enhancements)

---

## Product Overview

**Application Name**: Labor Party Membership Management Platform
**Purpose**: A hierarchical membership management system for the Labor Party with chapter organization, member administration, and role-based access control.

**Core Value Proposition**:
- Organize members by geographic chapters (National → State → County → City)
- Enable distributed administration through role-based permissions
- Provide self-service membership management for members
- Support bulk member import from legacy systems

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Styling | Tailwind CSS |
| UI Components | React 19 |
| Deployment | Vercel |
| Runtime | Node.js |

---

## User Types & Roles

### Role Hierarchy

| Role | Scope | Capabilities |
|------|-------|--------------|
| **Public** | None | View home page, chapters directory, join |
| **Member** | Own profile | View dashboard, edit profile, view chapters |
| **City Admin** | City chapter | Manage members in city chapter |
| **County Admin** | County + cities | Manage county and child city chapters |
| **State Admin** | State + counties + cities | Manage state and all descendant chapters |
| **Super Admin** | Global | Full system access, delete members, manage all admins |

### Capabilities Matrix

| Capability | Public | Member | City Admin | County Admin | State Admin | Super Admin |
|------------|--------|--------|------------|--------------|-------------|-------------|
| View chapters | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Join/signup | ✓ | - | - | - | - | - |
| View dashboard | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit own profile | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| View member list | - | - | ✓ | ✓ | ✓ | ✓ |
| Edit members | - | - | ✓* | ✓* | ✓* | ✓ |
| Create chapters | - | - | - | ✓* | ✓* | ✓ |
| Manage admins | - | - | - | ✓* | ✓* | ✓ |
| Import members | - | - | ✓ | ✓ | ✓ | ✓ |
| Delete members | - | - | - | - | - | ✓ |

*Within jurisdiction only

---

## Public Features

### Home Page (`/`)
- Hero section with party messaging
- Three-pillar value proposition:
  - Independence from corporate funding
  - Member-funded accountability
  - Local chapter organization
- Call-to-action: "Join the Fight" and "Find Your Chapter"

### Join Page (`/join`)
**Required Fields**:
- First Name
- Last Name
- Email (unique)
- Password (8+ characters)
- Chapter selection

**Optional Fields**:
- Phone
- Address, City, State, ZIP
- Volunteer opt-in with interest details
- Mailing list opt-in

**Behavior**:
- Creates Supabase auth user
- Creates member record with "active" status
- Auto-enrolls in chapter hierarchy (city → county → state → national)
- Redirects to dashboard on success

### Chapters Directory (`/chapters`)
- Hierarchical browse view (expandable/collapsible)
- Search by chapter name
- Filter by level (National, State, County, City)
- Member counts visible to admins only
- Join button for each chapter

### Chapter Detail (`/chapters/[id]`)
- Chapter information and level badge
- Parent chapter link
- Sub-chapters list
- Member counts:
  - Total members (including sub-chapters) - visible to all
  - Direct members list - admin only
- Membership status badge if member belongs to chapter
- Join button for non-members

### Authentication Pages
- **Login** (`/login`): Email/password or magic link
- **Forgot Password** (`/forgot-password`): Email-based recovery
- **Reset Password** (`/reset-password`): New password form

---

## Member Features

### Dashboard (`/dashboard`)
- Membership status display (Active/Pending/Lapsed/Cancelled)
- Member since date
- Current chapter assignment
- Account overview with personal information
- Quick links: Edit Profile, Admin Dashboard (if admin)

### Profile Management (`/dashboard/profile`)
**Editable Fields**:
- Phone
- Address, City, State, ZIP
- Volunteer status and interests
- Mailing list preference

**Read-only Display**:
- Name
- Email

---

## Admin Features

### Admin Dashboard (`/admin`)
**Statistics Cards**:
- Total members with status breakdown
- Chapter counts by level
- Revenue from dues (when implemented)

**Quick Actions**:
- Import Members
- Create New Chapter
- Manage Chapters
- View All Members
- Review Pending Members
- Manage Administrators

**Recent Activity**:
- 5 most recent member signups

### Member Management (`/members`)
- Paginated table view (100 limit)
- Filter by status: All, Pending, Active, Lapsed, Cancelled
- Search by name or email
- Columns: Name, Email, Chapter, Status, Joined Date
- Click-through to member detail

### Member Detail (`/members/[id]`)
**View**:
- Full contact information
- Membership details (bio, volunteer status, mailing preference)
- Chapter memberships (all levels)
- Admin role (if applicable)

**Actions**:
- Change primary chapter assignment
- Update membership status
- Grant/revoke admin access
- Delete member permanently (super admin only)

### Administrator Management (`/admin/admins`)
- List all administrators with role and chapter
- Jurisdiction-aware filtering
- Add new admin by email lookup
- Remove admin access (except super admins)

### Chapter Creation (`/admin/chapters/new`)
**Fields**:
- Name (required)
- Level: State, County, or City
- Parent chapter (required, must be higher level)
- State code, County name, City name (optional)
- Contact email (optional)

### Member Import (`/admin/import`)
**CSV Format** (Memberstack export compatible):
```
email,CreatedAt,Last Login,First Name,Last Name,State,Zip Code,Phone-Number,Member Bio,Volunteering,Mailing List,Volunteering Details
```

**Processing**:
- Phone normalization to (XXX) XXX-XXXX
- State name → 2-letter code conversion
- Auto-assign to state chapter based on state
- Update existing members by email match
- Detailed import results with error tracking

---

## Database Schema

### Tables

#### `chapters`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR | Chapter name |
| level | ENUM | national, state, county, city |
| parent_id | UUID | FK to parent chapter |
| state_code | VARCHAR(2) | Two-letter state code |
| county_name | VARCHAR | County name |
| city_name | VARCHAR | City name |
| contact_email | VARCHAR | Contact email |
| is_active | BOOLEAN | Active status |
| founded_date | DATE | Chapter founding date |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

#### `members`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to auth.users |
| first_name | VARCHAR | First name |
| last_name | VARCHAR | Last name |
| email | VARCHAR | Email (unique) |
| phone | VARCHAR | Phone number |
| address_line1 | VARCHAR | Street address |
| city | VARCHAR | City |
| state | VARCHAR(2) | State code |
| zip_code | VARCHAR | ZIP code |
| chapter_id | UUID | FK to primary chapter |
| status | ENUM | pending, active, lapsed, cancelled |
| bio | TEXT | Member bio |
| wants_to_volunteer | BOOLEAN | Volunteer interest |
| volunteer_details | TEXT | Volunteer interests |
| mailing_list_opted_in | BOOLEAN | Mailing list preference |
| joined_date | DATE | Join date |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

#### `member_chapters`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| member_id | UUID | FK to members |
| chapter_id | UUID | FK to chapters |
| is_primary | BOOLEAN | Primary chapter flag |
| created_at | TIMESTAMP | Record creation |

#### `admin_users`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to auth.users |
| role | ENUM | Admin role level |
| chapter_id | UUID | FK to assigned chapter |
| created_at | TIMESTAMP | Record creation |

### Enums

```sql
CREATE TYPE chapter_level AS ENUM ('national', 'state', 'county', 'city');
CREATE TYPE member_status AS ENUM ('pending', 'active', 'lapsed', 'cancelled');
CREATE TYPE admin_role AS ENUM ('super_admin', 'state_admin', 'county_admin', 'city_admin');
```

### Database Functions

| Function | Purpose |
|----------|---------|
| `get_chapter_ancestors(uuid)` | Returns all parent chapters |
| `get_chapter_descendants(uuid)` | Returns all child chapters |
| `get_chapter_member_count(uuid)` | Counts members including sub-chapters |
| `can_manage_chapter(user_id, chapter_id)` | Checks admin jurisdiction |
| `can_manage_admin(manager_id, target_id)` | Checks admin management rights |

### Triggers

| Trigger | Purpose |
|---------|---------|
| `assign_member_to_chapter_hierarchy` | Auto-enrolls member in parent chapters |
| `on_member_chapter_change` | Updates member_chapters on chapter change |

---

## API Reference

### Authentication

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/auth/signup` | POST | Register new member | Public |
| `/api/auth/logout` | POST | Sign out | Member |
| `/auth/callback` | GET | OAuth/magic link callback | Public |

### Chapters

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/chapters` | GET | List all chapters | Public |
| `/api/chapters` | POST | Create chapter | Admin |

### Members

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/members` | GET | List members | Admin |
| `/api/members` | POST | Create member | Admin |
| `/api/members/[id]` | DELETE | Delete member | Super Admin |
| `/api/members/[id]/chapter` | PUT | Update member chapter | Admin |

### Admin

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/admin/admins` | GET | List administrators | Admin |
| `/api/admin/admins` | POST | Create administrator | Admin |
| `/api/admin/admins?id=` | DELETE | Remove administrator | Admin |
| `/api/admin/import-members` | GET | Download CSV template | Admin |
| `/api/admin/import-members` | POST | Import members from CSV | Admin |

---

## Authentication & Authorization

### Authentication Methods
1. **Email/Password**: Standard signup and login
2. **Magic Link**: Passwordless email OTP
3. **Password Recovery**: Email-based password reset

### Route Protection

| Route Pattern | Required Auth |
|---------------|---------------|
| `/dashboard/*` | Authenticated member |
| `/admin/*` | Admin role |
| `/members/*` | Admin role |

### Row-Level Security (RLS)
- Members can only read/update their own profile
- Admins can manage members within their chapter jurisdiction
- Super admins bypass jurisdiction restrictions

---

## Chapter Hierarchy Model

### Structure
```
National (root - single instance)
└── State (e.g., Pennsylvania, New York)
    └── County (e.g., Allegheny County, Kings County)
        └── City (e.g., Pittsburgh, Brooklyn)
```

### Auto-Enrollment Behavior
When a member joins a chapter:
1. Member is enrolled in selected chapter as primary
2. Trigger automatically enrolls in all parent chapters
3. `member_chapters` junction table tracks all relationships

### Member Counting
- **Direct Members**: Only members with that chapter as primary
- **Total Members**: All members including those in sub-chapters

---

## Business Rules

1. **Email Uniqueness**: Each member must have a unique email address
2. **Password Requirements**: Minimum 8 characters
3. **Chapter Hierarchy**: Child chapters must have a parent at a higher level
4. **Admin Jurisdiction**: Admins can only manage their chapter and descendants
5. **Super Admin Restrictions**: Super admins cannot be removed via the UI
6. **Auto-Enrollment**: Joining a sub-chapter automatically enrolls in parents
7. **Status Transitions**: Any admin can change member status; only super admin can delete
8. **One Primary Chapter**: Each member has exactly one primary chapter

---

## Future Enhancements

### Planned Features
- [ ] **Stripe Integration**: Membership dues and payment processing
- [ ] **Webhook Processing**: Payment status updates
- [ ] **Email Notifications**: Welcome emails, reminders, newsletters
- [ ] **Event Management**: Chapter meetings and events
- [ ] **Volunteer Coordination**: Match volunteers to opportunities
- [ ] **Advanced Analytics**: Member growth trends, engagement metrics
- [ ] **Mobile App**: Native iOS/Android applications
- [ ] **Two-Factor Authentication**: Enhanced security
- [ ] **Audit Logging**: Track admin actions
- [ ] **Export Functionality**: Member data export for reporting

---

## Environment Configuration

### Required Variables
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Optional Variables
```env
NEXT_PUBLIC_APP_URL=https://members.yourdomain.org
```

---

## Design System

### Brand Colors
- **Labor Red**: `#dc2626` - Primary brand color
- **White**: Navigation text, buttons on red background

### Chapter Level Colors
| Level | Color | Tailwind Class |
|-------|-------|----------------|
| National | Red | `bg-labor-red` |
| State | Blue | `bg-blue-600` |
| County | Green | `bg-green-600` |
| City | Purple | `bg-purple-600` |

### Status Badge Colors
| Status | Color | Tailwind Class |
|--------|-------|----------------|
| Active | Green | `bg-green-100 text-green-800` |
| Pending | Yellow | `bg-yellow-100 text-yellow-800` |
| Lapsed | Orange | `bg-orange-100 text-orange-800` |
| Cancelled | Red | `bg-red-100 text-red-800` |

### Typography
- **Font Family**: Inter, system-ui fallbacks
- **Headings**: Bold weight, tight letter-spacing
- **Body**: Regular weight, optimized line-height

### Components
- Cards with subtle shadows
- Primary buttons (red) and secondary buttons (gray)
- Input fields with focus rings
- Responsive navigation with mobile hamburger menu

---

*Document maintained by the development team. For questions, contact the project administrator.*
