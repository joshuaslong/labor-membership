#!/usr/bin/env node

/**
 * Execute migrations using direct PostgreSQL connection
 * Requires the postgres package
 */

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

require('dotenv').config({ path: '.env.local' })

const migrations = [
  '20260204a_create_member_segments.sql',
  '20260204b_create_team_members.sql',
  '20260204c_create_tasks.sql',
  '20260204d_migrate_admin_users.sql',
  '20260204e_auto_new_member_segment.sql'
]

async function runMigrations() {
  // Extract project ref from Supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)

  if (!match) {
    console.error('Could not parse Supabase URL')
    process.exit(1)
  }

  const projectRef = match[1]

  // Construct PostgreSQL connection string
  // Note: We need the database password, which we don't have
  // The service role key is for the API, not for direct DB connections

  console.log('\n❌ Cannot execute migrations programmatically\n')
  console.log('The Supabase service role key is for API access, not direct database connections.')
  console.log('\nYou need to either:')
  console.log('1. Use the Supabase Dashboard SQL Editor (recommended)')
  console.log('   https://vzlqpihtmwqjolusyyqw.supabase.co/project/vzlqpihtmwqjolusyyqw/sql/new')
  console.log('\n2. Get your database password from Supabase Dashboard → Settings → Database')
  console.log('   and add it to .env.local as DATABASE_PASSWORD')
  console.log('\n3. Install and use Supabase CLI: supabase db push')
  console.log('\nSee APPLY-MIGRATIONS.md for the SQL to copy/paste.')
}

runMigrations().catch(console.error)
