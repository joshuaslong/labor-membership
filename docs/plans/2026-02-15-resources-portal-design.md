# Resources Portal — Dropbox + Brandfolder Redesign

## Summary

Transform the existing flat file manager into two complementary systems:
- **Public portal** — Brandfolder-style curated collection pages for external distribution
- **Internal workspace** — Dropbox-style folder hierarchy for chapter-scoped file management

## Data Model

### New Tables

**`resource_collections`** — Curated groups for public portals
- `id` UUID PK
- `chapter_id` UUID nullable FK → chapters (null = national)
- `name` text not null
- `slug` text not null (unique per chapter scope)
- `description` text
- `sort_order` integer default 0
- `created_by` UUID FK → auth.users
- `created_at`, `updated_at` timestamps

**`resource_sections`** — Groups within a collection
- `id` UUID PK
- `collection_id` UUID FK → resource_collections
- `name` text not null
- `sort_order` integer default 0
- `created_at`, `updated_at` timestamps

**`resource_section_files`** — Join table linking files to sections
- `id` UUID PK
- `section_id` UUID FK → resource_sections
- `file_id` UUID FK → files
- `sort_order` integer default 0
- Unique constraint on (section_id, file_id)

**`folders`** — Internal folder hierarchy, max 3 levels
- `id` UUID PK
- `chapter_id` UUID not null FK → chapters
- `parent_id` UUID nullable FK → folders (self-referencing)
- `name` text not null
- `depth` integer not null default 0, CHECK (depth >= 0 AND depth <= 2)
- `created_by` UUID FK → auth.users
- `created_at`, `updated_at` timestamps
- Unique constraint on (chapter_id, parent_id, name)

### Changes to Existing Tables

**`files`** — Add column:
- `folder_id` UUID nullable FK → folders

**`chapters`** — Add columns:
- `slug` text unique nullable
- `public_resources_enabled` boolean default false

## Public Portal

### URL Structure

```
/resources                                    → National portal
/resources/[slug-or-id]                       → Chapter portal
/resources/[slug-or-id]/[collection-slug]     → Single collection page
```

### Behavior

- Fully public, no auth required anywhere under `/resources`
- Only files with `access_tier = 'public'` are surfaced, enforced at API level
- `/resources` shows national collections (chapter_id IS NULL) as cards
- `/resources/[slug-or-id]` resolves chapter by slug first, then UUID fallback. 404 if not found or `public_resources_enabled` is false. Shows chapter collections + national collections in a "National Resources" group below
- Collection pages use Brandfolder-style layout: sections as horizontal bands, thumbnail grids within each section
- Click asset → detail overlay with preview + direct download (presigned R2 URL)
- No customization per chapter — standardized layout with chapter name only
- Open download, no email capture

### Public API Routes

```
GET /api/resources/national                          → National collections list
GET /api/resources/national/[collection-slug]         → Collection with sections + files
GET /api/resources/chapters/[slug-or-id]              → Chapter collections list
GET /api/resources/chapters/[slug-or-id]/[col-slug]   → Chapter collection detail
```

## Internal Folder System

### URL Structure

```
/workspace/resources                    → Enhanced with folder navigation
/workspace/resources?folder=[id]        → View folder contents
/workspace/resources/upload             → Enhanced with folder selector
```

### Behavior

- Folder panel replaces current bucket-based sidebar filtering
- Shows folder tree for current chapter scope
- 3 levels max, depth enforced at DB and UI level
- Files without folder_id appear as "Loose Files" at root
- Breadcrumb navigation when inside folders
- Inline "New Folder" button, hidden at depth 3
- Move files: action menu → "Move to..." → folder picker modal
- Move folders: same mechanism, respects depth limit, same chapter only
- Upload page gains folder selector, defaults to current folder context

### Internal API Routes

```
GET    /api/folders                         → List folders for chapter scope
POST   /api/folders                         → Create folder
PUT    /api/folders/[id]                    → Rename folder
DELETE /api/folders/[id]                    → Delete folder (must be empty)
PUT    /api/folders/[id]/move               → Move folder to new parent
PUT    /api/files/[id]/move                 → Move file to different folder
```

### Permissions

- Chapter-scoped: admins see folders for their jurisdictional chapters
- Existing access_tier and role checks unchanged
- Folders inherit chapter ownership, no separate folder permissions

## Collections Management (Admin)

### URL Structure

```
/workspace/resources/collections                     → List collections
/workspace/resources/collections/new                 → Create collection
/workspace/resources/collections/[id]                → Edit collection
```

### Workflow

1. Admin creates collection with name, slug, optional description
2. Creates sections within collection (e.g., "Primary Logos")
3. Assigns files to sections via file picker (only access_tier='public' files selectable)
4. Reorder sections and files via drag handles or sort arrows

### Permissions

- National collections: super_admin, national_admin only
- Chapter collections: chapter admins for their jurisdiction
- Enabling public portal: super_admin or national_admin toggles `public_resources_enabled`

### Admin API Routes

```
GET    /api/collections                              → List collections for scope
POST   /api/collections                              → Create collection
PUT    /api/collections/[id]                         → Update collection
DELETE /api/collections/[id]                         → Delete (removes joins, not files)
POST   /api/collections/[id]/sections                → Create section
PUT    /api/collections/[id]/sections/[sid]          → Update section
DELETE /api/collections/[id]/sections/[sid]          → Delete section
PUT    /api/collections/[id]/sections/[sid]/files    → Set/reorder files in section
```

## Migration Strategy

No breaking changes. Everything layers on top of existing system.

### Implementation Order

1. **Database migrations** — New tables + chapter columns + folder_id on files
2. **Folder system** — API routes + folder tree UI in workspace
3. **Collections management** — Admin CRUD in workspace, file picker
4. **Public portal pages** — /resources routes, Brandfolder-style layout
5. **File moving** — Move-to-folder modal, folder reorganization

Each phase independently deployable.
