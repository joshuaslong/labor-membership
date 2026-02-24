# Admin to Team Member Restructuring - Design

## Goal
Eliminate the `admin_users` table and make `team_members` the single source of truth for all roles, permissions, and workspace access. Bring approved volunteers into the workspace as team members.

## Key Decisions
1. **Full elimination** of `admin_users` (not shadow table)
2. **Single row per user**, roles as `TEXT[]` array, single `chapter_id`
3. **Role hierarchy**: `team_member` (base) > specialist roles > admin roles
4. **Volunteer onboarding**: Auto-create `team_member` on approval of opportunities flagged with `grants_workspace_access`
5. **Volunteer access**: Resources, Events, Volunteers, Tasks, Messaging
6. **`/admin` routes**: Repoint middleware/auth to `team_members`
