-- Migration: Initiatives Management
-- Creates table for managing initiative campaigns

CREATE TABLE IF NOT EXISTS initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  long_description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  image_url TEXT,
  stripe_price_id TEXT,
  suggested_amounts JSONB DEFAULT '[10, 25, 50, 100]',
  allow_custom_amount BOOLEAN DEFAULT true,
  min_amount INTEGER DEFAULT 5,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_initiatives_status ON initiatives(status);
CREATE INDEX IF NOT EXISTS idx_initiatives_slug ON initiatives(slug);
CREATE INDEX IF NOT EXISTS idx_initiatives_display_order ON initiatives(display_order);

-- RLS Policies
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;

-- Anyone can view active initiatives
CREATE POLICY "Anyone can view active initiatives"
  ON initiatives FOR SELECT
  USING (status = 'active');

-- Admins can view all initiatives
CREATE POLICY "Admins can view all initiatives"
  ON initiatives FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('super_admin', 'national_admin')
    )
  );

-- Super admins and national admins can insert
CREATE POLICY "Admins can insert initiatives"
  ON initiatives FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('super_admin', 'national_admin')
    )
  );

-- Super admins and national admins can update
CREATE POLICY "Admins can update initiatives"
  ON initiatives FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('super_admin', 'national_admin')
    )
  );

-- Super admins can delete
CREATE POLICY "Super admins can delete initiatives"
  ON initiatives FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_initiative_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS initiatives_updated_at ON initiatives;
CREATE TRIGGER initiatives_updated_at
  BEFORE UPDATE ON initiatives
  FOR EACH ROW
  EXECUTE FUNCTION update_initiative_timestamp();

-- Seed with the existing initiative
INSERT INTO initiatives (slug, title, description, status, display_order) VALUES
(
  'care-packages',
  'ICE Protestor Care Packages',
  'Providing water, food, first aid, and essential supplies to protestors standing up against ICE raids in our communities.',
  'active',
  1
)
ON CONFLICT (slug) DO NOTHING;
