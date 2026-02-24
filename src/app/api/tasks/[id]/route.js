import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Get a single task
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .select(`
        *,
        owner:team_members!tasks_owner_fkey(id, member:members(first_name, last_name)),
        creator:team_members!tasks_created_by_fkey(id, member:members(first_name, last_name)),
        assignee:members!tasks_assignee_member_id_fkey(id, first_name, last_name, email)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update a task
export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      project,
      phase,
      owner,
      assignee_member_id,
      deliverable,
      time_estimate_min,
      deadline,
      priority,
      status,
      skill_type,
      notes,
    } = body

    const updates = {}
    if (name !== undefined) updates.name = name
    if (project !== undefined) updates.project = project
    if (phase !== undefined) updates.phase = phase || null
    if (owner !== undefined) {
      updates.owner = owner || null
      // Clear volunteer assignee when setting team member owner
      if (owner) updates.assignee_member_id = null
    }
    if (assignee_member_id !== undefined) {
      updates.assignee_member_id = assignee_member_id || null
      // Clear team member owner when setting volunteer assignee
      if (assignee_member_id) updates.owner = null
    }
    if (deliverable !== undefined) updates.deliverable = deliverable
    if (time_estimate_min !== undefined) updates.time_estimate_min = parseInt(time_estimate_min)
    if (deadline !== undefined) updates.deadline = deadline
    if (priority !== undefined) updates.priority = priority
    if (status !== undefined) updates.status = status
    if (skill_type !== undefined) updates.skill_type = skill_type || null
    if (notes !== undefined) updates.notes = notes || null

    const { data: task, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete a task (admin only via RLS)
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
