# Messaging PWA — Implementation Plan

## Reference
See `docs/plans/2026-02-15-messaging-pwa-design.md` for full design.

## Workstreams (parallelized)

### WS1: Database Migration (agent: db-migration)
1. Create migration file with `channels`, `channel_members`, `messages` tables
2. Add indexes (chapter_id, channel_id, sender_id, created_at)
3. Add RLS policies:
   - channels: readable by team members with channel_members row
   - channel_members: users can read/write their own rows, channel admins can manage
   - messages: readable/writable only in joined channels
4. Add updated_at triggers
5. Enable Supabase Realtime on `messages` table

### WS2: PWA Configuration (agent: pwa-setup)
1. Install `next-pwa` or `@serwist/next`
2. Create `public/manifest.json` with app metadata
3. Configure service worker in `next.config.js`
4. Create app icons (placeholder SVGs for now)
5. Add meta tags to root layout (`<link rel="manifest">`, theme-color, etc.)
6. Add offline detection banner component

### WS3: API Routes (agent: api-routes)
1. `POST /api/workspace/messaging/channels` — create channel
2. `GET /api/workspace/messaging/channels` — list channels for scoped chapter
3. `PATCH /api/workspace/messaging/channels/[id]` — update/archive channel
4. `POST /api/workspace/messaging/channels/[id]/join` — join channel
5. `POST /api/workspace/messaging/channels/[id]/leave` — leave channel
6. `GET /api/workspace/messaging/channels/[id]/members` — list channel members
7. `GET /api/workspace/messaging/channels/[id]/messages` — paginated messages
8. `POST /api/workspace/messaging/channels/[id]/messages` — send message
9. `PATCH /api/workspace/messaging/messages/[id]` — edit message
10. `DELETE /api/workspace/messaging/messages/[id]` — soft delete message
11. `POST /api/workspace/messaging/channels/[id]/read` — mark channel as read

### WS4: Frontend UI (agent: frontend-ui)
1. `/workspace/messaging/page.js` — main messaging page (client component)
2. `ChannelSidebar` component — channel list with unread badges
3. `ChatArea` component — message list + composer
4. `MessageBubble` component — individual message display
5. `MessageComposer` component — input + send button
6. `CreateChannelModal` component — channel creation form
7. `BrowseChannelsModal` component — available channels to join
8. `ChannelHeader` component — name, description, member count
9. Real-time subscription hook (`useChannel`)
10. Unread count hook (`useUnreadCounts`)
