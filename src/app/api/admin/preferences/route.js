import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/admin/preferences - Get current admin's preferences
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is an admin
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!adminUser) {
    return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
  }

  // Get preferences
  const { data: preferences, error } = await supabase
    .from('admin_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    preferences: preferences || { default_reply_to: '', default_signature: '' }
  })
}

// PUT /api/admin/preferences - Update current admin's preferences
export async function PUT(request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is an admin
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!adminUser) {
    return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
  }

  const body = await request.json()
  const { default_reply_to, default_signature } = body

  // Upsert preferences
  const { data, error } = await supabase
    .from('admin_preferences')
    .upsert({
      user_id: user.id,
      default_reply_to: default_reply_to || null,
      default_signature: default_signature || null,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ preferences: data })
}
