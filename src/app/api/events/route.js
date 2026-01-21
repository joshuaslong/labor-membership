import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - List events (filtered by chapter access)
export async function GET(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    const chapterId = searchParams.get('chapter_id')
    const status = searchParams.get('status') || 'published'
    const upcoming = searchParams.get('upcoming') === 'true'

    // Build query
    let query = adminClient
      .from('events')
      .select(`
        id,
        chapter_id,
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
        chapters (
          id,
          name,
          level
        )
      `)
      .order('start_date', { ascending: true })
      .order('start_time', { ascending: true })

    // Filter by chapter if provided
    if (chapterId) {
      query = query.eq('chapter_id', chapterId)
    }

    // Filter by status
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    // Filter to upcoming events only
    if (upcoming) {
      const today = new Date().toISOString().split('T')[0]
      query = query.gte('start_date', today)
    }

    const { data: events, error } = await query

    if (error) throw error

    // If user is logged in, get their RSVPs
    let userRsvps = {}
    if (user) {
      const { data: member } = await adminClient
        .from('members')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (member) {
        const eventIds = events.map(e => e.id)
        const { data: rsvps } = await adminClient
          .from('event_rsvps')
          .select('event_id, status, guest_count')
          .eq('member_id', member.id)
          .in('event_id', eventIds)

        userRsvps = (rsvps || []).reduce((acc, r) => {
          acc[r.event_id] = { status: r.status, guest_count: r.guest_count }
          return acc
        }, {})
      }
    }

    // Get RSVP counts for each event
    const eventsWithRsvps = await Promise.all(events.map(async (event) => {
      const { data: attending } = await adminClient
        .rpc('get_event_rsvp_count', { event_uuid: event.id, rsvp_stat: 'attending' })
      const { data: maybe } = await adminClient
        .rpc('get_event_rsvp_count', { event_uuid: event.id, rsvp_stat: 'maybe' })

      return {
        ...event,
        rsvp_counts: {
          attending: attending || 0,
          maybe: maybe || 0
        },
        user_rsvp: userRsvps[event.id] || null
      }
    }))

    return NextResponse.json({ events: eventsWithRsvps })

  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create a new event (admin only)
export async function POST(request) {
  try {
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

    const body = await request.json()
    const {
      chapter_id,
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

    if (!chapter_id || !title || !start_date) {
      return NextResponse.json({ error: 'Chapter, title, and start date are required' }, { status: 400 })
    }

    // Check if admin can create events for this chapter
    const isSuperAdmin = ['super_admin', 'national_admin'].includes(currentAdmin.role)

    if (!isSuperAdmin) {
      // Check if chapter is in admin's jurisdiction (their own chapter or descendants)
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })

      const allowedChapterIds = new Set(descendants?.map(d => d.id) || [])
      // Include the admin's own chapter
      allowedChapterIds.add(currentAdmin.chapter_id)

      if (!allowedChapterIds.has(chapter_id)) {
        return NextResponse.json({ error: 'Cannot create events for this chapter' }, { status: 403 })
      }
    }

    // Create the event
    const { data: event, error } = await adminClient
      .from('events')
      .insert({
        chapter_id,
        created_by: currentAdmin.id,
        title,
        description,
        location_name,
        location_address,
        location_city,
        location_state,
        location_zip,
        is_virtual: is_virtual || false,
        virtual_link,
        start_date,
        start_time,
        end_date,
        end_time,
        timezone: timezone || 'America/Chicago',
        status: status || 'draft',
        is_all_day: is_all_day || false,
        max_attendees,
        rsvp_deadline,
        image_url
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ event }, { status: 201 })

  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
