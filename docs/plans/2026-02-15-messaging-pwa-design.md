# Messaging PWA — Design Document

## Overview

Internal messaging system for team members, scoped to chapters. Channels only (no DMs). Custom channels created by chapter admins. Lives at `/workspace/messaging`. PWA wrapper applies to the full `/workspace` route.

## Audience

- Team members only (`team_members` table)
- Access scoped to the chapter selected via `ChapterSwitcher` (reuses existing `chapter_scope` cookie)
- Higher-level admins (super_admin, national_admin, state_admin) see channels for whichever chapter they've selected in the switcher

## Data Model

### `channels`

| Column       | Type      | Notes                              |
|-------------|-----------|-------------------------------------|
| id          | UUID PK   |                                     |
| chapter_id  | UUID FK   | References `chapters(id)`           |
| name        | TEXT      | Channel name (e.g., "general")      |
| description | TEXT      | Optional channel description        |
| created_by  | UUID FK   | References `team_members(id)`       |
| is_archived | BOOLEAN   | Soft archive, default false         |
| created_at  | TIMESTAMPTZ |                                   |
| updated_at  | TIMESTAMPTZ |                                   |

### `channel_members`

| Column          | Type      | Notes                              |
|----------------|-----------|-------------------------------------|
| id             | UUID PK   |                                     |
| channel_id     | UUID FK   | References `channels(id)`           |
| team_member_id | UUID FK   | References `team_members(id)`       |
| role           | TEXT      | 'admin' or 'member'                |
| joined_at      | TIMESTAMPTZ |                                   |
| last_read_at   | TIMESTAMPTZ | Read cursor for unread counts     |

### `messages`

| Column     | Type      | Notes                              |
|-----------|-----------|-------------------------------------|
| id        | UUID PK   |                                     |
| channel_id| UUID FK   | References `channels(id)`           |
| sender_id | UUID FK   | References `team_members(id)`       |
| content   | TEXT      | Message body                        |
| is_edited | BOOLEAN   | Default false                       |
| is_deleted| BOOLEAN   | Soft delete, default false          |
| created_at| TIMESTAMPTZ |                                   |
| updated_at| TIMESTAMPTZ |                                   |

### `message_attachments` (stretch goal)

| Column      | Type      | Notes                              |
|------------|-----------|-------------------------------------|
| id         | UUID PK   |                                     |
| message_id | UUID FK   | References `messages(id)`           |
| file_path  | TEXT      | Supabase Storage path               |
| file_name  | TEXT      |                                     |
| file_type  | TEXT      | MIME type                           |
| file_size  | INTEGER   | Bytes                               |

## Access Control (RLS)

- Team members can only access channels where they have a `channel_members` row
- `channel_members` rows only exist for channels in chapters the team member has access to
- Channel creation restricted to team members with admin roles for that chapter
- Messages readable/writable only within joined channels

## Real-time

- Supabase Realtime subscriptions on `messages` table filtered by `channel_id`
- Supabase Presence API for online status per channel
- Subscribe on channel open, unsubscribe on channel switch/leave

## Channel Access Flow

1. Team member opens `/workspace/messaging`
2. App reads current `chapter_scope` cookie
3. Fetches channels where user has `channel_members` row AND `channel.chapter_id` matches scope
4. Switching chapters via ChapterSwitcher refreshes channel list

## Joining Channels

- Team members browse available channels in their scoped chapter and opt in
- Chapter admins can add/remove members
- No auto-join

## Unread Tracking

- `channel_members.last_read_at` vs latest `messages.created_at`
- Unread count per channel shown as badge
- Mark as read when user opens channel

## UI Layout

Two-panel layout within existing workspace shell (TopNav + ChapterSwitcher stay):

### Left Panel — Channel Sidebar (240px)
- Joined channels list with unread badges
- "Browse channels" to see all available in current chapter
- "Create channel" button for chapter admins

### Right Panel — Chat Area
- Header: channel name, description, member count
- Message list: scrollable, newest at bottom, auto-scroll, load older on scroll-up
- Composer: text input, Enter to send, Shift+Enter for newline

### Empty States
- No channels in chapter: "No channels yet. Create one to get started."
- No chapter selected: "Select a chapter to view messaging"
- Empty channel: "This is the start of #channel-name"

## Design System

Follows existing patterns:
- Stone/gray palette (`border-stone-200`, `bg-stone-50`, `text-gray-900`)
- Small text (`text-xs`, `text-sm`)
- `labor-red` for active/accent states

## PWA Configuration

- `next-pwa` or `@serwist/next` for service worker
- `manifest.json`: app name, icons, `display: standalone`, `start_url: /workspace`
- Cache static assets (JS/CSS/fonts)
- No offline messaging v1 — "You're offline" banner on disconnect
- Applies to full `/workspace`, not just messaging

## Out of Scope (v1)

- Direct messages
- Threads/replies
- Push notifications
- Offline message queue
- File attachments (stretch goal)
- Emoji reactions
- Message search
- Volunteers access
