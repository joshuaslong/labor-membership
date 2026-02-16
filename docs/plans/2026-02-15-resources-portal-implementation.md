# Resources Portal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the flat file manager into a Brandfolder-style public portal + Dropbox-style internal folder system.

**Architecture:** New database tables (folders, collections, sections, join table) layer on top of the existing `files` table and R2 storage. Public pages live at `/resources` (outside workspace auth). Internal folder system enhances the existing `/workspace/resources` pages. Collections management is a new admin section within workspace.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), Cloudflare R2, Tailwind CSS (stone/gray palette, labor-red accent)

---

## Phase 1: Database Migrations

### Task 1: Create folders table and add folder_id to files

**Files:**
- Create: `supabase/migrations/20260215140000_resource_folders.sql`

**Step 1: Write the migration**

```sql
-- Migration: Resource Folders
-- Adds folder hierarchy for internal file organization (max 3 levels deep)

-- Folders table
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Max 3 levels: 0, 1, 2
  CONSTRAINT folders_max_depth CHECK (depth >= 0 AND depth <= 2),
  -- Unique folder name within same parent and chapter
  CONSTRAINT folders_unique_name UNIQUE (chapter_id, parent_id, name)
);

-- Add folder reference to files
ALTER TABLE files ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_folders_chapter_id ON folders(chapter_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_files_folder_id ON files(folder_id);

-- Enable RLS
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can view folders in their jurisdictional chapters
CREATE POLICY "Admins can view folders in jurisdiction" ON folders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND (
        au.role IN ('super_admin', 'national_admin')
        OR (
          au.chapter_id IS NOT NULL
          AND folders.chapter_id IN (
            SELECT id FROM get_chapter_descendants(au.chapter_id)
          )
        )
      )
    )
  );

-- RLS: Admins can insert folders in their jurisdictional chapters
CREATE POLICY "Admins can insert folders" ON folders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND (
        au.role IN ('super_admin', 'national_admin')
        OR (
          au.chapter_id IS NOT NULL
          AND folders.chapter_id IN (
            SELECT id FROM get_chapter_descendants(au.chapter_id)
          )
        )
      )
    )
  );

-- RLS: Admins can update folders in their jurisdiction
CREATE POLICY "Admins can update folders" ON folders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND (
        au.role IN ('super_admin', 'national_admin')
        OR (
          au.chapter_id IS NOT NULL
          AND folders.chapter_id IN (
            SELECT id FROM get_chapter_descendants(au.chapter_id)
          )
        )
      )
    )
  );

-- RLS: Admins can delete folders in their jurisdiction
CREATE POLICY "Admins can delete folders" ON folders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND (
        au.role IN ('super_admin', 'national_admin')
        OR (
          au.chapter_id IS NOT NULL
          AND folders.chapter_id IN (
            SELECT id FROM get_chapter_descendants(au.chapter_id)
          )
        )
      )
    )
  );

-- Trigger for updated_at
CREATE TRIGGER folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Step 2: Apply the migration**

Run via Supabase MCP tool `apply_migration` with name `resource_folders`.

**Step 3: Verify**

Run: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'folders' ORDER BY ordinal_position;`
Expected: id, chapter_id, parent_id, name, depth, created_by, created_at, updated_at columns.

Run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'folder_id';`
Expected: folder_id column exists.

---

### Task 2: Create collections, sections, and join tables + chapter slug

**Files:**
- Create: `supabase/migrations/20260215140001_resource_collections.sql`

**Step 1: Write the migration**

```sql
-- Migration: Resource Collections
-- Curated collection system for public resource portals (Brandfolder-style)

-- Collections table
CREATE TABLE resource_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Slug unique per chapter scope (null chapter_id = national)
  CONSTRAINT collections_unique_slug UNIQUE NULLS NOT DISTINCT (chapter_id, slug)
);

-- Sections within collections
CREATE TABLE resource_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES resource_collections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Join table: files in sections
CREATE TABLE resource_section_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES resource_sections(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,

  CONSTRAINT section_files_unique UNIQUE (section_id, file_id)
);

-- Add slug and public_resources_enabled to chapters
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS public_resources_enabled BOOLEAN DEFAULT FALSE;

-- Indexes
CREATE INDEX idx_collections_chapter_id ON resource_collections(chapter_id);
CREATE INDEX idx_collections_slug ON resource_collections(slug);
CREATE INDEX idx_sections_collection_id ON resource_sections(collection_id);
CREATE INDEX idx_section_files_section_id ON resource_section_files(section_id);
CREATE INDEX idx_section_files_file_id ON resource_section_files(file_id);
CREATE INDEX idx_chapters_slug ON chapters(slug) WHERE slug IS NOT NULL;

-- Enable RLS
ALTER TABLE resource_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_section_files ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ: Anyone can view collections (public portal)
CREATE POLICY "Anyone can view collections" ON resource_collections
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view sections" ON resource_sections
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view section files" ON resource_section_files
  FOR SELECT
  USING (true);

-- WRITE: National collections -> super_admin/national_admin
-- WRITE: Chapter collections -> chapter admins with jurisdiction
CREATE POLICY "Admins can manage national collections" ON resource_collections
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND (
        au.role IN ('super_admin', 'national_admin')
        OR (
          au.chapter_id IS NOT NULL
          AND resource_collections.chapter_id IS NOT NULL
          AND resource_collections.chapter_id IN (
            SELECT id FROM get_chapter_descendants(au.chapter_id)
          )
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND (
        au.role IN ('super_admin', 'national_admin')
        OR (
          au.chapter_id IS NOT NULL
          AND resource_collections.chapter_id IS NOT NULL
          AND resource_collections.chapter_id IN (
            SELECT id FROM get_chapter_descendants(au.chapter_id)
          )
        )
      )
    )
  );

