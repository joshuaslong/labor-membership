-- Labor Party Membership Management Platform
-- Hierarchical chapter structure: national > state > county > city

-- Chapter levels enum
create type chapter_level as enum ('national', 'state', 'county', 'city');

-- Member status enum
create type member_status as enum ('pending', 'active', 'lapsed', 'cancelled');

-- Chapters table with hierarchy
create table chapters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level chapter_level not null,

  -- Hierarchy: parent chapter (null for national)
  parent_id uuid references chapters(id) on delete set null,

  -- Location info
  state_code char(2),
  county_name text,
  city_name text,

  -- Chapter status
  is_active boolean default true,
  founded_date date default current_date,

  -- Contact info
  contact_email text,
  contact_phone text,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Members table
create table members (
  id uuid primary key default gen_random_uuid(),

  -- Auth link (optional)
  user_id uuid references auth.users(id) on delete set null,

  -- Personal info
  first_name text not null,
  last_name text not null,
  email text unique not null,
  phone text,

  -- Address
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip_code text,

  -- Chapter assignment (the most local chapter they belong to)
  chapter_id uuid references chapters(id) on delete set null,

  -- Membership status
  status member_status default 'pending',
  joined_date timestamp with time zone default now(),

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Function to get all ancestor chapters (for roll-up queries)
create or replace function get_chapter_ancestors(chapter_uuid uuid)
returns table(id uuid, name text, level chapter_level, depth int) as $$
with recursive ancestors as (
  -- Start with the given chapter
  select c.id, c.name, c.level, c.parent_id, 0 as depth
  from chapters c
  where c.id = chapter_uuid

  union all

  -- Recursively get parents
  select c.id, c.name, c.level, c.parent_id, a.depth + 1
  from chapters c
  inner join ancestors a on c.id = a.parent_id
)
select ancestors.id, ancestors.name, ancestors.level, ancestors.depth
from ancestors;
$$ language sql stable;

-- Function to get all descendant chapters (for membership counts)
create or replace function get_chapter_descendants(chapter_uuid uuid)
returns table(id uuid, name text, level chapter_level, depth int) as $$
with recursive descendants as (
  -- Start with the given chapter
  select c.id, c.name, c.level, c.parent_id, 0 as depth
  from chapters c
  where c.id = chapter_uuid

  union all

  -- Recursively get children
  select c.id, c.name, c.level, c.parent_id, d.depth + 1
  from chapters c
  inner join descendants d on c.parent_id = d.id
)
select descendants.id, descendants.name, descendants.level, descendants.depth
from descendants;
$$ language sql stable;

-- View to get member counts for each chapter (including all sub-chapters)
create or replace function get_chapter_member_count(chapter_uuid uuid)
returns bigint as $$
  select count(*)
  from members m
  where m.status = 'active'
  and m.chapter_id in (
    select id from get_chapter_descendants(chapter_uuid)
  );
$$ language sql stable;

-- Insert national chapter
insert into chapters (name, level, state_code) values
  ('Labor Party National', 'national', null);

-- Enable RLS
alter table chapters enable row level security;
alter table members enable row level security;

-- Public read for chapters
create policy "Anyone can view chapters"
  on chapters for select using (true);

-- Members can view their own record
create policy "Members can view own record"
  on members for select
  using (auth.uid() = user_id);

-- Service role bypasses RLS for admin operations

-- Indexes
create index idx_members_chapter on members(chapter_id);
create index idx_members_status on members(status);
create index idx_members_email on members(email);
create index idx_chapters_parent on chapters(parent_id);
create index idx_chapters_level on chapters(level);

-- Updated at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger chapters_updated_at
  before update on chapters
  for each row execute function update_updated_at();

create trigger members_updated_at
  before update on members
  for each row execute function update_updated_at();
