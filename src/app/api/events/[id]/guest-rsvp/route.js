import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendAutomatedEmail, formatEmailDate, formatEmailTime } from '@/lib/email-templates'

export async function POST(request, { params }) {
  try {
    const { id } = await params
    const { name, email, instance_date: bodyInstanceDate } = await request.json()

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Verify event exists and is published
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, start_date, status, location_name, rrule')
      .eq('id', id)
      .eq('status', 'published')
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Determine instance_date
    const instanceDate = bodyInstanceDate || event.start_date

    // Check if event instance is in the future
    const eventDate = new Date(instanceDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (eventDate < today) {
      return NextResponse.json(
        { error: 'Cannot RSVP to past events' },
        { status: 400 }
      )
    }

    // Check if this instance is cancelled (for recurring events)
    if (event.rrule && bodyInstanceDate) {
      const { data: override } = await supabase
        .from('event_instance_overrides')
        .select('is_cancelled')
        .eq('event_id', id)
        .eq('instance_date', instanceDate)
        .maybeSingle()

      if (override?.is_cancelled) {
        return NextResponse.json(
          { error: 'This event instance has been cancelled' },
          { status: 400 }
        )
      }
    }

    // Check if this email already has a guest RSVP for this instance
    const { data: existingRsvp } = await supabase
      .from('event_guest_rsvps')
      .select('id')
      .eq('event_id', id)
      .eq('email', email.toLowerCase())
      .eq('instance_date', instanceDate)
      .maybeSingle()

    if (existingRsvp) {
      return NextResponse.json(
        { error: 'You have already RSVP\'d to this event' },
        { status: 400 }
      )
    }

    // Create guest RSVP
    const { data: rsvp, error: insertError } = await supabase
      .from('event_guest_rsvps')
      .insert({
        event_id: id,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        instance_date: instanceDate,
        status: 'attending'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating guest RSVP:', insertError)
      return NextResponse.json(
        { error: 'Failed to create RSVP' },
        { status: 500 }
      )
    }

    // Send RSVP confirmation email to guest
    try {
      // Extract first name from full name
      const firstName = name.trim().split(' ')[0]
      await sendAutomatedEmail({
        templateKey: 'rsvp_confirmation',
        to: email.toLowerCase().trim(),
        variables: {
          name: firstName,
          event_name: event.title,
          event_date: formatEmailDate(instanceDate),
          event_time: formatEmailTime(instanceDate),
          event_location: event.location_name || 'TBD',
          rsvp_status: 'confirmed',
        },
        recipientType: 'guest',
        relatedId: id,
      })
    } catch (emailError) {
      console.error('Failed to send guest RSVP confirmation email:', emailError)
    }

    return NextResponse.json({ success: true, rsvp })
  } catch (error) {
    console.error('Guest RSVP error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
