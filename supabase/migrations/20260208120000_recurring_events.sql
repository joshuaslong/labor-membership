-- Migration: Add recurring event support with iCal RRULE

-- 1. Add recurrence columns to events table
ALTER TABLE events ADD COLUMN rrule TEXT;
ALTER TABLE events ADD COLUMN recurrence_end_date DATE;

-- 2. Create event_instance_overrides table
CREATE TABLE event_instance_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  instance_date DATE NOT NULL,

  -- Override type
  is_cancelled BOOLEAN DEFAULT false,

  -- Override fields (NULL = inherit from parent event)
  title TEXT,
  description TEXT,
  location_name TEXT,
  location_address TEXT,
  location_city TEXT,
  location_state TEXT,
  location_zip TEXT,
  is_virtual BOOLEAN,
  virtual_link TEXT,
  start_time TIME,
  end_time TIME,
  max_attendees INT,
  rsvp_deadline TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(event_id, instance_date)
);

-- Indexes
CREATE INDEX idx_instance_overrides_event ON event_instance_overrides(event_id);
CREATE INDEX idx_instance_overrides_date ON event_instance_overrides(instance_date);

-- RLS
ALTER TABLE event_instance_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view overrides for published events"
  ON event_instance_overrides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_instance_overrides.event_id
      AND events.status = 'published'
    )
  );

CREATE POLICY "Admins can manage overrides"
  ON event_instance_overrides FOR ALL
  USING (is_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER event_instance_overrides_updated_at
  BEFORE UPDATE ON event_instance_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Add instance_date to event_rsvps
ALTER TABLE event_rsvps ADD COLUMN instance_date DATE;

-- Backfill existing RSVPs with event start_date
UPDATE event_rsvps er
SET instance_date = e.start_date
FROM events e
WHERE er.event_id = e.id;

-- Make NOT NULL after backfill
ALTER TABLE event_rsvps ALTER COLUMN instance_date SET NOT NULL;

-- Drop old unique constraint, add new one including instance_date
ALTER TABLE event_rsvps DROP CONSTRAINT event_rsvps_event_id_member_id_key;
ALTER TABLE event_rsvps ADD CONSTRAINT event_rsvps_event_member_instance_unique
  UNIQUE(event_id, member_id, instance_date);

CREATE INDEX idx_event_rsvps_instance_date ON event_rsvps(instance_date);

-- 4. Add instance_date to event_guest_rsvps
ALTER TABLE event_guest_rsvps ADD COLUMN instance_date DATE;

UPDATE event_guest_rsvps egr
SET instance_date = e.start_date
FROM events e
WHERE egr.event_id = e.id;

ALTER TABLE event_guest_rsvps ALTER COLUMN instance_date SET NOT NULL;

ALTER TABLE event_guest_rsvps DROP CONSTRAINT event_guest_rsvps_event_id_email_key;
ALTER TABLE event_guest_rsvps ADD CONSTRAINT event_guest_rsvps_event_email_instance_unique
  UNIQUE(event_id, email, instance_date);

CREATE INDEX idx_event_guest_rsvps_instance_date ON event_guest_rsvps(instance_date);

-- 5. Update RPC functions to support instance_date filtering
CREATE OR REPLACE FUNCTION get_event_rsvp_count(
  event_uuid UUID,
  rsvp_stat rsvp_status DEFAULT 'attending',
  for_instance_date DATE DEFAULT NULL
)
RETURNS BIGINT AS $$
  SELECT coalesce(sum(1 + guest_count), 0)
  FROM event_rsvps
  WHERE event_id = event_uuid
  AND status = rsvp_stat
  AND (for_instance_date IS NULL OR instance_date = for_instance_date);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_total_event_rsvp_count(
  event_uuid UUID,
  for_instance_date DATE DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    member_count INTEGER;
    guest_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO member_count
    FROM event_rsvps
    WHERE event_id = event_uuid AND status = 'attending'
    AND (for_instance_date IS NULL OR instance_date = for_instance_date);

    SELECT COUNT(*) INTO guest_count
    FROM event_guest_rsvps
    WHERE event_id = event_uuid AND status = 'attending'
    AND (for_instance_date IS NULL OR instance_date = for_instance_date);

    RETURN member_count + guest_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Indexes for recurring event range queries
CREATE INDEX idx_events_recurring ON events(start_date, recurrence_end_date) WHERE rrule IS NOT NULL;
