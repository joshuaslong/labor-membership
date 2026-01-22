-- Migration: File Storage System
-- Creates tables for R2 file metadata and adds media_team flag

-- Access tier enum
CREATE TYPE file_access_tier AS ENUM ('public', 'members', 'chapter', 'media', 'internal');

-- Files metadata table
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- R2 storage info
  r2_key TEXT NOT NULL UNIQUE,
  bucket_prefix TEXT NOT NULL,

  -- File info
  original_filename TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,

  -- Access control
  access_tier file_access_tier NOT NULL DEFAULT 'chapter',
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,

  -- Metadata
  description TEXT,
  tags TEXT[],

  -- Audit trail
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add media_team flag to admin_users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_media_team BOOLEAN DEFAULT FALSE;

-- Indexes
CREATE INDEX idx_files_bucket_prefix ON files(bucket_prefix);
CREATE INDEX idx_files_access_tier ON files(access_tier);
CREATE INDEX idx_files_chapter_id ON files(chapter_id);
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX idx_files_not_deleted ON files(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_uploaded_at ON files(uploaded_at DESC);

-- Enable RLS
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public files viewable by anyone (including anonymous)
CREATE POLICY "Anyone can view public files" ON files
  FOR SELECT
  USING (access_tier = 'public' AND deleted_at IS NULL);

-- Authenticated users can view member-tier files
CREATE POLICY "Authenticated can view member files" ON files
  FOR SELECT
  TO authenticated
  USING (access_tier = 'members' AND deleted_at IS NULL);

-- Admins can view chapter files in their jurisdiction
CREATE POLICY "Admins can view chapter files" ON files
  FOR SELECT
  TO authenticated
  USING (
    access_tier = 'chapter'
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
      AND (
        au.role IN ('super_admin', 'national_admin')
        OR (
          au.chapter_id IS NOT NULL
          AND files.chapter_id IN (
            SELECT id FROM get_chapter_descendants(au.chapter_id)
          )
        )
      )
    )
  );

-- Media team can view media files
CREATE POLICY "Media team can view media files" ON files
  FOR SELECT
  TO authenticated
  USING (
    access_tier = 'media'
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND (role IN ('super_admin', 'national_admin') OR is_media_team = TRUE)
    )
  );

-- Super/national admins can view internal docs
CREATE POLICY "Super admins can view internal docs" ON files
  FOR SELECT
  TO authenticated
  USING (
    access_tier = 'internal'
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'national_admin')
    )
  );

-- Insert policy - authenticated admins can insert
CREATE POLICY "Admins can insert files" ON files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Update policy - uploader or higher admins can update
CREATE POLICY "Admins can update files" ON files
  FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'national_admin')
    )
  );

-- Delete policy (soft delete) - uploader or higher admins
CREATE POLICY "Admins can delete files" ON files
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'national_admin')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to check file access
CREATE OR REPLACE FUNCTION can_access_file(file_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  file_record RECORD;
  admin_record RECORD;
BEGIN
  SELECT access_tier, chapter_id INTO file_record
  FROM files WHERE id = file_uuid AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Public files accessible to everyone
  IF file_record.access_tier = 'public' THEN RETURN TRUE; END IF;

  -- Unauthenticated can only access public
  IF user_uuid IS NULL THEN RETURN FALSE; END IF;

  -- Members tier: any authenticated user
  IF file_record.access_tier = 'members' THEN RETURN TRUE; END IF;

  -- Check admin status for remaining tiers
  FOR admin_record IN
    SELECT role, chapter_id, is_media_team
    FROM admin_users WHERE user_id = user_uuid
  LOOP
    -- Super/national admin can access everything
    IF admin_record.role IN ('super_admin', 'national_admin') THEN
      RETURN TRUE;
    END IF;

    -- Media team can access media files
    IF file_record.access_tier = 'media' AND admin_record.is_media_team THEN
      RETURN TRUE;
    END IF;

    -- Chapter admins can access files in their jurisdiction
    IF file_record.access_tier = 'chapter' AND admin_record.chapter_id IS NOT NULL THEN
      IF file_record.chapter_id IS NULL THEN
        CONTINUE;
      END IF;
      IF EXISTS (
        SELECT 1 FROM get_chapter_descendants(admin_record.chapter_id)
        WHERE id = file_record.chapter_id
      ) THEN
        RETURN TRUE;
      END IF;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to check upload permission
CREATE OR REPLACE FUNCTION can_upload_to_bucket(bucket TEXT, chapter_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  admin_record RECORD;
BEGIN
  IF user_uuid IS NULL THEN RETURN FALSE; END IF;

  FOR admin_record IN
    SELECT role, chapter_id, is_media_team
    FROM admin_users WHERE user_id = user_uuid
  LOOP
    -- Super admin can upload anywhere
    IF admin_record.role = 'super_admin' THEN RETURN TRUE; END IF;

    -- National admin can upload to most places
    IF admin_record.role = 'national_admin' THEN
      IF bucket != 'internal-docs' THEN RETURN TRUE; END IF;
    END IF;

    -- Media team can upload to media buckets
    IF admin_record.is_media_team AND bucket IN ('media/social', 'media/podcast') THEN
      RETURN TRUE;
    END IF;

    -- Chapter admins can upload to chapters bucket in their jurisdiction
    IF bucket = 'chapters' AND admin_record.chapter_id IS NOT NULL THEN
      IF chapter_uuid IS NULL THEN
        -- Allow upload to their own chapter
        RETURN TRUE;
      END IF;
      IF EXISTS (
        SELECT 1 FROM get_chapter_descendants(admin_record.chapter_id)
        WHERE id = chapter_uuid
      ) THEN
        RETURN TRUE;
      END IF;
    END IF;

    -- Any admin can upload to public bucket
    IF bucket = 'public' THEN RETURN TRUE; END IF;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON TABLE files IS 'Metadata for files stored in Cloudflare R2';
COMMENT ON COLUMN files.r2_key IS 'Full path in R2 bucket';
COMMENT ON COLUMN files.bucket_prefix IS 'Top-level folder: public, chapters, media/social, media/podcast, internal-docs';
COMMENT ON COLUMN admin_users.is_media_team IS 'If true, user has access to media/social and media/podcast buckets';
