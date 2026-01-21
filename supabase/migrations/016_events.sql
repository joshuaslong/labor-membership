-- Events and Calendar for Labor Party Chapters
-- Allows chapters to create events and members to RSVP

-- Event status enum
create type event_status as enum ('draft', 'published', 'cancelled');

-- RSVP status enum
create type rsvp_status as enum ('attending', 'maybe', 'declined');

-- Events table
create table events (
  id uuid primary key default gen_random_uuid(),

  -- Event belongs to a chapter (inherits to all sub-chapters)
  chapter_id uuid not null references chapters(id) on delete cascade,

  -- Created by an admin
  created_by uuid references admin_users(id) on delete set null,

  -- Event details
  title text not null,
  description text,

  -- Location (can be virtual or physical)
  location_name text,
  location_address text,
  location_city text,
  location_state text,
  location_zip text,
  is_virtual boolean default false,
  virtual_link text,

  -- Date and time
  start_date date not null,
  start_time time,
  end_date date,
  end_time time,
  timezone text default 'America/Chicago',

  -- Event options
  status event_status default 'draft',
  is_all_day boolean default false,
  max_attendees int,
  rsvp_deadline timestamp with time zone,

  -- Optional image
  image_url text,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Event RSVPs
create table event_rsvps (
  id uuid primary key default gen_random_uuid(),

  event_id uuid not null references events(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,

  status rsvp_status not null default 'attending',

  -- Optional fields
  guest_count int default 0,
  notes text,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  -- One RSVP per member per event
  unique(event_id, member_id)
);

-- Function to get events visible to a member (their chapter and all ancestors)
create or replace function get_member_visible_events(member_uuid uuid)
returns table(
  id uuid,
  chapter_id uuid,
  chapter_name text,
  title text,
  description text,
  location_name text,
  location_address text,
  location_city text,
  location_state text,
  location_zip text,
  is_virtual boolean,
  virtual_link text,
  start_date date,
  start_time time,
  end_date date,
  end_time time,
  timezone text,
  status event_status,
  is_all_day boolean,
  max_attendees int,
  rsvp_deadline timestamp with time zone,
  image_url text,
  created_at timestamp with time zone
) as $$
  select
    e.id, e.chapter_id, c.name as chapter_name,
    e.title, e.description,
    e.location_name, e.location_address, e.location_city, e.location_state, e.location_zip,
    e.is_virtual, e.virtual_link,
    e.start_date, e.start_time, e.end_date, e.end_time, e.timezone,
    e.status, e.is_all_day, e.max_attendees, e.rsvp_deadline,
    e.image_url, e.created_at
  from events e
  join chapters c on e.chapter_id = c.id
  where e.status = 'published'
  and e.chapter_id in (
    select ancestor.id
    from members m
    cross join lateral get_chapter_ancestors(m.chapter_id) ancestor
    where m.id = member_uuid
  )
  order by e.start_date asc, e.start_time asc;
$$ language sql stable;

-- Function to get RSVP count for an event
create or replace function get_event_rsvp_count(event_uuid uuid, rsvp_stat rsvp_status default 'attending')
returns bigint as $$
  select coalesce(sum(1 + guest_count), 0)
  from event_rsvps
  where event_id = event_uuid
  and status = rsvp_stat;
$$ language sql stable;

-- Enable RLS
alter table events enable row level security;
alter table event_rsvps enable row level security;

-- Public can view published events (for chapter pages)
create policy "Anyone can view published events"
  on events for select
  using (status = 'published');

-- Members can view their own RSVPs
create policy "Members can view own RSVPs"
  on event_rsvps for select
  using (
    member_id in (
      select id from members where user_id = auth.uid()
    )
  );

-- Members can insert their own RSVPs
create policy "Members can RSVP to events"
  on event_rsvps for insert
  with check (
    member_id in (
      select id from members where user_id = auth.uid()
    )
  );

-- Members can update their own RSVPs
create policy "Members can update own RSVPs"
  on event_rsvps for update
  using (
    member_id in (
      select id from members where user_id = auth.uid()
    )
  );

-- Members can delete their own RSVPs
create policy "Members can delete own RSVPs"
  on event_rsvps for delete
  using (
    member_id in (
      select id from members where user_id = auth.uid()
    )
  );

-- Indexes
create index idx_events_chapter on events(chapter_id);
create index idx_events_status on events(status);
create index idx_events_start_date on events(start_date);
create index idx_events_start_date_time on events(start_date, start_time);
create index idx_event_rsvps_event on event_rsvps(event_id);
create index idx_event_rsvps_member on event_rsvps(member_id);
create index idx_event_rsvps_status on event_rsvps(status);

-- Updated at triggers
create trigger events_updated_at
  before update on events
  for each row execute function update_updated_at();

create trigger event_rsvps_updated_at
  before update on event_rsvps
  for each row execute function update_updated_at();
