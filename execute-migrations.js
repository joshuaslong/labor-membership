#!/usr/bin/env node

/**
 * Execute migrations via PostgreSQL direct connection
 * Requires: npm install pg
 */

const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: '.env.local' })

const migrations = [
  '20260204a_create_member_segments.sql',
  '20260204b_create_team_members.sql',
  '20260204c_create_tasks.sql',
  '20260204d_migrate_admin_users.sql',
  '20260204e_auto_new_member_segment.sql'
]

async function executeMigrations() {
  // Check if pg is installed
  let pg
  try {
    pg = require('pg')
  } catch (err) {
    console.log('\n📦 Installing pg package...\n')
    const { execSync } = require('child_process')
    execSync('npm install pg', { stdio: 'inherit' })
    pg = require('pg')
  }

  const { Client } = pg

  // Get Supabase connection details
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

  if (!projectRef) {
    console.error('❌ Could not parse Supabase URL')
    process.exit(1)
  }

  // Check for database password
  const dbPassword = process.env.DATABASE_PASSWORD || process.env.SUPABASE_DB_PASSWORD

  if (!dbPassword) {
    console.log('\n❌ Database password not found in .env.local\n')
    console.log('To execute migrations programmatically, you need the database password.')
    console.log('\nHow to get it:')
    console.log('1. Go to: https://vzlqpihtmwqjolusyyqw.supabase.co/project/vzlqpihtmwqjolusyyqw/settings/database')
    console.log('2. Copy the database password')
    console.log('3. Add to .env.local: DATABASE_PASSWORD=your_password_here')
    console.log('\nOR use the SQL Editor (easier):')
    console.log('https://vzlqpihtmwqjolusyyqw.supabase.co/project/vzlqpihtmwqjolusyyqw/sql/new')
    console.log('Copy/paste from APPLY-MIGRATIONS.md')
    process.exit(1)
  }

  // Connect to database
  const connectionString = `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`

  console.log('\n🔌 Connecting to database...\n')

  const client = new Client({ connectionString })

  try {
    await client.connect()
    console.log('✅ Connected successfully\n')

    let successCount = 0

    for (const filename of migrations) {
      console.log(`📄 Applying: ${filename}`)

      const migrationPath = path.join(__dirname, 'supabase', 'migrations', filename)
      const sql = fs.readFileSync(migrationPath, 'utf8')

      try {
        await client.query(sql)
        console.log(`✅ Success: ${filename}\n`)
        successCount++
      } catch (err) {
        console.error(`❌ Failed: ${filename}`)
        console.error(err.message)
        console.log()
      }
    }

    console.log('='.repeat(50))
    console.log(`✅ Applied ${successCount}/${migrations.length} migrations`)
    console.log('='.repeat(50))

    if (successCount === migrations.length) {
      console.log('\n🎉 All migrations successful!')
      console.log('Refresh http://localhost:3001/workspace to test\n')
    }

  } catch (err) {
    console.error('\n❌ Connection error:', err.message)
    console.log('\nVerify your database password is correct.')
  } finally {
    await client.end()
  }
}

executeMigrations().catch(console.error)
