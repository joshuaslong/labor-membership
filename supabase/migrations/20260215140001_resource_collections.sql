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

-- WRITE: Admins can manage collections in their jurisdiction
CREATE POLICY "Admins can manage collections" ON resource_collections
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
