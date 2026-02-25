import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST - Apply to a volunteer opportunity (supports both logged-in and guest users)
export async function POST(request, { params }) {
  try {
    const { id } = await params
    const adminClient = createAdminClient()
    const body = await request.json()

    // Determine member: logged-in user or guest
    let memberId
    let guestEmail = null

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // Logged-in user — look up their member record
      const { data: member } = await adminClient
        .from('members')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!member) {
        return NextResponse.json({ error: 'Member record not found' }, { status: 403 })
      }
      memberId = member.id
    } else {
      // Guest application — require name + email
      const { first_name, last_name, email } = body
      if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
        return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
      }

      const trimmedEmail = email.trim().toLowerCase()
      guestEmail = trimmedEmail

      // Check if a member with this email already exists
      const { data: existing } = await adminClient
        .from('members')
        .select('id')
        .eq('email', trimmedEmail)
        .single()

      if (existing) {
        memberId = existing.id
      } else {
        // Create a new guest member record
        const { data: newMember, error: memberError } = await adminClient
          .from('members')
          .insert({
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            email: trimmedEmail,
            status: 'pending'
          })
          .select('id')
          .single()

        if (memberError) throw memberError
        memberId = newMember.id
      }
    }

    // Get opportunity and validate
    const { data: opportunity } = await adminClient
      .from('volunteer_opportunities')
      .select('id, status, deadline, spots_available')
      .eq('id', id)
      .single()

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    if (opportunity.status !== 'published') {
      return NextResponse.json({ error: 'This opportunity is not accepting applications' }, { status: 400 })
    }

    if (opportunity.deadline) {
      const now = new Date()
      const deadline = new Date(opportunity.deadline + 'T23:59:59')
      if (now > deadline) {
        return NextResponse.json({ error: 'The application deadline has passed' }, { status: 400 })
      }
    }

    if (opportunity.spots_available != null) {
      const { count } = await adminClient
        .from('volunteer_applications')
        .select('id', { count: 'exact', head: true })
        .eq('opportunity_id', id)
        .eq('status', 'approved')

      if (count >= opportunity.spots_available) {
        return NextResponse.json({ error: 'This opportunity is fully staffed' }, { status: 400 })
      }
    }

    const { message } = body

    const { data: application, error } = await adminClient
      .from('volunteer_applications')
      .insert({
        opportunity_id: id,
        member_id: memberId,
        status: 'pending',
        message: message || null
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You have already applied to this opportunity' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ application, guest_email: guestEmail }, { status: 201 })

  } catch (error) {
    console.error('Error applying to volunteer opportunity:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Withdraw application
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { data: member } = await adminClient
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const { data: application } = await adminClient
      .from('volunteer_applications')
      .select('id, status')
      .eq('opportunity_id', id)
      .eq('member_id', member.id)
      .single()

    if (!application) {
      return NextResponse.json({ error: 'No application found' }, { status: 404 })
    }

    if (application.status === 'withdrawn') {
      return NextResponse.json({ error: 'Application already withdrawn' }, { status: 400 })
    }

    const { error } = await adminClient
      .from('volunteer_applications')
      .update({ status: 'withdrawn' })
      .eq('id', application.id)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error withdrawing volunteer application:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
