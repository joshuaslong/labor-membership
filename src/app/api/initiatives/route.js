import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - List active initiatives (public)
export async function GET() {
  try {
    const adminClient = createAdminClient()

    const { data: initiatives, error } = await adminClient
      .from('initiatives')
      .select('id, slug, title, description, status, image_url, suggested_amounts, allow_custom_amount, min_amount')
      .eq('status', 'active')
      .order('display_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({ initiatives: initiatives || [] })

  } catch (error) {
    console.error('Error fetching initiatives:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