-- Sections: writable by admins who can manage the parent collection
CREATE POLICY "Admins can manage sections" ON resource_sections
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM resource_collections rc
      JOIN admin_users au ON au.user_id = auth.uid()
      WHERE rc.id = resource_sections.collection_id
      AND (
        au.role IN ('super_admin', 'national_admin')
        OR (
          au.chapter_id IS NOT NULL
          AND rc.chapter_id IS NOT NULL
          AND rc.chapter_id IN (
            SELECT id FROM get_chapter_descendants(au.chapter_id)
          )
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM resource_collections rc
      JOIN admin_users au ON au.user_id = auth.uid()
      WHERE rc.id = resource_sections.collection_id
      AND (
        au.role IN ('super_admin', 'national_admin')
        OR (
          au.chapter_id IS NOT NULL
          AND rc.chapter_id IS NOT NULL
          AND rc.chapter_id IN (
            SELECT id FROM get_chapter_descendants(au.chapter_id)
          )
        )
      )
    )
  );

-- Section files: writable by admins who can manage the parent collection
CREATE POLICY "Admins can manage section files" ON resource_section_files
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM resource_sections rs
      JOIN resource_collections rc ON rc.id = rs.collection_id
      JOIN admin_users au ON au.user_id = auth.uid()
      WHERE rs.id = resource_section_files.section_id
      AND (
        au.role IN ('super_admin', 'national_admin')
        OR (
          au.chapter_id IS NOT NULL
          AND rc.chapter_id IS NOT NULL
          AND rc.chapter_id IN (
            SELECT id FROM get_chapter_descendants(au.chapter_id)
          )
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM resource_sections rs
      JOIN resource_collections rc ON rc.id = rs.collection_id
      JOIN admin_users au ON au.user_id = auth.uid()
      WHERE rs.id = resource_section_files.section_id
      AND (
        au.role IN ('super_admin', 'national_admin')
        OR (
          au.chapter_id IS NOT NULL
          AND rc.chapter_id IS NOT NULL
          AND rc.chapter_id IN (
            SELECT id FROM get_chapter_descendants(au.chapter_id)
          )
        )
      )
    )
  );

-- Triggers for updated_at
CREATE TRIGGER collections_updated_at
  BEFORE UPDATE ON resource_collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sections_updated_at
  BEFORE UPDATE ON resource_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Step 2: Apply the migration**

Run via Supabase MCP tool `apply_migration` with name `resource_collections`.

**Step 3: Verify**

Run: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('resource_collections', 'resource_sections', 'resource_section_files') ORDER BY table_name;`
Expected: all 3 tables exist.

Run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'chapters' AND column_name IN ('slug', 'public_resources_enabled');`
Expected: both columns exist.

---

## Phase 2: Folder System (Internal)

### Task 3: Folders API routes

**Files:**
- Create: `src/app/api/folders/route.js`
- Create: `src/app/api/folders/[id]/route.js`
- Create: `src/app/api/folders/[id]/move/route.js`

**Step 1: Create `src/app/api/folders/route.js`**

```js
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - List folders for a chapter
export async function GET(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const chapterId = searchParams.get('chapter_id')
  const parentId = searchParams.get('parent_id') // null = root level

  if (!chapterId) {
    return NextResponse.json({ error: 'chapter_id is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Verify user has access to this chapter
  const { data: adminRecords } = await adminClient
    .from('admin_users')
    .select('role, chapter_id')
    .eq('user_id', user.id)

  if (!adminRecords || adminRecords.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isTopAdmin = adminRecords.some(a => ['super_admin', 'national_admin'].includes(a.role))

  if (!isTopAdmin) {
    // Check jurisdiction
    const adminChapterIds = adminRecords.filter(a => a.chapter_id).map(a => a.chapter_id)
    if (adminChapterIds.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if chapterId is in any admin's jurisdiction
    let hasAccess = false
    for (const adminChapterId of adminChapterIds) {
      const { data: descendants } = await adminClient.rpc('get_chapter_descendants', { chapter_uuid: adminChapterId })
      if (descendants?.some(d => d.id === chapterId)) {
        hasAccess = true
        break
      }
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Fetch folders
  let query = adminClient
    .from('folders')
    .select('id, name, parent_id, depth, created_at')
    .eq('chapter_id', chapterId)
    .order('name')

  if (parentId) {
    query = query.eq('parent_id', parentId)
  } else {
    query = query.is('parent_id', null)
  }

  const { data: folders, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get file counts per folder
  const folderIds = folders.map(f => f.id)
  let fileCounts = {}
  if (folderIds.length > 0) {
    const { data: counts } = await adminClient
      .from('files')
      .select('folder_id')
      .in('folder_id', folderIds)
      .is('deleted_at', null)

    if (counts) {
      for (const row of counts) {
        fileCounts[row.folder_id] = (fileCounts[row.folder_id] || 0) + 1
      }
    }
  }

  // Get subfolder counts
  let subfolderCounts = {}
  if (folderIds.length > 0) {
    const { data: subCounts } = await adminClient
      .from('folders')
      .select('parent_id')
      .in('parent_id', folderIds)

    if (subCounts) {
      for (const row of subCounts) {
        subfolderCounts[row.parent_id] = (subfolderCounts[row.parent_id] || 0) + 1
      }
    }
  }

  const enrichedFolders = folders.map(f => ({
    ...f,
    file_count: fileCounts[f.id] || 0,
    subfolder_count: subfolderCounts[f.id] || 0,
  }))

  return NextResponse.json({ folders: enrichedFolders })
}

// POST - Create a folder
export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, chapter_id, parent_id } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Folder name is required' }, { status: 400 })
  }

  if (!chapter_id) {
    return NextResponse.json({ error: 'chapter_id is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Verify jurisdiction
  const { data: adminRecords } = await adminClient
    .from('admin_users')
    .select('role, chapter_id')
    .eq('user_id', user.id)

  if (!adminRecords || adminRecords.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isTopAdmin = adminRecords.some(a => ['super_admin', 'national_admin'].includes(a.role))

  if (!isTopAdmin) {
    const adminChapterIds = adminRecords.filter(a => a.chapter_id).map(a => a.chapter_id)
    let hasAccess = false
    for (const adminChapterId of adminChapterIds) {
      const { data: descendants } = await adminClient.rpc('get_chapter_descendants', { chapter_uuid: adminChapterId })
      if (descendants?.some(d => d.id === chapter_id)) {
        hasAccess = true
        break
      }
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Determine depth
  let depth = 0
  if (parent_id) {
    const { data: parent } = await adminClient
      .from('folders')
      .select('depth, chapter_id')
      .eq('id', parent_id)
      .single()

    if (!parent) {
      return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 })
    }

    if (parent.chapter_id !== chapter_id) {
      return NextResponse.json({ error: 'Parent folder belongs to a different chapter' }, { status: 400 })
    }

    depth = parent.depth + 1
    if (depth > 2) {
      return NextResponse.json({ error: 'Maximum folder depth (3 levels) exceeded' }, { status: 400 })
    }
  }

  const { data: folder, error } = await adminClient
    .from('folders')
    .insert({
      name: name.trim(),
      chapter_id,
      parent_id: parent_id || null,
      depth,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A folder with this name already exists here' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ folder }, { status: 201 })
}
```

