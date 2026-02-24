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
    const { data: teamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    if (!teamMember || !teamMember.roles?.length) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
    const currentAdmin = { ...teamMember }
    let bestIdx = Infinity
    for (const r of teamMember.roles) {
      const idx = roleHierarchy.indexOf(r)
      if (idx !== -1 && idx < bestIdx) {
        bestIdx = idx
        currentAdmin.role = r
      }
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
    const isSuperAdmin = teamMember.roles.some(r => ['super_admin', 'national_admin'].includes(r))

    if (!isSuperAdmin) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })

      const descendantIds = new Set(descendants?.map(d => d.id) || [])
      if (!descendantIds.has(event.chapter_id)) {
        return NextResponse.json({ error: 'Cannot view RSVPs for this event' }, { status: 403 })
      }
    }

    // Get member RSVPs
    const { data: memberRsvps, error } = await adminClient
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

    // Get guest RSVPs
    const { data: guestRsvps, error: guestError } = await adminClient
      .from('event_guest_rsvps')
      .select('id, name, email, status, created_at, instance_date')
      .eq('event_id', id)
      .order('created_at', { ascending: false })

    if (guestError) throw guestError

    // Normalize guest RSVPs to match member RSVP shape
    const normalizedGuests = (guestRsvps || []).map(g => ({
      id: g.id,
      status: g.status,
      guest_count: 0,
      notes: null,
      created_at: g.created_at,
      updated_at: null,
      is_guest: true,
      members: {
        id: null,
        first_name: g.name.split(' ')[0] || g.name,
        last_name: g.name.split(' ').slice(1).join(' ') || '',
        email: g.email,
        phone: null
      }
    }))

    // Combine both lists
    const rsvps = [...(memberRsvps || []), ...normalizedGuests]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    // Group by status
    const grouped = {
      attending: rsvps.filter(r => r.status === 'attending'),
      maybe: rsvps.filter(r => r.status === 'maybe'),
      declined: rsvps.filter(r => r.status === 'declined')
    }

    // Calculate totals (including +guests from member RSVPs)
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
