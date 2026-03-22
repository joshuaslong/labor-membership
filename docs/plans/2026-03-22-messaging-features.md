# Messaging Features Plan — High Impact

**Date:** 2026-03-22
**Scope:** 5 high-impact features for the team messaging system
**Branch:** `claude/messaging-features-planning-QrbSP`

---

## Feature 1: Threaded Replies

Allow users to reply to a specific message, creating a sub-conversation thread.

### Database Changes

**New column on `messages`:**
```sql
ALTER TABLE messages ADD COLUMN parent_message_id UUID REFERENCES messages(id);
CREATE INDEX idx_messages_parent ON messages(parent_message_id) WHERE parent_message_id IS NOT NULL;
```

**New view/query helper:** For each top-level message, include `reply_count` and `latest_reply_at` so the UI can show "3 replies" inline.

### API Changes

- `GET /channels/[id]/messages` — Add `reply_count` and `latest_reply_at` to each top-level message. Exclude thread replies from the main feed (where `parent_message_id IS NULL`).
- `GET /channels/[id]/messages/[messageId]/thread` — New endpoint. Returns the parent message + all replies, paginated.
- `POST /channels/[id]/messages` — Accept optional `parentMessageId` in body. Validate parent exists and belongs to same channel.

### Frontend Changes

- **MessageBubble.js** — Add "Reply" button (alongside react/edit/delete). Show reply count badge: "3 replies" with latest reply timestamp. Clicking opens thread panel.
- **ThreadPanel.js** — New component. Slides in from the right (or replaces chat area on mobile). Shows parent message at top, then threaded replies below. Has its own MessageComposer pinned at bottom.
- **ChatArea.js** — Manage `activeThreadId` state. When set, show ThreadPanel alongside (desktop) or instead of (mobile) the main feed.
- **useChannel.js** — Add `threadMessages` state and `loadThread(messageId)` function. Subscribe to realtime for thread replies (filter on `parent_message_id`).

### Push Notifications

- When replying in a thread, notify the parent message author + other thread participants (not the whole channel).

---

## Feature 2: Direct Messages (DMs)

1:1 and small-group conversations between team members, outside of channels.

### Database Changes

**New column on `channels`:**
```sql
ALTER TABLE channels ADD COLUMN is_dm BOOLEAN DEFAULT FALSE;
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_chapter_id_name_key;
-- Re-add unique constraint only for non-DM channels:
CREATE UNIQUE INDEX channels_chapter_name_unique ON channels(chapter_id, name) WHERE is_dm = FALSE;
```

DMs reuse the existing `channels` + `channel_members` + `messages` infrastructure. A DM is just a channel with `is_dm = TRUE`, no public name, and 2+ fixed members.

### API Changes

- `POST /messaging/dms` — New endpoint. Accepts `teamMemberIds[]`. Checks if a DM already exists with exactly those members (deduplication). If not, creates a channel with `is_dm=true`, `is_private=true`, adds members. Returns channel.
- `GET /messaging/channels` — Update to separate DMs from channels in response: `{ channels: [...], dms: [...] }`. DM display name derived from member names (not channel name).
- Existing message/reaction/attachment endpoints work unchanged since DMs are channels.

### Frontend Changes

- **ChannelSidebar.js** — Add "Direct Messages" section below channels list. Show DMs with member name(s) and avatar(s). "New Message" button opens member picker.
- **NewDMModal.js** — New component. Search/select team members. Creates or navigates to existing DM.
- **ChannelHeader.js** — For DMs, show member name(s) and online status instead of channel name/description.
- All existing ChatArea, MessageBubble, MessageComposer work as-is.

### Deduplication Logic

When creating a DM, sort member IDs and check for existing channel where `is_dm=true` and channel_members match exactly. This prevents duplicate conversations.

---

## Feature 3: Message Search

Full-text search across all messages the user has access to.

### Database Changes

```sql
-- Add tsvector column for full-text search
ALTER TABLE messages ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;
CREATE INDEX idx_messages_search ON messages USING GIN(search_vector);
```

Using a generated column means the index stays in sync automatically with zero application code.

### API Changes

- `GET /messaging/search?q=term&channelId=optional&limit=20&cursor=id` — New endpoint.
  - Query: `WHERE search_vector @@ plainto_tsquery('english', $query)` filtered by channels the user is a member of.
  - Optional `channelId` filter to scope search to one channel.
  - Returns messages with channel name, sender name, timestamp, and a text snippet with highlighted matches via `ts_headline()`.
  - Cursor-based pagination by message id.
  - RLS ensures users only see messages from their joined channels.

### Frontend Changes

- **SearchModal.js** — New component. Opened via search icon in the messaging header or Cmd+K shortcut. Text input with debounced search (300ms). Results list with message preview, channel name, sender, timestamp. Clicking a result navigates to that channel and scrolls to the message.
- **ChatArea.js** — Add `scrollToMessageId` prop. When set, scroll to and briefly highlight that message.
- **ChannelHeader.js** — Add search icon button.

---

## Feature 4: Typing Indicators

Show who's currently typing in a channel using Supabase Realtime Presence.

### No Database Changes

This is entirely in-memory via Supabase Presence (ephemeral state).

### API Changes

None — Presence is client-side only via Supabase JS SDK.

### Frontend Changes

