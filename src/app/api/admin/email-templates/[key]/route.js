import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request, { params }) {
  const { key } = await params

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
    const { data: template, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_key', key)
      .single()

    if (error) throw error

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  const { key } = await params

  // Verify admin access
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Check if user is super_admin (only super_admins can edit templates)
  const { data: teamMember } = await supabase
    .from('team_members')
    .select('id, roles, chapter_id, is_media_team')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!teamMember || !teamMember.roles.includes('super_admin')) {
    return NextResponse.json({ error: 'Only super admins can edit email templates' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { subject, html_content, enabled } = body

    const updateData = {
      updated_by: user.id,
    }

    if (subject !== undefined) updateData.subject = subject
    if (html_content !== undefined) updateData.html_content = html_content
    if (enabled !== undefined) updateData.enabled = enabled

    const { data: template, error } = await supabase
      .from('email_templates')
      .update(updateData)
      .eq('template_key', key)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
