import { after } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendNewEventNotifications } from '@/lib/event-notifications'
import { buildRruleString, computeRecurrenceEndDate, expandEventInstances } from '@/lib/recurrence'

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

    const expand = searchParams.get('expand') !== 'false' // default: expand recurring
    const rangeStart = searchParams.get('range_start')
    const rangeEnd = searchParams.get('range_end')

    const selectFields = `
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
      rrule,
      recurrence_end_date,
      created_at,
      chapters (
        id,
        name,
        level
      )
    `

    // Compute date range for instance expansion
    const today = new Date().toISOString().split('T')[0]
    const effectiveRangeStart = rangeStart || today
    const defaultEnd = new Date()
    defaultEnd.setDate(defaultEnd.getDate() + 90)
    const effectiveRangeEnd = rangeEnd || defaultEnd.toISOString().split('T')[0]

    // Query non-recurring events
    let nonRecurringQuery = adminClient
      .from('events')
      .select(selectFields)
      .is('rrule', null)
      .order('start_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (chapterId) nonRecurringQuery = nonRecurringQuery.eq('chapter_id', chapterId)
    if (status !== 'all') nonRecurringQuery = nonRecurringQuery.eq('status', status)
    if (upcoming) nonRecurringQuery = nonRecurringQuery.gte('start_date', effectiveRangeStart)

    // Query recurring events (those whose range overlaps our window)
    let recurringQuery = adminClient
      .from('events')
      .select(selectFields)
      .not('rrule', 'is', null)
      .lte('start_date', effectiveRangeEnd)

    if (chapterId) recurringQuery = recurringQuery.eq('chapter_id', chapterId)
    if (status !== 'all') recurringQuery = recurringQuery.eq('status', status)
    if (upcoming) {
      recurringQuery = recurringQuery.or(`recurrence_end_date.gte.${effectiveRangeStart},recurrence_end_date.is.null`)
    }

    const [nonRecurringResult, recurringResult] = await Promise.all([
      nonRecurringQuery,
      recurringQuery,
    ])

    if (nonRecurringResult.error) throw nonRecurringResult.error
    if (recurringResult.error) throw recurringResult.error

    const nonRecurringEvents = nonRecurringResult.data || []
    const recurringEvents = recurringResult.data || []

    // Fetch overrides for recurring events in the date range
    let overrideMap = {}
    if (recurringEvents.length > 0 && expand) {
      const recurringIds = recurringEvents.map(e => e.id)
      const { data: overrides } = await adminClient
        .from('event_instance_overrides')
        .select('*')
        .in('event_id', recurringIds)
        .gte('instance_date', effectiveRangeStart)
        .lte('instance_date', effectiveRangeEnd)

      for (const o of (overrides || [])) {
        if (!overrideMap[o.event_id]) overrideMap[o.event_id] = []
        overrideMap[o.event_id].push(o)
      }
    }

    // Expand recurring events into instances
    let allInstances = []

    // Add non-recurring events as single instances
    for (const event of nonRecurringEvents) {
      allInstances.push({
        ...event,
        instance_date: event.start_date,
        is_recurring: false,
      })
    }

    // Expand recurring events
    if (expand) {
      for (const event of recurringEvents) {
        const overrides = overrideMap[event.id] || []
        const instances = expandEventInstances(event, overrides, effectiveRangeStart, effectiveRangeEnd)
        allInstances.push(...instances)
      }
    } else {
      // Don't expand — return parent events as-is (for workspace admin view)
      for (const event of recurringEvents) {
        allInstances.push({
          ...event,
          instance_date: event.start_date,
          is_recurring: true,
        })
      }
    }

    // Sort by instance_date then start_time
    allInstances.sort((a, b) => {
      const dateCompare = (a.instance_date || '').localeCompare(b.instance_date || '')
      if (dateCompare !== 0) return dateCompare
      return (a.start_time || '').localeCompare(b.start_time || '')
    })

    // If user is logged in, get their RSVPs
    let userRsvps = {}
    if (user) {
      const { data: member } = await adminClient
        .from('members')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (member) {
        const eventIds = [...new Set(allInstances.map(e => e.id))]
        const { data: rsvps } = await adminClient
          .from('event_rsvps')
          .select('event_id, instance_date, status, guest_count')
          .eq('member_id', member.id)
          .in('event_id', eventIds)

        for (const r of (rsvps || [])) {
          const key = `${r.event_id}:${r.instance_date}`
          userRsvps[key] = { status: r.status, guest_count: r.guest_count }
        }
      }
    }

    // Get RSVP counts — batch query instead of N+1
    const eventIds = [...new Set(allInstances.map(e => e.id))]
    const { data: rsvpRows } = await adminClient
      .from('event_rsvps')
      .select('event_id, instance_date, status, guest_count')
      .in('event_id', eventIds)
      .in('status', ['attending', 'maybe'])

    // Build count map keyed by event_id:instance_date
    const rsvpCountMap = {}
    for (const r of (rsvpRows || [])) {
      const key = `${r.event_id}:${r.instance_date}`
      if (!rsvpCountMap[key]) rsvpCountMap[key] = { attending: 0, maybe: 0 }
      const people = 1 + (r.guest_count || 0)
      if (r.status === 'attending') rsvpCountMap[key].attending += people
      else if (r.status === 'maybe') rsvpCountMap[key].maybe += people
    }

    const eventsWithRsvps = allInstances.map(instance => {
      const key = `${instance.id}:${instance.instance_date}`
      return {
        ...instance,
        rsvp_counts: rsvpCountMap[key] || { attending: 0, maybe: 0 },
        user_rsvp: userRsvps[key] || null,
      }
    })

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
      image_url,
      recurrence_preset,
      recurrence_options,
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

    // Build RRULE if recurrence is specified
    let rrule = null
    let recurrence_end_date = null

    if (recurrence_preset && recurrence_preset !== 'none') {
      rrule = buildRruleString(recurrence_preset, start_date, recurrence_options || {})
      recurrence_end_date = computeRecurrenceEndDate(rrule, start_date)
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
        image_url,
        rrule,
        recurrence_end_date,
      })
      .select()
      .single()

    if (error) throw error

    // Send notifications if event is published
    if (event.status === 'published') {
      after(async () => {
        try {
          await sendNewEventNotifications(event)
        } catch (err) {
          console.error('Error sending new event notifications:', err)
        }
      })
    }

    return NextResponse.json({ event }, { status: 201 })

  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
