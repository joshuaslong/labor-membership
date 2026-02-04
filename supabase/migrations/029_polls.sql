-- Polling system: multi-question polls targeting chapters or chapter groups

-- Enums
CREATE TYPE poll_status AS ENUM ('draft', 'active', 'closed', 'archived');
CREATE TYPE poll_results_visibility AS ENUM ('after_voting', 'after_close');
CREATE TYPE poll_target_type AS ENUM ('chapter', 'group');

-- Main polls table
CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type poll_target_type NOT NULL,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  group_id UUID REFERENCES chapter_groups(id) ON DELETE CASCADE,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status poll_status DEFAULT 'draft',
  results_visibility poll_results_visibility DEFAULT 'after_voting',
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_target CHECK (
    (target_type = 'chapter' AND group_id IS NULL)
    OR (target_type = 'group' AND group_id IS NOT NULL)
  )
);

-- Questions within a poll
CREATE TABLE poll_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Answer options for each question
CREATE TABLE poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES poll_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Member votes (tracked)
CREATE TABLE poll_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES poll_questions(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, member_id)
);

-- Enable RLS
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_responses ENABLE ROW LEVEL SECURITY;

-- Admin policies (full access)
CREATE POLICY "Admins can manage polls" ON polls
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage poll_questions" ON poll_questions
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage poll_options" ON poll_options
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage poll_responses" ON poll_responses
  FOR ALL USING (is_admin(auth.uid()));

-- Members can view active polls in their chapter or group
CREATE POLICY "Members can view active polls" ON polls
  FOR SELECT USING (
    status IN ('active', 'closed')
    AND (
      (target_type = 'chapter' AND chapter_id IN (
        SELECT mc.chapter_id FROM member_chapters mc
        JOIN members m ON m.id = mc.member_id
        WHERE m.user_id = auth.uid()
      ))
      OR
      (target_type = 'group' AND group_id IN (
        SELECT mga.group_id FROM member_group_assignments mga
        JOIN members m ON m.id = mga.member_id
        WHERE m.user_id = auth.uid()
      ))
    )
  );

-- Members can view questions/options for polls they can see (relies on polls RLS)
CREATE POLICY "Members can view poll questions" ON poll_questions
  FOR SELECT USING (
    poll_id IN (SELECT id FROM polls)
  );

CREATE POLICY "Members can view poll options" ON poll_options
  FOR SELECT USING (
    question_id IN (SELECT id FROM poll_questions)
  );

-- Members can submit their own responses
CREATE POLICY "Members can submit responses" ON poll_responses
  FOR INSERT WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Members can view their own responses
CREATE POLICY "Members can view own responses" ON poll_responses
  FOR SELECT USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_polls_chapter ON polls(chapter_id);
CREATE INDEX idx_polls_group ON polls(group_id);
CREATE INDEX idx_polls_status ON polls(status);
CREATE INDEX idx_polls_created_by ON polls(created_by);
CREATE INDEX idx_poll_questions_poll ON poll_questions(poll_id);
CREATE INDEX idx_poll_questions_order ON poll_questions(poll_id, display_order);
CREATE INDEX idx_poll_options_question ON poll_options(question_id);
CREATE INDEX idx_poll_options_order ON poll_options(question_id, display_order);
CREATE INDEX idx_poll_responses_poll ON poll_responses(poll_id);
CREATE INDEX idx_poll_responses_question ON poll_responses(question_id);
CREATE INDEX idx_poll_responses_member ON poll_responses(member_id);
CREATE INDEX idx_poll_responses_option ON poll_responses(option_id);

-- Auto-update updated_at triggers
CREATE TRIGGER polls_updated_at
  BEFORE UPDATE ON polls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER poll_questions_updated_at
  BEFORE UPDATE ON poll_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Helper function: aggregate poll results
CREATE OR REPLACE FUNCTION get_poll_results(poll_uuid UUID)
RETURNS TABLE(
  question_id UUID,
  question_text TEXT,
  display_order INTEGER,
  option_id UUID,
  option_text TEXT,
  option_order INTEGER,
  vote_count BIGINT
) AS $$
  SELECT
    pq.id AS question_id,
    pq.question_text,
    pq.display_order,
    po.id AS option_id,
    po.option_text,
    po.display_order AS option_order,
    COUNT(pr.id) AS vote_count
  FROM poll_questions pq
  JOIN poll_options po ON po.question_id = pq.id
  LEFT JOIN poll_responses pr ON pr.option_id = po.id
  WHERE pq.poll_id = poll_uuid
  GROUP BY pq.id, pq.question_text, pq.display_order, po.id, po.option_text, po.display_order
  ORDER BY pq.display_order, po.display_order;
$$ LANGUAGE sql STABLE;

COMMENT ON TABLE polls IS 'Multi-question polls targeting chapters or chapter groups';
COMMENT ON TABLE poll_questions IS 'Questions within a poll';
COMMENT ON TABLE poll_options IS 'Answer options for each poll question';
COMMENT ON TABLE poll_responses IS 'Tracked member votes on poll questions';
