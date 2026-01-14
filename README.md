# Labor Party Membership Platform

A membership management system with hierarchical chapters (national > state > county > city). Members at any level are automatically included in all levels above them.

## Features

- **Hierarchical Chapters**: National, state, county, and city levels with automatic roll-up
- **Membership Management**: Join flow with Stripe subscription for dues
- **Member Roll-up**: View member counts at any level including all sub-chapters
- **Stripe Integration**: Monthly or annual dues with automatic renewal
- **Admin Dashboard**: Stats, recent members, chapter management

## Tech Stack

- Next.js 15 (App Router)
- Supabase (PostgreSQL + Auth)
- Stripe (Subscriptions)
- Tailwind CSS

## Setup

### 1. Clone and Install

```bash
npm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/001_schema.sql` via the SQL Editor
3. Get your keys from Project Settings > API

### 3. Set Up Stripe

1. Create account at [stripe.com](https://stripe.com)
2. Get API keys from Developers section
3. Set up webhook endpoint: `https://your-domain.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`

### 4. Configure Environment

```bash
cp .env.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`

### 5. Run Development Server

```bash
npm run dev
```

### 6. Create Initial Data

1. The migration creates a "Labor Party National" chapter automatically
2. Go to `/admin/chapters/new` to create state, county, and city chapters
3. Go to `/join` to test the membership flow

## Chapter Hierarchy

```
National (top level)
└── State
    └── County
        └── City (most local)
```

When a member joins a city chapter, they're automatically counted in the county, state, and national totals. The database uses recursive functions to calculate these roll-ups efficiently.

## Dues Structure

Default pricing (edit in `/src/app/api/members/route.js`):
- Monthly: $10/month
- Annual: $100/year

## Stripe Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activates membership |
| `invoice.paid` | Records payment, updates last payment date |
| `invoice.payment_failed` | Marks membership as lapsed |
| `customer.subscription.deleted` | Marks membership as cancelled |

## For Claude Code

If you're using this as a starting point with Claude Code:

```bash
mkdir membership-platform
cd membership-platform
claude
```

Then tell Claude:
```
Unzip the membership-platform.zip I uploaded and set up the project. 
I need to configure Supabase and Stripe.
```

Claude will help you:
1. Extract the files
2. Run `npm install`
3. Walk through environment variable setup
4. Run the database migration
5. Test the application
