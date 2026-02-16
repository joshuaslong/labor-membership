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
