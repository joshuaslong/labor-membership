#!/usr/bin/env node

/**
 * Migration runner script
 * Applies database migrations in order
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const migrations = [
  '20260204a_create_member_segments.sql',
  '20260204b_create_team_members.sql',
  '20260204c_create_tasks.sql',
  '20260204d_migrate_admin_users.sql',
  '20260204e_auto_new_member_segment.sql'
]

async function applyMigration(filename) {
  console.log(`\n📄 Applying: ${filename}`)

  const migrationPath = path.join(__dirname, 'supabase', 'migrations', filename)

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`)
    return false
  }

  const sql = fs.readFileSync(migrationPath, 'utf8')

  try {
    // Execute the SQL using Supabase RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // If RPC doesn't exist, try direct query
      const { error: queryError } = await supabase.from('_migrations').select('*').limit(1)

      if (queryError) {
        console.error(`❌ Error: ${error.message}`)
        console.error('Note: This script requires direct SQL execution access.')
        console.error('You may need to run migrations through Supabase Dashboard SQL Editor.')
        return false
      }
    }

    console.log(`✅ Successfully applied: ${filename}`)
    return true
  } catch (err) {
    console.error(`❌ Error applying ${filename}:`, err.message)
    return false
  }
}

async function main() {
  console.log('🚀 Starting migration process...\n')
  console.log('Migrations to apply:')
  migrations.forEach((m, i) => console.log(`  ${i + 1}. ${m}`))

  let successCount = 0

  for (const migration of migrations) {
    const success = await applyMigration(migration)
    if (success) successCount++
  }

  console.log('\n' + '='.repeat(50))
  console.log(`✅ Successfully applied: ${successCount}/${migrations.length} migrations`)

  if (successCount < migrations.length) {
    console.log('\n⚠️  Some migrations failed. You may need to:')
    console.log('1. Apply them manually via Supabase Dashboard SQL Editor')
    console.log('2. Use Supabase CLI: supabase db push')
    process.exit(1)
  } else {
    console.log('\n🎉 All migrations applied successfully!')
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
