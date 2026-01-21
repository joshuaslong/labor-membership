import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Get a single event with details
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const adminClient = createAdminClient()

    // Get the event
    const { data: event, error } = await adminClient
      .from('events')
      .select(`
        id,
        chapter_id,
        created_by,
        title,
        description,
        location_name,
        location_address,
        location_city,
        location_state,
        location_zip,
        is_virtual,
        virtual_link,
        start_date,
        start_time,
        end_date,
        end_time,
        timezone,
        status,
        is_all_day,
        max_attendees,
        rsvp_deadline,
        image_url,
        created_at,
        updated_at,
        chapters (
          id,
          name,
          level
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Get RSVP counts
    const { data: attending } = await adminClient
      .rpc('get_event_rsvp_count', { event_uuid: id, rsvp_stat: 'attending' })
    const { data: maybe } = await adminClient
      .rpc('get_event_rsvp_count', { event_uuid: id, rsvp_stat: 'maybe' })
    const { data: declined } = await adminClient
      .rpc('get_event_rsvp_count', { event_uuid: id, rsvp_stat: 'declined' })

    // Get user's RSVP if logged in
    let userRsvp = null
    let isAdmin = false
    if (user) {
      const { data: member } = await adminClient
        .from('members')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (member) {
        const { data: rsvp } = await adminClient
          .from('event_rsvps')
          .select('id, status, guest_count, notes')
          .eq('event_id', id)
          .eq('member_id', member.id)
          .single()

        userRsvp = rsvp
      }

      // Check if user is admin
      const { data: admin } = await adminClient
        .from('admin_users')
        .select('id, role, chapter_id')
        .eq('user_id', user.id)
        .single()

      if (admin) {
        isAdmin = true
      }
    }

    return NextResponse.json({
      event: {
        ...event,
        rsvp_counts: {
          attending: attending || 0,
          maybe: maybe || 0,
          declined: declined || 0
        },
        user_rsvp: userRsvp
      },
      is_admin: isAdmin
    })

  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update an event (admin only)
export async function PUT(request, { params }) {
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
    const { data: existingEvent } = await adminClient
      .from('events')
      .select('chapter_id')
      .eq('id', id)
      .single()

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check if admin can update this event
    const isSuperAdmin = ['super_admin', 'national_admin'].includes(currentAdmin.role)

    if (!isSuperAdmin) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })

      const allowedChapterIds = new Set(descendants?.map(d => d.id) || [])
      // Include the admin's own chapter
      allowedChapterIds.add(currentAdmin.chapter_id)

      if (!allowedChapterIds.has(existingEvent.chapter_id)) {
        return NextResponse.json({ error: 'Cannot update this event' }, { status: 403 })
      }
    }

    const body = await request.json()
    const {
      title,
      description,
      location_name,
      location_address,
      location_city,
      location_state,
      location_zip,
      is_virtual,
      virtual_link,
      start_date,
      start_time,
      end_date,
      end_time,
      timezone,
      status,
      is_all_day,
      max_attendees,
      rsvp_deadline,
      image_url
    } = body

    // Build update object (only include provided fields)
    const updateData = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (location_name !== undefined) updateData.location_name = location_name
    if (location_address !== undefined) updateData.location_address = location_address
    if (location_city !== undefined) updateData.location_city = location_city
    if (location_state !== undefined) updateData.location_state = location_state
    if (location_zip !== undefined) updateData.location_zip = location_zip
    if (is_virtual !== undefined) updateData.is_virtual = is_virtual
    if (virtual_link !== undefined) updateData.virtual_link = virtual_link
    if (start_date !== undefined) updateData.start_date = start_date
    if (start_time !== undefined) updateData.start_time = start_time
    if (end_date !== undefined) updateData.end_date = end_date
    if (end_time !== undefined) updateData.end_time = end_time
    if (timezone !== undefined) updateData.timezone = timezone
    if (status !== undefined) updateData.status = status
    if (is_all_day !== undefined) updateData.is_all_day = is_all_day
    if (max_attendees !== undefined) updateData.max_attendees = max_attendees
    if (rsvp_deadline !== undefined) updateData.rsvp_deadline = rsvp_deadline
    if (image_url !== undefined) updateData.image_url = image_url

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    const { data: event, error } = await adminClient
      .from('events')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ event })

  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete an event (admin only)
export async function DELETE(request, { params }) {
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
    const { data: existingEvent } = await adminClient
      .from('events')
      .select('chapter_id')
      .eq('id', id)
      .single()

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check if admin can delete this event
    const isSuperAdmin = ['super_admin', 'national_admin'].includes(currentAdmin.role)

    if (!isSuperAdmin) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })

      const allowedChapterIds = new Set(descendants?.map(d => d.id) || [])
      // Include the admin's own chapter
      allowedChapterIds.add(currentAdmin.chapter_id)

      if (!allowedChapterIds.has(existingEvent.chapter_id)) {
        return NextResponse.json({ error: 'Cannot delete this event' }, { status: 403 })
      }
    }

    const { error } = await adminClient
      .from('events')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
