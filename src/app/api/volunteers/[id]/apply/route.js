import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST - Apply to a volunteer opportunity
export async function POST(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'You must be logged in to apply' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get member record
    const { data: member } = await adminClient
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'You must be a member to apply' }, { status: 403 })
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

    // Check deadline
    if (opportunity.deadline) {
      const now = new Date()
      const deadline = new Date(opportunity.deadline + 'T23:59:59')
      if (now > deadline) {
        return NextResponse.json({ error: 'The application deadline has passed' }, { status: 400 })
      }
    }

    // Check capacity
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

    const body = await request.json()
    const { message, availability_notes } = body

    const { data: application, error } = await adminClient
      .from('volunteer_applications')
      .insert({
        opportunity_id: id,
        member_id: member.id,
        status: 'pending',
        message: message || null,
        availability_notes: availability_notes || null
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You have already applied to this opportunity' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ application }, { status: 201 })

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
