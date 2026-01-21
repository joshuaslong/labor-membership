import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST - Create or update RSVP
export async function POST(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Please log in to RSVP' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get member record
    const { data: member } = await adminClient
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member record not found' }, { status: 404 })
    }

    // Check if event exists and is published
    const { data: event } = await adminClient
      .from('events')
      .select('id, status, max_attendees, rsvp_deadline')
      .eq('id', id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.status !== 'published') {
      return NextResponse.json({ error: 'Cannot RSVP to this event' }, { status: 400 })
    }

    // Check RSVP deadline
    if (event.rsvp_deadline) {
      const deadline = new Date(event.rsvp_deadline)
      if (new Date() > deadline) {
        return NextResponse.json({ error: 'RSVP deadline has passed' }, { status: 400 })
      }
    }

    const body = await request.json()
    const { status, guest_count, notes } = body

    if (!status || !['attending', 'maybe', 'declined'].includes(status)) {
      return NextResponse.json({ error: 'Invalid RSVP status' }, { status: 400 })
    }

    // Check max attendees if attending
    if (status === 'attending' && event.max_attendees) {
      const { data: currentCount } = await adminClient
        .rpc('get_event_rsvp_count', { event_uuid: id, rsvp_stat: 'attending' })

      // Get existing RSVP to see if user is already counted
      const { data: existingRsvp } = await adminClient
        .from('event_rsvps')
        .select('status, guest_count')
        .eq('event_id', id)
        .eq('member_id', member.id)
        .single()

      const newGuestCount = guest_count || 0
      let additionalPeople = 1 + newGuestCount

      // Subtract current user's count if already attending
      if (existingRsvp?.status === 'attending') {
        additionalPeople -= (1 + (existingRsvp.guest_count || 0))
      }

      if ((currentCount || 0) + additionalPeople > event.max_attendees) {
        return NextResponse.json({ error: 'Event is at capacity' }, { status: 400 })
      }
    }

    // Upsert the RSVP
    const { data: rsvp, error } = await adminClient
      .from('event_rsvps')
      .upsert({
        event_id: id,
        member_id: member.id,
        status,
        guest_count: guest_count || 0,
        notes
      }, {
        onConflict: 'event_id,member_id'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ rsvp })

  } catch (error) {
    console.error('Error saving RSVP:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Remove RSVP
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get member record
    const { data: member } = await adminClient
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member record not found' }, { status: 404 })
    }

    const { error } = await adminClient
      .from('event_rsvps')
      .delete()
      .eq('event_id', id)
      .eq('member_id', member.id)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting RSVP:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
