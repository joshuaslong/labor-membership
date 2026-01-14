import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request) {
  const data = await request.json()
  const supabase = createAdminClient()

  // Validate required fields
  if (!data.email || !data.password || !data.first_name || !data.last_name || !data.chapter_id) {
    return NextResponse.json(
      { error: 'Email, password, first name, last name, and chapter are required' },
      { status: 400 }
    )
  }

  if (data.password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters' },
      { status: 400 }
    )
  }

  // Check if email exists in members
  const { data: existingMember } = await supabase
    .from('members')
    .select('id')
    .eq('email', data.email)
    .single()

  if (existingMember) {
    return NextResponse.json(
      { error: 'A member with this email already exists. Please log in instead.' },
      { status: 409 }
    )
  }

  // Create auth user using admin client
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true, // Auto-confirm for now
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Create member record linked to auth user
  const { data: member, error: memberError } = await supabase
    .from('members')
    .insert({
      user_id: authData.user.id,
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
    // Clean up: delete auth user if member creation fails
    await supabase.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ member, user: authData.user }, { status: 201 })
}
