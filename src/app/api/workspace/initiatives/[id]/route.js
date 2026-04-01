import { NextResponse } from 'next/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'

export async function PUT(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(teamMember.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { title, slug, description, long_description, status, suggested_amounts, allow_custom_amount, min_amount, display_order } = body

  if (!title || !slug) {
    return NextResponse.json({ error: 'Title and slug are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('initiatives')
    .update({
      title,
      slug,
      description: description || null,
      long_description: long_description || null,
      status: status || 'draft',
      suggested_amounts: suggested_amounts || [10, 25, 50, 100],
      allow_custom_amount: allow_custom_amount !== false,
      min_amount: min_amount || 5,
      display_order: display_order || 0,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'An initiative with this slug already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ initiative: data })
}

export async function PATCH(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(teamMember.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()

  const allowedFields = ['status']
  const updates = {}
  for (const key of allowedFields) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('initiatives')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ initiative: data })
}

export async function DELETE(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(teamMember.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('initiatives')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
