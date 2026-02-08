-- Drop the old 2-parameter overload of get_event_rsvp_count (from 016_events.sql)
-- The 3-parameter version (with optional for_instance_date) from recurring_events migration covers both cases
-- Having both overloads causes "function is not unique" errors when called via Supabase RPC
DROP FUNCTION IF EXISTS get_event_rsvp_count(uuid, rsvp_status);

-- Drop the old 1-parameter overload of get_total_event_rsvp_count
DROP FUNCTION IF EXISTS get_total_event_rsvp_count(uuid);
