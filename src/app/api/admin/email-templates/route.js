import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  // Verify admin access
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Check if user is super_admin or national_admin
  const { data: teamMember } = await supabase
    .from('team_members')
    .select('id, roles, chapter_id, is_media_team')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!teamMember || !teamMember.roles.some(r => ['super_admin', 'national_admin'].includes(r))) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  try {
    const { data: templates, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('name')

    if (error) throw error

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