**Step 2: Create `src/app/api/folders/[id]/route.js`**

```js
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PUT - Rename folder
export async function PUT(request, { params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Folder name is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Get folder and verify jurisdiction
  const { data: folder } = await adminClient
    .from('folders')
    .select('id, chapter_id')
    .eq('id', id)
    .single()

  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  const { data: adminRecords } = await adminClient
    .from('admin_users')
    .select('role, chapter_id')
    .eq('user_id', user.id)

  if (!adminRecords || adminRecords.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isTopAdmin = adminRecords.some(a => ['super_admin', 'national_admin'].includes(a.role))
  if (!isTopAdmin) {
    const adminChapterIds = adminRecords.filter(a => a.chapter_id).map(a => a.chapter_id)
    let hasAccess = false
    for (const adminChapterId of adminChapterIds) {
      const { data: descendants } = await adminClient.rpc('get_chapter_descendants', { chapter_uuid: adminChapterId })
      if (descendants?.some(d => d.id === folder.chapter_id)) {
        hasAccess = true
        break
      }
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { data: updated, error } = await adminClient
    .from('folders')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A folder with this name already exists here' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ folder: updated })
}

// DELETE - Delete folder (must be empty)
export async function DELETE(request, { params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()

  const { data: folder } = await adminClient
    .from('folders')
    .select('id, chapter_id')
    .eq('id', id)
    .single()

  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  // Verify jurisdiction (same pattern as PUT)
  const { data: adminRecords } = await adminClient
    .from('admin_users')
    .select('role, chapter_id')
    .eq('user_id', user.id)

  if (!adminRecords || adminRecords.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isTopAdmin = adminRecords.some(a => ['super_admin', 'national_admin'].includes(a.role))
  if (!isTopAdmin) {
    const adminChapterIds = adminRecords.filter(a => a.chapter_id).map(a => a.chapter_id)
    let hasAccess = false
    for (const adminChapterId of adminChapterIds) {
      const { data: descendants } = await adminClient.rpc('get_chapter_descendants', { chapter_uuid: adminChapterId })
      if (descendants?.some(d => d.id === folder.chapter_id)) {
        hasAccess = true
        break
      }
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Check folder is empty (no files and no subfolders)
  const { data: childFiles } = await adminClient
    .from('files')
    .select('id')
    .eq('folder_id', id)
    .is('deleted_at', null)
    .limit(1)

  if (childFiles && childFiles.length > 0) {
    return NextResponse.json({ error: 'Folder contains files. Move or delete them first.' }, { status: 400 })
  }

  const { data: childFolders } = await adminClient
    .from('folders')
    .select('id')
    .eq('parent_id', id)
    .limit(1)

  if (childFolders && childFolders.length > 0) {
    return NextResponse.json({ error: 'Folder contains subfolders. Delete them first.' }, { status: 400 })
  }

  const { error } = await adminClient
    .from('folders')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 3: Create `src/app/api/folders/[id]/move/route.js`**

```js
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PUT - Move folder to a new parent
export async function PUT(request, { params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { parent_id } = body // null = move to root

  const adminClient = createAdminClient()

  // Get folder
  const { data: folder } = await adminClient
    .from('folders')
    .select('id, chapter_id, parent_id, depth, name')
    .eq('id', id)
    .single()

  if (!folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  // Verify jurisdiction
  const { data: adminRecords } = await adminClient
    .from('admin_users')
    .select('role, chapter_id')
    .eq('user_id', user.id)

  if (!adminRecords || adminRecords.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isTopAdmin = adminRecords.some(a => ['super_admin', 'national_admin'].includes(a.role))
  if (!isTopAdmin) {
    const adminChapterIds = adminRecords.filter(a => a.chapter_id).map(a => a.chapter_id)
    let hasAccess = false
    for (const adminChapterId of adminChapterIds) {
      const { data: descendants } = await adminClient.rpc('get_chapter_descendants', { chapter_uuid: adminChapterId })
      if (descendants?.some(d => d.id === folder.chapter_id)) {
        hasAccess = true
        break
      }
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Calculate new depth
  let newDepth = 0
  if (parent_id) {
    // Prevent moving into self or descendant
    if (parent_id === id) {
      return NextResponse.json({ error: 'Cannot move folder into itself' }, { status: 400 })
    }

    const { data: newParent } = await adminClient
      .from('folders')
      .select('id, depth, chapter_id')
      .eq('id', parent_id)
      .single()

    if (!newParent) {
      return NextResponse.json({ error: 'Target folder not found' }, { status: 404 })
    }

    if (newParent.chapter_id !== folder.chapter_id) {
      return NextResponse.json({ error: 'Cannot move folder to a different chapter' }, { status: 400 })
    }

    newDepth = newParent.depth + 1

    // Check if this folder has children — if so, moving it deeper might exceed max depth
    const { data: deepestChild } = await adminClient
      .from('folders')
      .select('depth')
      .eq('parent_id', id)
      .order('depth', { ascending: false })
      .limit(1)

    const maxChildDepth = deepestChild?.[0]?.depth || folder.depth
    const depthIncrease = newDepth - folder.depth
    if (maxChildDepth + depthIncrease > 2) {
      return NextResponse.json({ error: 'Moving here would exceed maximum folder depth (3 levels)' }, { status: 400 })
    }
  }

  // Check name uniqueness at target location
  const { data: existing } = await adminClient
    .from('folders')
    .select('id')
    .eq('chapter_id', folder.chapter_id)
    .eq('name', folder.name)
    .is('parent_id', parent_id || null)
    .neq('id', id)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'A folder with this name already exists at the target location' }, { status: 409 })
  }

  // Update folder and recursively update child depths
  const depthDiff = newDepth - folder.depth

  const { error: updateError } = await adminClient
    .from('folders')
    .update({ parent_id: parent_id || null, depth: newDepth })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Update children depths recursively if depth changed
  if (depthDiff !== 0) {
    // Get all descendant folders
    const updateChildDepths = async (parentId, currentDepthDiff) => {
      const { data: children } = await adminClient
        .from('folders')
        .select('id, depth')
        .eq('parent_id', parentId)

      if (children) {
        for (const child of children) {
          await adminClient
            .from('folders')
            .update({ depth: child.depth + currentDepthDiff })
            .eq('id', child.id)
          await updateChildDepths(child.id, currentDepthDiff)
        }
      }
    }
    await updateChildDepths(id, depthDiff)
  }

  return NextResponse.json({ success: true })
}
```

**Step 4: Verify**

Run dev server and test endpoints with curl/browser. API routes should return proper JSON responses.

**Step 5: Commit**

```bash
git add src/app/api/folders/
git commit -m "feat: add folders API routes (CRUD + move)"
```

---

### Task 4: File move API route

**Files:**
- Create: `src/app/api/files/[id]/move/route.js`

**Step 1: Create the route**

```js
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PUT - Move file to a different folder
export async function PUT(request, { params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { folder_id } = body // null = move to root (no folder)

  const adminClient = createAdminClient()

  // Get the file
  const { data: file } = await adminClient
    .from('files')
    .select('id, chapter_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  // If moving to a folder, verify it exists and belongs to same chapter
  if (folder_id) {
    const { data: folder } = await adminClient
      .from('folders')
      .select('id, chapter_id')
      .eq('id', folder_id)
      .single()

    if (!folder) {
      return NextResponse.json({ error: 'Target folder not found' }, { status: 404 })
    }

    if (file.chapter_id && folder.chapter_id !== file.chapter_id) {
      return NextResponse.json({ error: 'Cannot move file to a folder in a different chapter' }, { status: 400 })
    }
  }

  // Verify user has permission (admin with jurisdiction)
  const { data: adminRecords } = await adminClient
    .from('admin_users')
    .select('role, chapter_id')
    .eq('user_id', user.id)

  if (!adminRecords || adminRecords.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isTopAdmin = adminRecords.some(a => ['super_admin', 'national_admin'].includes(a.role))
  if (!isTopAdmin && file.chapter_id) {
    const adminChapterIds = adminRecords.filter(a => a.chapter_id).map(a => a.chapter_id)
    let hasAccess = false
    for (const adminChapterId of adminChapterIds) {
      const { data: descendants } = await adminClient.rpc('get_chapter_descendants', { chapter_uuid: adminChapterId })
      if (descendants?.some(d => d.id === file.chapter_id)) {
        hasAccess = true
        break
      }
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { error } = await adminClient
    .from('files')
    .update({ folder_id: folder_id || null })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 2: Update existing files list API to support folder filtering**

Modify `src/app/api/files/route.js` — add `folder_id` param support to the GET handler. In the query building section, after existing filters, add:

```js
// Add after existing search filter logic:
const folderId = searchParams.get('folder_id')
if (folderId === 'root') {
  // Root level: files with no folder
  query = query.is('folder_id', null)
} else if (folderId) {
  query = query.eq('folder_id', folderId)
}
// If no folder_id param, return all files (existing behavior)
```

**Step 3: Update upload API to accept folder_id**

Modify `src/app/api/files/upload/route.js` — accept optional `folder_id` in the POST body and include it in the file metadata insert.

**Step 4: Commit**

```bash
git add src/app/api/files/[id]/move/ src/app/api/files/route.js src/app/api/files/upload/route.js
git commit -m "feat: add file move route and folder filtering to files API"
```

---

### Task 5: Folder tree UI in workspace resources

**Files:**
- Create: `src/app/workspace/resources/FolderTree.js`
- Modify: `src/app/workspace/resources/layout.js`
- Modify: `src/app/workspace/resources/page.js`
- Modify: `src/app/workspace/resources/ResourceBrowser.js`

**Step 1: Create `FolderTree.js` client component**

A collapsible folder tree component that:
- Fetches folders from `/api/folders?chapter_id=X&parent_id=Y`
- Shows folder icons with expand/collapse chevrons
- Highlights the currently selected folder
- Shows "New Folder" inline input at each level (hidden at depth 2)
- Renders in the sidebar area (replaces bucket filter links)
- Includes a "Loose Files" option at root for files without a folder
- Props: `chapterId`, `selectedFolderId`, `onFolderSelect`

Design tokens to match existing sidebar:
- `text-sm`, `text-gray-700`, `hover:bg-stone-50`
- Active: `bg-stone-100 text-gray-900 font-medium`
- Folder icon: simple SVG, `w-4 h-4 text-gray-400`
- Indent: `pl-4` per level

**Step 2: Update layout to pass chapter context and use folder tree**

Modify `src/app/workspace/resources/layout.js`:
- Keep the existing `ContextualSidebar` but restructure sidebar items:
  - "Upload Files" button (primary) stays
  - "All Files" link stays
  - Add "Collections" link → `/workspace/resources/collections` (for admins)
  - Divider
  - "Folders" header
  - Render `FolderTree` component below (pass `chapterId` from `teamMember.chapter_id` or scoped chapter)

**Step 3: Update `ResourceBrowser.js` to accept `folderId` prop**

- Add `folderId` to the fetch params sent to `/api/files`
- Show breadcrumb navigation when inside a folder
- Add folder context to file rows (show folder name if viewing "All Files")

**Step 4: Update `page.js` to read folder from search params**

Read `?folder=UUID` from search params and pass to `ResourceBrowser`.

**Step 5: Verify**

Run dev server, navigate to `/workspace/resources`. Folder tree should appear in sidebar. Creating a folder and clicking it should filter the file list.

**Step 6: Commit**

```bash
git add src/app/workspace/resources/
git commit -m "feat: add folder tree navigation to workspace resources"
```

---

### Task 6: Move file/folder modals

**Files:**
- Create: `src/app/workspace/resources/MoveToFolderModal.js`
- Modify: `src/app/workspace/resources/ResourceBrowser.js`

**Step 1: Create `MoveToFolderModal.js`**

A modal component that:
- Shows a folder tree picker (reuses folder tree pattern but standalone)
- Has "Root (no folder)" option at the top
- Highlights current location
- Disables invalid targets (same location, would exceed depth for folder moves)
- "Move" button (labor-red) + "Cancel" button
- Props: `itemType` ('file' | 'folder'), `itemId`, `currentFolderId`, `chapterId`, `onMove`, `onClose`
- Calls `PUT /api/files/[id]/move` or `PUT /api/folders/[id]/move`

**Step 2: Add "Move to..." action to ResourceBrowser file rows**

In `ResourceBrowser.js`, add a move button to the hover actions (alongside download and delete). Clicking opens `MoveToFolderModal`.

**Step 3: Verify**

Click "Move to..." on a file, select a folder, confirm move. File should disappear from current view and appear in target folder.

**Step 4: Commit**

```bash
git add src/app/workspace/resources/MoveToFolderModal.js src/app/workspace/resources/ResourceBrowser.js
git commit -m "feat: add move-to-folder modal for files and folders"
```

---

### Task 7: Update upload page with folder selector

**Files:**
- Modify: `src/app/workspace/resources/upload/page.js`
- Modify: `src/app/workspace/resources/upload/ResourceUploader.js`

**Step 1: Update `ResourceUploader.js`**

- Add folder selector dropdown after the bucket selector
- Fetch folders from `/api/folders?chapter_id=X` and build a flat list with indentation
- Include "No folder (root)" option
- Pass `folder_id` in the upload request body
- Accept `defaultFolderId` prop for when navigating from a folder context

**Step 2: Update upload `page.js`**

- Read `?folder=UUID` from search params
- Pass as `defaultFolderId` to `ResourceUploader`

**Step 3: Verify**

Navigate to upload page from within a folder. Folder should be pre-selected. Upload a file — it should appear in that folder.

**Step 4: Commit**

```bash
git add src/app/workspace/resources/upload/
git commit -m "feat: add folder selector to file upload page"
```

---

## Phase 3: Collections Management (Admin)

### Task 8: Collections API routes

**Files:**
- Create: `src/app/api/collections/route.js`
- Create: `src/app/api/collections/[id]/route.js`
- Create: `src/app/api/collections/[id]/sections/route.js`
- Create: `src/app/api/collections/[id]/sections/[sectionId]/route.js`
- Create: `src/app/api/collections/[id]/sections/[sectionId]/files/route.js`

**Step 1: Create `src/app/api/collections/route.js`**

```js
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - List collections
export async function GET(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const chapterId = searchParams.get('chapter_id') // null = national

  const adminClient = createAdminClient()

  let query = adminClient
    .from('resource_collections')
    .select(`
      id, name, slug, description, sort_order, chapter_id, created_at,
      resource_sections (
        id
      )
    `)
    .order('sort_order')
    .order('name')

  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  } else {
    query = query.is('chapter_id', null)
  }

  const { data: collections, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const enriched = collections.map(c => ({
    ...c,
    section_count: c.resource_sections?.length || 0,
    resource_sections: undefined,
  }))

  return NextResponse.json({ collections: enriched })
}

// POST - Create collection
export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, slug, description, chapter_id } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Collection name is required' }, { status: 400 })
  }

  if (!slug?.trim()) {
    return NextResponse.json({ error: 'Collection slug is required' }, { status: 400 })
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Verify permissions
  const { data: adminRecords } = await adminClient
    .from('admin_users')
    .select('role, chapter_id')
    .eq('user_id', user.id)

  if (!adminRecords || adminRecords.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isTopAdmin = adminRecords.some(a => ['super_admin', 'national_admin'].includes(a.role))

  // National collections require top admin
  if (!chapter_id && !isTopAdmin) {
    return NextResponse.json({ error: 'Only national admins can create national collections' }, { status: 403 })
  }

  // Chapter collections require jurisdiction
  if (chapter_id && !isTopAdmin) {
    const adminChapterIds = adminRecords.filter(a => a.chapter_id).map(a => a.chapter_id)
    let hasAccess = false
    for (const adminChapterId of adminChapterIds) {
      const { data: descendants } = await adminClient.rpc('get_chapter_descendants', { chapter_uuid: adminChapterId })
      if (descendants?.some(d => d.id === chapter_id)) {
        hasAccess = true
        break
      }
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Get max sort_order
  let sortQuery = adminClient
    .from('resource_collections')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)

  if (chapter_id) {
    sortQuery = sortQuery.eq('chapter_id', chapter_id)
  } else {
    sortQuery = sortQuery.is('chapter_id', null)
  }

  const { data: maxSort } = await sortQuery
  const nextSort = (maxSort?.[0]?.sort_order ?? -1) + 1

  const { data: collection, error } = await adminClient
    .from('resource_collections')
    .insert({
      name: name.trim(),
      slug: slug.trim(),
      description: description?.trim() || null,
      chapter_id: chapter_id || null,
      sort_order: nextSort,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A collection with this slug already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ collection }, { status: 201 })
}
```

**Step 2: Create `src/app/api/collections/[id]/route.js`**

PUT (update name/slug/description/sort_order) and DELETE (cascade deletes sections + join records via FK, not files).

Pattern: same auth/jurisdiction check, then update/delete on `resource_collections`.

**Step 3: Create `src/app/api/collections/[id]/sections/route.js`**

GET (list sections with file counts) and POST (create section within collection).

**Step 4: Create `src/app/api/collections/[id]/sections/[sectionId]/route.js`**

PUT (update section name/sort_order) and DELETE (cascade deletes join records).

**Step 5: Create `src/app/api/collections/[id]/sections/[sectionId]/files/route.js`**

PUT — accepts `{ file_ids: ['uuid1', 'uuid2', ...] }`. Replaces all files in the section. Only allows files with `access_tier = 'public'`. Creates `resource_section_files` records with sequential `sort_order`.

```js
// PUT - Set/reorder files in section
export async function PUT(request, { params }) {
  const { id, sectionId } = await params
  // ... auth check ...

  const { file_ids } = await request.json()

  const adminClient = createAdminClient()

  // Verify all files are public
  if (file_ids.length > 0) {
    const { data: files } = await adminClient
      .from('files')
      .select('id, access_tier')
      .in('id', file_ids)
      .is('deleted_at', null)

    const nonPublic = files?.filter(f => f.access_tier !== 'public')
    if (nonPublic?.length > 0) {
      return NextResponse.json({ error: 'Only public files can be added to collections' }, { status: 400 })
    }

    if (files?.length !== file_ids.length) {
      return NextResponse.json({ error: 'Some files were not found' }, { status: 404 })
    }
  }

  // Delete existing entries
  await adminClient
    .from('resource_section_files')
    .delete()
    .eq('section_id', sectionId)

  // Insert new entries with sort_order
  if (file_ids.length > 0) {
    const entries = file_ids.map((fileId, index) => ({
      section_id: sectionId,
      file_id: fileId,
      sort_order: index,
    }))

    const { error } = await adminClient
      .from('resource_section_files')
      .insert(entries)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
```

**Step 6: Commit**

```bash
git add src/app/api/collections/
git commit -m "feat: add collections API routes (CRUD + sections + file assignment)"
```

---

### Task 9: Collections management UI

**Files:**
- Create: `src/app/workspace/resources/collections/page.js`
- Create: `src/app/workspace/resources/collections/CollectionsList.js`
- Create: `src/app/workspace/resources/collections/new/page.js`
- Create: `src/app/workspace/resources/collections/new/NewCollectionForm.js`
- Create: `src/app/workspace/resources/collections/[id]/page.js`
- Create: `src/app/workspace/resources/collections/[id]/CollectionEditor.js`
- Create: `src/app/workspace/resources/collections/[id]/FilePicker.js`

**Step 1: Create collections list page**

`page.js` — server component, auth check, passes chapter scope to client component.

`CollectionsList.js` — client component:
- Fetches from `/api/collections?chapter_id=X`
- Displays collections in a card list (name, slug, section count, sort arrows)
- "New Collection" button (labor-red)
- Toggle between "National" and "Chapter" collections tabs (if user is top admin with chapter scope)

Design: white card per collection, `border-stone-200`, name in `text-base font-medium`, slug in `text-xs text-gray-500`, section count badge.

**Step 2: Create new collection form**

`NewCollectionForm.js` — client component:
- Name input, slug input (auto-generated from name, editable)
- Description textarea (optional)
- Chapter selector (if top admin, can create national or chapter-scoped)
- Submit → POST `/api/collections` → redirect to edit page

**Step 3: Create collection editor**

`CollectionEditor.js` — client component:
- Editable name, slug, description at top
- Sections list below, each expandable
- "Add Section" button
- Within each section: section name (editable), file grid, "Add Files" button
- "Add Files" opens `FilePicker` modal
- Drag handles for reordering sections (or up/down arrows for simplicity)
- Delete section button (with confirmation)

`FilePicker.js` — modal component:
- Fetches from `/api/files?bucket=public` (only public files)
- Thumbnail grid with checkboxes
- Search within modal
- "Add Selected" button
- Already-added files shown as selected/disabled

**Step 4: Update resources layout sidebar**

Add "Collections" link to sidebar items in `layout.js` — visible to all resource-admins.

**Step 5: Verify**

Navigate to `/workspace/resources/collections`, create a collection, add sections, assign files. Verify the collection appears in the list.

**Step 6: Commit**

```bash
git add src/app/workspace/resources/collections/ src/app/workspace/resources/layout.js
git commit -m "feat: add collections management UI (list, create, edit with sections and file picker)"
```

---

## Phase 4: Public Portal

### Task 10: Public resources API routes

**Files:**
- Create: `src/app/api/resources/national/route.js`
- Create: `src/app/api/resources/national/[collectionSlug]/route.js`
- Create: `src/app/api/resources/chapters/[slugOrId]/route.js`
- Create: `src/app/api/resources/chapters/[slugOrId]/[collectionSlug]/route.js`

**Step 1: Create `src/app/api/resources/national/route.js`**

```js
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - List national collections (public, no auth)
export async function GET() {
  const adminClient = createAdminClient()

  const { data: collections, error } = await adminClient
    .from('resource_collections')
    .select(`
      id, name, slug, description, sort_order,
      resource_sections (
        id,
        resource_section_files (
          file_id,
          files!inner (
            id, mime_type, access_tier
          )
        )
      )
    `)
    .is('chapter_id', null)
    .order('sort_order')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrich with first image for thumbnail and asset count
  const enriched = collections.map(c => {
    let assetCount = 0
    let thumbnailFileId = null

    for (const section of (c.resource_sections || [])) {
      for (const sf of (section.resource_section_files || [])) {
        if (sf.files?.access_tier === 'public') {
          assetCount++
          if (!thumbnailFileId && sf.files.mime_type?.startsWith('image/')) {
            thumbnailFileId = sf.files.id
          }
        }
      }
    }

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      asset_count: assetCount,
      thumbnail_file_id: thumbnailFileId,
    }
  })

  return NextResponse.json({ collections: enriched })
}
```

**Step 2: Create `src/app/api/resources/national/[collectionSlug]/route.js`**

GET — fetches collection by slug where `chapter_id IS NULL`, includes sections with files. Only returns files where `access_tier = 'public'` and `deleted_at IS NULL`. Returns full file metadata (id, original_filename, mime_type, file_size_bytes, description) for each file in each section.

**Step 3: Create chapter endpoints**

`src/app/api/resources/chapters/[slugOrId]/route.js`:
- Resolves chapter by slug first, then UUID fallback
- Returns 404 if not found or `public_resources_enabled` is false
- Returns chapter info + chapter collections + national collections

`src/app/api/resources/chapters/[slugOrId]/[collectionSlug]/route.js`:
- Same chapter resolution
- Fetches specific collection (could be chapter-scoped or national)

**Step 4: Commit**

```bash
git add src/app/api/resources/
git commit -m "feat: add public resources API routes (national + chapter portals)"
```

---

### Task 11: Public portal pages — national

**Files:**
- Create: `src/app/resources/layout.js`
- Create: `src/app/resources/page.js`
- Create: `src/app/resources/ResourcesPortal.js`

**Step 1: Create `src/app/resources/layout.js`**

```js
export const metadata = {
  title: 'Resources — Labor Party',
  description: 'Download brand assets, logos, templates, and more',
}

export default function ResourcesLayout({ children }) {
  return (
    <div className="min-h-screen bg-stone-50">
      {children}
    </div>
  )
}
```

No auth, no workspace layout. Clean public page.

**Step 2: Create `src/app/resources/page.js`**

Server component that fetches national collections directly (server-side Supabase query, no API call needed) and renders the portal.

**Step 3: Create `ResourcesPortal.js`**

Public portal component showing:
- Header: organization name, "Resources" title, brief description
- Collection cards in a responsive grid (2-3 columns)
- Each card: thumbnail (from first image in collection, via `/api/files/preview/[id]`), collection name, description snippet, asset count
- Click card → navigates to `/resources/[collection-slug]` (for national) or `/resources/[chapter-slug]/[collection-slug]`

Design:
- Clean, minimal Brandfolder aesthetic
- `bg-stone-50` page background
- White cards with `border-stone-200`, `shadow-sm`, `rounded-lg`
- `text-2xl font-medium tracking-tight` for page title
- `text-sm text-gray-600` for descriptions
- `labor-red` accents on hover states

**Step 4: Commit**

```bash
git add src/app/resources/
git commit -m "feat: add national public resources portal page"
```

---

### Task 12: Public portal — collection detail page

**Files:**
- Create: `src/app/resources/[collectionSlug]/page.js`
- Create: `src/app/resources/[collectionSlug]/CollectionPage.js`
- Create: `src/app/resources/[collectionSlug]/AssetDetailModal.js`

**Step 1: Create `page.js`**

Server component. Fetches collection by slug (national scope). 404 if not found.

**Step 2: Create `CollectionPage.js`**

Brandfolder-style layout:
- Back link to `/resources`
- Collection name as page title, description below
- Sections rendered as horizontal bands:
  - Section name as `text-sm uppercase tracking-wide text-gray-500 font-medium` header
  - Thumbnail grid below (responsive: 2 cols mobile, 3 cols tablet, 4-5 cols desktop)
  - Each thumbnail: image preview for images, file type icon for docs/videos
  - Filename below thumbnail in `text-xs text-gray-700`
  - Click thumbnail → opens `AssetDetailModal`

**Step 3: Create `AssetDetailModal.js`**

Full-screen overlay with:
- Large preview (image rendered full-width, or file type icon + filename for non-images)
- File metadata: filename, file type, file size
- Description if present
- Download button (labor-red, full width) — links to `/api/files/download/[id]`
- Close button (X) top right
- Click overlay to close, Escape to close

**Step 4: Commit**

```bash
git add src/app/resources/[collectionSlug]/
git commit -m "feat: add Brandfolder-style collection detail page with asset modal"
```

---

### Task 13: Public portal — chapter pages

**Files:**
- Create: `src/app/resources/[slugOrId]/page.js` — **Note:** this conflicts with `[collectionSlug]`. Need to restructure.

**Important: Route restructuring needed.** The URL `/resources/[x]` is ambiguous — it could be a national collection slug or a chapter slug. Two approaches:

**Approach (recommended): Unified catch-all with server-side resolution.**

Restructure routes:
```
/resources                           → page.js (national portal home)
/resources/c/[collectionSlug]        → national collection detail
/resources/[slugOrId]                → chapter portal home
/resources/[slugOrId]/[colSlug]      → chapter collection detail
```

The `/resources/c/` prefix disambiguates national collections from chapter slugs. This is clean and avoids the need for a catch-all.

**Step 1: Move national collection route**

- Move `src/app/resources/[collectionSlug]/` to `src/app/resources/c/[collectionSlug]/`
- Update links in `ResourcesPortal.js` to use `/resources/c/[slug]`

**Step 2: Create chapter portal page at `src/app/resources/[slugOrId]/page.js`**

Server component:
- Resolve chapter by slug first, UUID fallback
- 404 if not found or `public_resources_enabled` is false
- Fetch chapter's collections + national collections
- Render same `ResourcesPortal` component but with chapter name in header
- National collections shown under a "National Resources" separator

**Step 3: Create chapter collection detail at `src/app/resources/[slugOrId]/[collectionSlug]/page.js`**

Same as national collection detail page but scoped to the chapter. Reuses `CollectionPage` and `AssetDetailModal` components.

**Step 4: Verify**

- `/resources` — shows national collections
- `/resources/c/logos` — shows national "Logos" collection detail
- `/resources/ohio` — shows Ohio chapter portal (if `slug = 'ohio'` and `public_resources_enabled = true`)
- `/resources/ohio/local-materials` — shows Ohio's "Local Materials" collection
- `/resources/ohio/logos` — shows national "Logos" collection accessed via Ohio portal

**Step 5: Commit**

```bash
git add src/app/resources/
git commit -m "feat: add chapter public resource portals with national collection inheritance"
```

---

## Phase 5: Polish & Integration

### Task 14: Chapter admin settings for public portal

**Files:**
- Modify: `src/app/workspace/chapters/[id]/page.js` (or wherever chapter settings live)

**Step 1: Add slug and public_resources_enabled fields**

In the chapter detail/edit page within workspace:
- Add "Public Resources" section
- Toggle for `public_resources_enabled`
- Slug input (auto-generated from chapter name, editable)
- Show public URL preview: `yourdomain.com/resources/[slug]`
- Only visible to super_admin and national_admin

**Step 2: Create API route or extend existing chapter update**

Allow updating `slug` and `public_resources_enabled` on the chapters table.

**Step 3: Commit**

```bash
git add src/app/workspace/chapters/ src/app/api/
git commit -m "feat: add chapter public resources settings (slug + enable toggle)"
```

---

### Task 15: Final integration and navigation

**Files:**
- Modify: `src/app/workspace/resources/layout.js` — final sidebar structure
- Verify all routes work end-to-end

**Step 1: Final sidebar structure**

```js
const sidebarItems = [
  { type: 'link', label: 'Upload Files', href: '/workspace/resources/upload', variant: 'primary' },
  { type: 'divider' },
  { type: 'link', label: 'All Files', href: '/workspace/resources' },
  { type: 'link', label: 'Collections', href: '/workspace/resources/collections' },
  { type: 'header', label: 'Folders' },
  // FolderTree component renders here
]
```

**Step 2: End-to-end verification checklist**

- [ ] Create folder in workspace → appears in tree
- [ ] Upload file to folder → file appears in folder view
- [ ] Move file between folders → file moves correctly
- [ ] Create collection → appears in collections list
- [ ] Add sections to collection → sections appear
- [ ] Assign public files to section → files appear in section
- [ ] View `/resources` → national collections visible
- [ ] Click collection → Brandfolder-style section layout
- [ ] Click asset → detail modal with download
- [ ] Enable chapter public portal → chapter page accessible
- [ ] Chapter portal shows chapter + national collections
- [ ] Disabled chapter returns 404

**Step 3: Commit**

```bash
git add .
git commit -m "feat: finalize resources portal integration and navigation"
```
