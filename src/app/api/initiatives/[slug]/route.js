import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Get a single initiative by slug
export async function GET(request, { params }) {
  try {
    const { slug } = await params
    const adminClient = createAdminClient()

    const { data: initiative, error } = await adminClient
      .from('initiatives')
      .select('id, slug, title, description, long_description, status, image_url, suggested_amounts, allow_custom_amount, min_amount')
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (error || !initiative) {
      return NextResponse.json({ error: 'Initiative not found' }, { status: 404 })
    }

    return NextResponse.json({ initiative })

  } catch (error) {
    console.error('Error fetching initiative:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
