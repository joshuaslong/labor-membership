#!/usr/bin/env node

/**
 * Display migrations for manual application via Supabase Dashboard
 */

const fs = require('fs')
const path = require('path')

const migrations = [
  '20260204a_create_member_segments.sql',
  '20260204b_create_team_members.sql',
  '20260204c_create_tasks.sql',
  '20260204d_migrate_admin_users.sql',
  '20260204e_auto_new_member_segment.sql'
]

console.log('\n' + '='.repeat(70))
console.log('DATABASE MIGRATIONS - Manual Application Instructions')
console.log('='.repeat(70))
console.log('\n📋 Go to: https://vzlqpihtmwqjolusyyqw.supabase.co/project/vzlqpihtmwqjolusyyqw/sql/new')
console.log('\nCopy and paste each migration below into the SQL Editor and click "Run".\n')

migrations.forEach((filename, index) => {
  console.log('\n' + '─'.repeat(70))
  console.log(`\n📄 MIGRATION ${index + 1}/${migrations.length}: ${filename}`)
  console.log('─'.repeat(70) + '\n')

  const migrationPath = path.join(__dirname, 'supabase', 'migrations', filename)

  if (fs.existsSync(migrationPath)) {
    const sql = fs.readFileSync(migrationPath, 'utf8')
    console.log(sql)
  } else {
    console.log(`❌ File not found: ${migrationPath}`)
  }
})

console.log('\n' + '='.repeat(70))
console.log('✅ After running all 5 migrations, your database will be ready!')
console.log('='.repeat(70) + '\n')
