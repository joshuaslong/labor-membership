import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncMemberToMailerLite } from '@/lib/mailerlite'

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
      wants_to_volunteer: data.wants_to_volunteer || false,
      volunteer_interests: data.volunteer_interests || null,
      volunteer_skills: data.volunteer_skills || null,
      mailing_list_opted_in: data.mailing_list_opted_in !== false,
    })
    .select()
    .single()

  if (memberError) {
    // Clean up: delete auth user if member creation fails
    await supabase.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  // Create member_chapters records for the primary chapter and all parent chapters
  // First, get the chapter hierarchy
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, parent_id')

  const chapterMap = {}
  chapters?.forEach(c => { chapterMap[c.id] = c })

  // Build list of chapters to add (primary + all parents)
  const chapterIds = []
  let currentChapterId = data.chapter_id
  while (currentChapterId) {
    chapterIds.push(currentChapterId)
    currentChapterId = chapterMap[currentChapterId]?.parent_id
  }

  // Insert member_chapters records
  const memberChaptersData = chapterIds.map((chapterId, index) => ({
    member_id: member.id,
    chapter_id: chapterId,
    is_primary: index === 0, // First one is primary
  }))

  if (memberChaptersData.length > 0) {
    const { error: mcError } = await supabase
      .from('member_chapters')
      .insert(memberChaptersData)

    if (mcError) {
      console.error('Error creating member_chapters:', mcError)
      // Don't fail signup, just log the error
    }
  }

  // Sync to MailerLite (async, don't block signup)
  if (process.env.MAILERLITE_API_KEY && data.mailing_list_opted_in !== false) {
    // Get chapter name for MailerLite group
    const { data: chapter } = await supabase
      .from('chapters')
      .select('name')
      .eq('id', data.chapter_id)
      .single()

    syncMemberToMailerLite({
      id: member.id,
      email: member.email,
      first_name: member.first_name,
      last_name: member.last_name,
      chapter_name: chapter?.name,
      status: 'active',
    }).catch((err) => {
      console.error('MailerLite sync error:', err)
    })
  }

  return NextResponse.json({ member, user: authData.user }, { status: 201 })
}
