import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - List all initiatives (admin view includes all statuses)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Verify admin access
    const { data: adminRecord } = await adminClient
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['super_admin', 'national_admin'])
      .single()

    if (!adminRecord) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get all initiatives
    const { data: initiatives, error } = await adminClient
      .from('initiatives')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ initiatives })

  } catch (error) {
    console.error('Error fetching initiatives:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create a new initiative
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Verify admin access
    const { data: adminRecord } = await adminClient
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['super_admin', 'national_admin'])
      .single()

    if (!adminRecord) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await request.json()
    const {
      slug,
      title,
      description,
      long_description,
      status,
      image_url,
      stripe_price_id,
      suggested_amounts,
      allow_custom_amount,
      min_amount,
      display_order,
    } = body

    if (!slug || !title) {
      return NextResponse.json({ error: 'Slug and title are required' }, { status: 400 })
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }, { status: 400 })
    }

    const { data: initiative, error } = await adminClient
      .from('initiatives')
      .insert({
        slug,
        title,
        description,
        long_description,
        status: status || 'draft',
        image_url,
        stripe_price_id,
        suggested_amounts: suggested_amounts || [10, 25, 50, 100],
        allow_custom_amount: allow_custom_amount !== false,
        min_amount: min_amount || 5,
        display_order: display_order || 0,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'An initiative with this slug already exists' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ initiative }, { status: 201 })

  } catch (error) {
    console.error('Error creating initiative:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