- **useTypingIndicator.js** — New hook.
  - Joins a Presence channel scoped to the messaging channel: `realtime:typing:{channelId}`.
  - On keypress in composer, broadcast `{ userId, firstName }` with a 3-second debounce (don't spam).
  - Track remote users' typing state. Auto-expire after 4 seconds of no update.
  - Returns `typingUsers: [{ id, firstName }]`.
  - Cleanup: leave Presence channel on unmount or channel switch.

- **TypingIndicator.js** — New component. Renders below the message list / above composer.
  - 1 user: "Alex is typing..."
  - 2 users: "Alex and Jordan are typing..."
  - 3+ users: "Several people are typing..."
  - Animated dots (CSS only).

- **MessageComposer.js** — Call `startTyping()` from the hook on input change. Call `stopTyping()` on send or blur.

- **ChatArea.js** — Render `<TypingIndicator>` between messages and composer.

---

## Feature 5: @Mentions & Targeted Notifications

Mention team members in messages with `@name` to notify them specifically.

### Database Changes

```sql
CREATE TABLE message_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, team_member_id)
);
CREATE INDEX idx_message_mentions_member ON message_mentions(team_member_id);

-- Enable RLS
ALTER TABLE message_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Channel members can view mentions"
  ON message_mentions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM messages m
    JOIN channel_members cm ON cm.channel_id = m.channel_id
    WHERE m.id = message_mentions.message_id
    AND cm.team_member_id = (SELECT id FROM team_members WHERE user_id = auth.uid())
  ));
```

### API Changes

- `POST /channels/[id]/messages` — Parse `@mentions` from content. Match display names against channel members. Insert into `message_mentions`. Trigger targeted push notifications to mentioned users (even if they have channel notifications disabled).
- `GET /channels/[id]/messages` — Include `mentions: [{ id, firstName, lastName }]` in message response.
- `GET /messaging/mentions` — New endpoint. Returns messages where the current user was mentioned, across all channels. For a "Mentions" inbox/filter view.

### Frontend Changes

- **MentionAutocomplete.js** — New component. Triggered when user types `@` in the composer. Shows dropdown of channel members filtered by typed text. Arrow keys + Enter to select. Inserts `@FirstName LastName` into the message.
- **MessageComposer.js** — Integrate MentionAutocomplete. Track cursor position to detect `@` trigger. Replace plain textarea with a contenteditable div or use a lightweight library for inline suggestions.
- **MessageBubble.js** — Render `@Name` mentions with highlighted styling (bold + accent color background).
- **ChannelSidebar.js** — Add "Mentions" item at the top that shows a badge count of unread mentions.

### Notification Behavior

- `@mention` always sends push notification, even if user has channel notifications off.
- If the mentioned user is not in the channel (shouldn't happen since autocomplete only shows members), skip silently.

---

## Implementation Order

```
Phase 1: Threads          (most impactful for daily use)
Phase 2: DMs              (builds on channels infrastructure)
Phase 3: @Mentions        (enhances threads & DMs)
Phase 4: Search           (independent, high utility)
Phase 5: Typing Indicators (polish, low complexity)
```

**Rationale:** Threads are the biggest UX gap — busy channels become unusable without them. DMs are the second most-requested pattern. Mentions synergize with both threads and DMs. Search is independent and can slot in anytime. Typing indicators are pure polish.

### Dependencies

- Threads: standalone
- DMs: standalone (reuses channel infra)
- @Mentions: benefits from threads (mention in thread context) but not blocked
- Search: standalone
- Typing Indicators: standalone

Phases 4 and 5 can be built in parallel with earlier phases since they're independent.

---

## Files to Create/Modify Per Phase

### Phase 1 — Threads
| Action | File |
|--------|------|
| Create | `supabase/migrations/YYYYMMDD_message_threads.sql` |
| Modify | `src/app/api/workspace/messaging/channels/[id]/messages/route.js` |
| Create | `src/app/api/workspace/messaging/messages/[id]/thread/route.js` |
| Modify | `src/hooks/useChannel.js` |
| Modify | `src/components/messaging/MessageBubble.js` |
| Modify | `src/components/messaging/ChatArea.js` |
| Create | `src/components/messaging/ThreadPanel.js` |
| Modify | `src/lib/web-push.js` |
| Modify | `src/app/workspace/messaging/page.js` |

### Phase 2 — DMs
| Action | File |
|--------|------|
| Create | `supabase/migrations/YYYYMMDD_dm_channels.sql` |
| Create | `src/app/api/workspace/messaging/dms/route.js` |
| Modify | `src/app/api/workspace/messaging/channels/route.js` |
| Modify | `src/components/messaging/ChannelSidebar.js` |
| Create | `src/components/messaging/NewDMModal.js` |
| Modify | `src/components/messaging/ChannelHeader.js` |

### Phase 3 — @Mentions
| Action | File |
|--------|------|
| Create | `supabase/migrations/YYYYMMDD_message_mentions.sql` |
| Modify | `src/app/api/workspace/messaging/channels/[id]/messages/route.js` |
| Create | `src/app/api/workspace/messaging/mentions/route.js` |
| Create | `src/components/messaging/MentionAutocomplete.js` |
| Modify | `src/components/messaging/MessageComposer.js` |
| Modify | `src/components/messaging/MessageBubble.js` |
| Modify | `src/components/messaging/ChannelSidebar.js` |
| Modify | `src/lib/web-push.js` |

### Phase 4 — Search
| Action | File |
|--------|------|
| Create | `supabase/migrations/YYYYMMDD_message_search.sql` |
| Create | `src/app/api/workspace/messaging/search/route.js` |
| Create | `src/components/messaging/SearchModal.js` |
| Modify | `src/components/messaging/ChannelHeader.js` |
| Modify | `src/components/messaging/ChatArea.js` |

### Phase 5 — Typing Indicators
| Action | File |
|--------|------|
| Create | `src/hooks/useTypingIndicator.js` |
| Create | `src/components/messaging/TypingIndicator.js` |
| Modify | `src/components/messaging/MessageComposer.js` |
| Modify | `src/components/messaging/ChatArea.js` |
