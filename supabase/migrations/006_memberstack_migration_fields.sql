-- Add fields for Memberstack migration

-- Track original Memberstack ID for migration reference
alter table members add column if not exists memberstack_id text unique;

-- Last login tracking
alter table members add column if not exists last_login_at timestamp with time zone;

-- Member bio
alter table members add column if not exists bio text;

-- Volunteering fields
alter table members add column if not exists wants_to_volunteer boolean default false;
alter table members add column if not exists volunteer_details text;

-- Mailing list opt-in (for MailerLite integration)
alter table members add column if not exists mailing_list_opted_in boolean default false;

-- Index for memberstack_id lookups during migration
create index if not exists idx_members_memberstack_id on members(memberstack_id);

-- Comment for documentation
comment on column members.memberstack_id is 'Original Memberstack member ID for migration tracking';
comment on column members.wants_to_volunteer is 'Whether member has opted in to volunteer';
comment on column members.volunteer_details is 'Member volunteer experience and details';
comment on column members.mailing_list_opted_in is 'MailerLite mailing list opt-in status';
