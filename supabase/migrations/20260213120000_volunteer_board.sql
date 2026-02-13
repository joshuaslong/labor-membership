-- Volunteer Board: opportunities + applications

-- volunteer_opportunities table
CREATE TABLE volunteer_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  created_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  opportunity_type TEXT NOT NULL CHECK (opportunity_type IN ('one_time', 'ongoing')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'filled', 'cancelled')),
  -- One-time fields
  event_date DATE,
  start_time TIME,
  end_time TIME,
  -- Location
  location_name TEXT,
  is_remote BOOLEAN DEFAULT false,
  -- Requirements
  skills_needed TEXT[] DEFAULT '{}',
  spots_available INTEGER,
  time_commitment TEXT,
  deadline DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- volunteer_applications table
CREATE TABLE volunteer_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES volunteer_opportunities(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  message TEXT,
  availability_notes TEXT,
  reviewed_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(opportunity_id, member_id)
);

-- Indexes
CREATE INDEX idx_vol_opps_chapter ON volunteer_opportunities(chapter_id);
CREATE INDEX idx_vol_opps_status ON volunteer_opportunities(status);
CREATE INDEX idx_vol_opps_type ON volunteer_opportunities(opportunity_type);
CREATE INDEX idx_vol_opps_event_date ON volunteer_opportunities(event_date);
CREATE INDEX idx_vol_opps_skills ON volunteer_opportunities USING GIN(skills_needed);

CREATE INDEX idx_vol_apps_opportunity ON volunteer_applications(opportunity_id);
CREATE INDEX idx_vol_apps_member ON volunteer_applications(member_id);
CREATE INDEX idx_vol_apps_status ON volunteer_applications(status);

-- RLS
ALTER TABLE volunteer_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can view published opportunities
CREATE POLICY "Anyone can view published opportunities"
  ON volunteer_opportunities FOR SELECT
  USING (status = 'published');

-- Members can view their own applications
CREATE POLICY "Members can view own applications"
  ON volunteer_applications FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Members can insert their own applications
CREATE POLICY "Members can apply"
  ON volunteer_applications FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Members can update their own applications (withdraw)
CREATE POLICY "Members can update own applications"
  ON volunteer_applications FOR UPDATE TO authenticated
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_volunteer_opportunities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER volunteer_opportunities_updated_at
  BEFORE UPDATE ON volunteer_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_volunteer_opportunities_updated_at();

CREATE OR REPLACE FUNCTION update_volunteer_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER volunteer_applications_updated_at
  BEFORE UPDATE ON volunteer_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_volunteer_applications_updated_at();
