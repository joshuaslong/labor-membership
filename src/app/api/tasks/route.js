import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendNewTaskNotification } from '@/lib/task-notifications'

// POST - Create a new task
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get team member
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teamMember) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 })
    }

    const body = await request.json()
    const {
      project,
      phase,
      name,
      owner,
      deliverable,
      time_estimate_min,
      deadline,
      priority,
      status,
      skill_type,
      notes,
    } = body

    if (!project || !name || !deliverable || !time_estimate_min || !deadline || !priority) {
      return NextResponse.json({ error: 'Project, name, deliverable, time estimate, deadline, and priority are required' }, { status: 400 })
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        project,
        phase: phase || null,
        name,
        owner: owner || null,
        deliverable,
        time_estimate_min: parseInt(time_estimate_min),
        deadline,
        priority,
        status: status || 'NOT_STARTED',
        skill_type: skill_type || null,
        notes: notes || null,
        created_by: teamMember.id,
      })
      .select()
      .single()

    if (error) throw error

    // Send notification to assigned owner
    if (task.owner) {
      sendNewTaskNotification(task).catch(err => {
        console.error('Error sending new task notification:', err)
      })
    }

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
