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
    const { data: currentAdmin } = await adminClient
      .from('admin_users')
      .select('id, role')
      .eq('user_id', user.id)
      .single()

    if (!currentAdmin || currentAdmin.role !== 'super_admin') {
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

    // Check if member is an admin and remove admin record
    if (member.user_id) {
      await adminClient
        .from('admin_users')
        .delete()
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
