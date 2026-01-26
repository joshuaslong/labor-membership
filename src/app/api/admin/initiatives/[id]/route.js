import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Get a single initiative
export async function GET(request, { params }) {
  try {
    const { id } = await params

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

    const { data: initiative, error } = await adminClient
      .from('initiatives')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    if (!initiative) {
      return NextResponse.json({ error: 'Initiative not found' }, { status: 404 })
    }

    return NextResponse.json({ initiative })

  } catch (error) {
    console.error('Error fetching initiative:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update an initiative
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

    // Validate slug format if provided
    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }, { status: 400 })
    }

    // Build update object
    const updateData = {}
    if (slug !== undefined) updateData.slug = slug
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (long_description !== undefined) updateData.long_description = long_description
    if (status !== undefined) updateData.status = status
    if (image_url !== undefined) updateData.image_url = image_url
    if (stripe_price_id !== undefined) updateData.stripe_price_id = stripe_price_id
    if (suggested_amounts !== undefined) updateData.suggested_amounts = suggested_amounts
    if (allow_custom_amount !== undefined) updateData.allow_custom_amount = allow_custom_amount
    if (min_amount !== undefined) updateData.min_amount = min_amount
    if (display_order !== undefined) updateData.display_order = display_order

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    const { data: initiative, error } = await adminClient
      .from('initiatives')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'An initiative with this slug already exists' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ initiative })

  } catch (error) {
    console.error('Error updating initiative:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete an initiative
export async function DELETE(request, { params }) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Verify super admin access (only super admins can delete)
    const { data: adminRecord } = await adminClient
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .single()

    if (!adminRecord) {
      return NextResponse.json({ error: 'Only super admins can delete initiatives' }, { status: 403 })
    }

    const { error } = await adminClient
      .from('initiatives')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting initiative:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
