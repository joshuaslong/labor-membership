import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  const supabase = await createClient()

  // Handle PKCE flow (code exchange)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      await linkMemberToUser(supabase)

      // For password recovery, redirect to reset-password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Handle token hash flow (magic link, password recovery email link)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      await linkMemberToUser(supabase)

      // For password recovery, redirect to reset-password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return to login with error
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`)
}

async function linkMemberToUser(supabase) {
  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Check if this user needs to be linked to an existing member record
    const adminClient = createAdminClient()

    // Find member by email that doesn't have a user_id yet
    const { data: member } = await adminClient
      .from('members')
      .select('id, user_id')
      .eq('email', user.email)
      .single()

    if (member && !member.user_id) {
      // Link the auth user to the existing member record
      await adminClient
        .from('members')
        .update({ user_id: user.id })
        .eq('id', member.id)
    }
  }
}
