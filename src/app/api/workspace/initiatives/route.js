import { NextResponse } from 'next/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/permissions'

export async function GET() {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(teamMember.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const { data: initiatives, error } = await supabase
    .from('initiatives')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ initiatives })
}

export async function POST(request) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(teamMember.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { title, slug, description, long_description, status, suggested_amounts, allow_custom_amount, min_amount, display_order } = body

  if (!title || !slug) {
    return NextResponse.json({ error: 'Title and slug are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('initiatives')
    .insert({
      title,
      slug,
      description: description || null,
      long_description: long_description || null,
      status: status || 'draft',
      suggested_amounts: suggested_amounts || [10, 25, 50, 100],
      allow_custom_amount: allow_custom_amount !== false,
      min_amount: min_amount || 5,
      display_order: display_order || 0,
      created_by: teamMember.user_id,
    })
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
