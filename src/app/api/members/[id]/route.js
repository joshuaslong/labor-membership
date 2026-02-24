import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// DELETE - Remove a member (super_admin only)
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Check if current user is a super_admin
    const { data: teamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id, is_media_team')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    if (!teamMember || !teamMember.roles.includes('super_admin')) {
      return NextResponse.json({ error: 'Only super admins can delete members' }, { status: 403 })
    }

    // Get the member to be deleted
    const { data: member } = await adminClient
      .from('members')
      .select('id, user_id, email')
      .eq('id', id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Delete member_chapters records first (foreign key constraint)
    await adminClient
      .from('member_chapters')
      .delete()
      .eq('member_id', id)

    // Deactivate team_members record if exists
    if (member.user_id) {
      await adminClient
        .from('team_members')
        .update({ active: false })
        .eq('user_id', member.user_id)
    }

    // Delete the member record
    const { error: deleteError } = await adminClient
      .from('members')
      .delete()
      .eq('id', id)

    if (deleteError) {
      throw deleteError
    }

    // Optionally delete the auth user if they exist
    if (member.user_id) {
      await adminClient.auth.admin.deleteUser(member.user_id)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting member:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
