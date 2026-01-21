import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Get all RSVPs for an event (admin only)
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Verify admin access
    const { data: currentAdmin } = await adminClient
      .from('admin_users')
      .select('id, role, chapter_id')
      .eq('user_id', user.id)
      .single()

    if (!currentAdmin) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    // Get the event to check chapter access
    const { data: event } = await adminClient
      .from('events')
      .select('chapter_id')
      .eq('id', id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check if admin can view RSVPs for this event
    const isSuperAdmin = ['super_admin', 'national_admin'].includes(currentAdmin.role)

    if (!isSuperAdmin) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })

      const descendantIds = new Set(descendants?.map(d => d.id) || [])
      if (!descendantIds.has(event.chapter_id)) {
        return NextResponse.json({ error: 'Cannot view RSVPs for this event' }, { status: 403 })
      }
    }

    // Get RSVPs with member info
    const { data: rsvps, error } = await adminClient
      .from('event_rsvps')
      .select(`
        id,
        status,
        guest_count,
        notes,
        created_at,
        updated_at,
        members (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq('event_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Group by status
    const grouped = {
      attending: rsvps.filter(r => r.status === 'attending'),
      maybe: rsvps.filter(r => r.status === 'maybe'),
      declined: rsvps.filter(r => r.status === 'declined')
    }

    // Calculate totals (including guests)
    const totals = {
      attending: grouped.attending.reduce((sum, r) => sum + 1 + (r.guest_count || 0), 0),
      maybe: grouped.maybe.reduce((sum, r) => sum + 1 + (r.guest_count || 0), 0),
      declined: grouped.declined.length
    }

    return NextResponse.json({
      rsvps,
      grouped,
      totals
    })

  } catch (error) {
    console.error('Error fetching RSVPs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
