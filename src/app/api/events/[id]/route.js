import { after } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendNewEventNotifications } from '@/lib/event-notifications'
import { buildRruleString, computeRecurrenceEndDate, describeRrule, getOccurrences, getNextOccurrence } from '@/lib/recurrence'

// GET - Get a single event with details
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)
    const instanceDate = searchParams.get('instance_date')

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
        rrule,
        recurrence_end_date,
        target_type,
        group_id,
        visibility,
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

    const isRecurring = !!event.rrule
    const effectiveInstanceDate = instanceDate || event.start_date

    // For recurring events with a specific instance_date, fetch and merge override
    let instanceData = { ...event }
    if (isRecurring && instanceDate) {
      const { data: override } = await adminClient
        .from('event_instance_overrides')
        .select('*')
        .eq('event_id', id)
        .eq('instance_date', instanceDate)
        .maybeSingle()

      if (override?.is_cancelled) {
        return NextResponse.json({ error: 'This event instance has been cancelled' }, { status: 404 })
      }

      if (override) {
        instanceData = {
          ...event,
          title: override.title ?? event.title,
          description: override.description ?? event.description,
          location_name: override.location_name ?? event.location_name,
          location_address: override.location_address ?? event.location_address,
          location_city: override.location_city ?? event.location_city,
          location_state: override.location_state ?? event.location_state,
          location_zip: override.location_zip ?? event.location_zip,
          is_virtual: override.is_virtual ?? event.is_virtual,
          virtual_link: override.virtual_link ?? event.virtual_link,
          start_time: override.start_time ?? event.start_time,
          end_time: override.end_time ?? event.end_time,
          max_attendees: override.max_attendees ?? event.max_attendees,
          rsvp_deadline: override.rsvp_deadline ?? event.rsvp_deadline,
        }
      }
    }

    // Get RSVP counts (per-instance for recurring events)
    const rpcParams = { event_uuid: id, rsvp_stat: 'attending' }
    const rpcParamsMaybe = { event_uuid: id, rsvp_stat: 'maybe' }
    const rpcParamsDeclined = { event_uuid: id, rsvp_stat: 'declined' }

    if (isRecurring) {
      rpcParams.for_instance_date = effectiveInstanceDate
      rpcParamsMaybe.for_instance_date = effectiveInstanceDate
      rpcParamsDeclined.for_instance_date = effectiveInstanceDate
    }

    const [attendingRes, maybeRes, declinedRes] = await Promise.all([
      adminClient.rpc('get_event_rsvp_count', rpcParams),
      adminClient.rpc('get_event_rsvp_count', rpcParamsMaybe),
      adminClient.rpc('get_event_rsvp_count', rpcParamsDeclined),
    ])

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
        let rsvpQuery = adminClient
          .from('event_rsvps')
          .select('id, status, guest_count, notes, instance_date')
          .eq('event_id', id)
          .eq('member_id', member.id)
          .eq('instance_date', effectiveInstanceDate)
          .maybeSingle()

        const { data: rsvp } = await rsvpQuery
        userRsvp = rsvp
      }

      // Check if user is admin
      const { data: teamMember } = await adminClient
        .from('team_members')
        .select('id, roles, chapter_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .single()

      if (teamMember && teamMember.roles?.length > 0) {
        isAdmin = true
      }
    }

    // Build response
    const response = {
      ...instanceData,
      instance_date: effectiveInstanceDate,
      is_recurring: isRecurring,
      rsvp_counts: {
        attending: attendingRes.data || 0,
        maybe: maybeRes.data || 0,
        declined: declinedRes.data || 0,
      },
      user_rsvp: userRsvp,
    }

    // Add recurrence metadata for recurring events
    if (isRecurring) {
      response.recurrence_description = describeRrule(event.rrule, event.start_date)

      // Get next 5 upcoming instances from today
      const today = new Date().toISOString().split('T')[0]
      const futureEnd = new Date()
      futureEnd.setDate(futureEnd.getDate() + 365)
      const upcomingDates = getOccurrences(
        event.rrule, event.start_date, today, futureEnd.toISOString().split('T')[0]
      ).slice(0, 5)

      response.upcoming_instances = upcomingDates
    }

    return NextResponse.json({
      event: response,
      is_admin: isAdmin,
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

    // Get the existing event
    const { data: existingEvent } = await adminClient
      .from('events')
      .select('*')
      .eq('id', id)
      .single()

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const previousStatus = existingEvent.status

    // Check if admin can update this event
    const isSuperAdmin = teamMember.roles.some(r => ['super_admin', 'national_admin'].includes(r))

    if (!isSuperAdmin) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })

      const allowedChapterIds = new Set(descendants?.map(d => d.id) || [])
      allowedChapterIds.add(teamMember.chapter_id)

      if (!allowedChapterIds.has(existingEvent.chapter_id)) {
        return NextResponse.json({ error: 'Cannot update this event' }, { status: 403 })
      }
    }

    const body = await request.json()
    const {
      edit_scope,
      instance_date,
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
      target_type,
      group_id,
      visibility,
      send_notification,
    } = body

    const isRecurring = !!existingEvent.rrule
    const scope = edit_scope || 'all'

    // === SCOPE: "this" — edit a single instance via override ===
    if (scope === 'this' && isRecurring && instance_date) {
      const overrideData = {}
      if (title !== undefined) overrideData.title = title
      if (description !== undefined) overrideData.description = description
      if (location_name !== undefined) overrideData.location_name = location_name
      if (location_address !== undefined) overrideData.location_address = location_address
      if (location_city !== undefined) overrideData.location_city = location_city
      if (location_state !== undefined) overrideData.location_state = location_state
      if (location_zip !== undefined) overrideData.location_zip = location_zip
      if (is_virtual !== undefined) overrideData.is_virtual = is_virtual
      if (virtual_link !== undefined) overrideData.virtual_link = virtual_link
      if (start_time !== undefined) overrideData.start_time = start_time
      if (end_time !== undefined) overrideData.end_time = end_time
      if (max_attendees !== undefined) overrideData.max_attendees = max_attendees
      if (rsvp_deadline !== undefined) overrideData.rsvp_deadline = rsvp_deadline

      if (Object.keys(overrideData).length === 0) {
        return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
      }

      const { data: override, error: overrideError } = await adminClient
        .from('event_instance_overrides')
        .upsert({
          event_id: id,
          instance_date,
          ...overrideData,
        }, {
          onConflict: 'event_id,instance_date',
        })
        .select()
        .single()

      if (overrideError) throw overrideError

      return NextResponse.json({ event: { ...existingEvent, ...overrideData, instance_date }, override })
    }

    // === SCOPE: "this_and_following" — split the series ===
    if (scope === 'this_and_following' && isRecurring && instance_date) {
      // Truncate the original series: set UNTIL to the day before instance_date
      const splitDate = new Date(instance_date + 'T12:00:00Z')
      splitDate.setUTCDate(splitDate.getUTCDate() - 1)
      const untilDate = splitDate.toISOString().split('T')[0].replace(/-/g, '')

      // Modify original RRULE to add/replace UNTIL
      let truncatedRrule = existingEvent.rrule
        .replace(/;?(UNTIL|COUNT)=[^;]*/g, '') // remove existing end
      truncatedRrule += `;UNTIL=${untilDate}T235959Z`

      await adminClient
        .from('events')
        .update({
          rrule: truncatedRrule,
          recurrence_end_date: splitDate.toISOString().split('T')[0],
        })
        .eq('id', id)

      // Remove overrides on or after instance_date from the original series
      await adminClient
        .from('event_instance_overrides')
        .delete()
        .eq('event_id', id)
        .gte('instance_date', instance_date)

      // Build new event data starting from instance_date
      const newEventData = {
        chapter_id: existingEvent.chapter_id,
        created_by: existingEvent.created_by,
        title: title ?? existingEvent.title,
        description: description ?? existingEvent.description,
        location_name: location_name ?? existingEvent.location_name,
        location_address: location_address ?? existingEvent.location_address,
        location_city: location_city ?? existingEvent.location_city,
        location_state: location_state ?? existingEvent.location_state,
        location_zip: location_zip ?? existingEvent.location_zip,
        is_virtual: is_virtual ?? existingEvent.is_virtual,
        virtual_link: virtual_link ?? existingEvent.virtual_link,
        start_date: instance_date,
        start_time: start_time ?? existingEvent.start_time,
        end_date: end_date ?? existingEvent.end_date,
        end_time: end_time ?? existingEvent.end_time,
        timezone: timezone ?? existingEvent.timezone,
        status: status ?? existingEvent.status,
        is_all_day: is_all_day ?? existingEvent.is_all_day,
        max_attendees: max_attendees ?? existingEvent.max_attendees,
        rsvp_deadline: rsvp_deadline ?? existingEvent.rsvp_deadline,
        image_url: image_url ?? existingEvent.image_url,
        target_type: target_type ?? existingEvent.target_type,
        group_id: target_type === 'group' ? (group_id ?? existingEvent.group_id) : (target_type === 'chapter' ? null : existingEvent.group_id),
        visibility: visibility ?? existingEvent.visibility,
      }

      // Rebuild RRULE for the new series (same pattern unless changed)
      let newRrule = existingEvent.rrule
      if (recurrence_preset && recurrence_preset !== 'none') {
        newRrule = buildRruleString(recurrence_preset, instance_date, recurrence_options || {})
      } else {
        // Keep same RRULE pattern but remove old UNTIL/COUNT
        newRrule = existingEvent.rrule.replace(/;?(UNTIL|COUNT)=[^;]*/g, '')
        // Re-add end condition if provided
        if (recurrence_options?.endType === 'date' && recurrence_options?.endDate) {
          newRrule += `;UNTIL=${recurrence_options.endDate.replace(/-/g, '')}T235959Z`
        } else if (recurrence_options?.endType === 'count' && recurrence_options?.count) {
          newRrule += `;COUNT=${recurrence_options.count}`
        }
      }

      newEventData.rrule = newRrule
      newEventData.recurrence_end_date = computeRecurrenceEndDate(newRrule, instance_date)

      const { data: newEvent, error: newError } = await adminClient
        .from('events')
        .insert(newEventData)
        .select()
        .single()

      if (newError) throw newError

      return NextResponse.json({ event: newEvent, split: true, original_id: id })
    }

    // === SCOPE: "all" — update the parent event directly ===
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
    if (target_type !== undefined) {
      updateData.target_type = target_type
      updateData.group_id = target_type === 'group' ? group_id : null
    }
    if (visibility !== undefined) updateData.visibility = visibility

    // Handle recurrence changes for "all" scope
    if (recurrence_preset !== undefined) {
      if (recurrence_preset === 'none' || !recurrence_preset) {
        // Remove recurrence
        updateData.rrule = null
        updateData.recurrence_end_date = null
      } else {
        const effectiveStartDate = start_date || existingEvent.start_date
        updateData.rrule = buildRruleString(recurrence_preset, effectiveStartDate, recurrence_options || {})
        updateData.recurrence_end_date = computeRecurrenceEndDate(updateData.rrule, effectiveStartDate)
      }

      // Clear overrides when RRULE changes for the whole series
      if (isRecurring) {
        await adminClient
          .from('event_instance_overrides')
          .delete()
          .eq('event_id', id)
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    const { data: event, error: updateError } = await adminClient
      .from('events')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    // Send notifications if event was just published
    if (event.status === 'published' && previousStatus !== 'published' && send_notification !== false) {
      after(async () => {
        try {
          await sendNewEventNotifications(event)
        } catch (err) {
          console.error('Error sending new event notifications:', err)
        }
      })
    }

    return NextResponse.json({ event })

  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete an event or cancel an instance (admin only)
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
    const { data: deleteTeamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    if (!deleteTeamMember || !deleteTeamMember.roles?.length) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    const deleteRoleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
    const currentAdmin = { ...deleteTeamMember }
    let deleteBestIdx = Infinity
    for (const r of deleteTeamMember.roles) {
      const idx = deleteRoleHierarchy.indexOf(r)
      if (idx !== -1 && idx < deleteBestIdx) {
        deleteBestIdx = idx
        currentAdmin.role = r
      }
    }

    // Get the event to check chapter access
    const { data: existingEvent } = await adminClient
      .from('events')
      .select('chapter_id, rrule')
      .eq('id', id)
      .single()

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check if admin can delete this event
    const isSuperAdmin = deleteTeamMember.roles.some(r => ['super_admin', 'national_admin'].includes(r))

    if (!isSuperAdmin) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: deleteTeamMember.chapter_id })

      const allowedChapterIds = new Set(descendants?.map(d => d.id) || [])
      allowedChapterIds.add(deleteTeamMember.chapter_id)

      if (!allowedChapterIds.has(existingEvent.chapter_id)) {
        return NextResponse.json({ error: 'Cannot delete this event' }, { status: 403 })
      }
    }

    // Check for delete_scope from query params or body
    const { searchParams } = new URL(request.url)
    const deleteScope = searchParams.get('delete_scope') || 'all'
    const instanceDate = searchParams.get('instance_date')

    // Cancel a single instance of a recurring event
    if (deleteScope === 'this' && existingEvent.rrule && instanceDate) {
      const { error: overrideError } = await adminClient
        .from('event_instance_overrides')
        .upsert({
          event_id: id,
          instance_date: instanceDate,
          is_cancelled: true,
        }, {
          onConflict: 'event_id,instance_date',
        })

      if (overrideError) throw overrideError

      return NextResponse.json({ success: true, cancelled_instance: instanceDate })
    }

    // Delete entire event (CASCADE handles overrides and RSVPs)
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
