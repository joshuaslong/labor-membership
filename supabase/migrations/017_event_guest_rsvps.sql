-- Guest RSVPs for non-members who want to attend events
CREATE TABLE IF NOT EXISTS event_guest_rsvps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    status rsvp_status NOT NULL DEFAULT 'attending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, email)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_event_guest_rsvps_event_id ON event_guest_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_guest_rsvps_email ON event_guest_rsvps(email);

-- Enable RLS
ALTER TABLE event_guest_rsvps ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can create a guest RSVP for published events
CREATE POLICY "Anyone can create guest RSVP for published events"
ON event_guest_rsvps
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM events
        WHERE events.id = event_guest_rsvps.event_id
        AND events.status = 'published'
    )
);

-- Policy: Admins can view all guest RSVPs
CREATE POLICY "Admins can view guest RSVPs"
ON event_guest_rsvps
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.user_id = auth.uid()
    )
);

-- Update trigger for updated_at
CREATE TRIGGER update_event_guest_rsvps_updated_at
    BEFORE UPDATE ON event_guest_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get total RSVP count (members + guests)
CREATE OR REPLACE FUNCTION get_total_event_rsvp_count(event_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    member_count INTEGER;
    guest_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO member_count
    FROM event_rsvps
    WHERE event_id = event_uuid AND status = 'attending';

    SELECT COUNT(*) INTO guest_count
    FROM event_guest_rsvps
    WHERE event_id = event_uuid AND status = 'attending';

    RETURN member_count + guest_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
