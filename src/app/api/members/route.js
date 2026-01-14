import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const chapter_id = searchParams.get('chapter_id')
  const status = searchParams.get('status')

  const supabase = createAdminClient()

  let query = supabase
    .from('members')
    .select('*, chapters(name, level)')
    .order('last_name')

  if (chapter_id) query = query.eq('chapter_id', chapter_id)
  if (status) query = query.eq('status', status)

  const { data: members, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ members })
}

export async function POST(request) {
  const data = await request.json()
  const supabase = createAdminClient()

  // Validate required fields
  if (!data.first_name || !data.last_name || !data.email || !data.chapter_id) {
    return NextResponse.json(
      { error: 'First name, last name, email, and chapter are required' },
      { status: 400 }
    )
  }

  // Check if email exists
  const { data: existing } = await supabase
    .from('members')
    .select('id')
    .eq('email', data.email)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'A member with this email already exists' },
      { status: 409 }
    )
  }

  // Create member record - active immediately
  const { data: member, error: memberError } = await supabase
    .from('members')
    .insert({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone || null,
      address_line1: data.address_line1 || null,
      city: data.city || null,
      state: data.state || null,
      zip_code: data.zip_code || null,
      chapter_id: data.chapter_id,
      status: 'active',
    })
    .select()
    .single()

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ member }, { status: 201 })
}
