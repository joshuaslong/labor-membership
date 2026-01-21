import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// US State name to code mapping
const STATE_MAP = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC', 'puerto rico': 'PR',
  // Common abbreviations/variations
  'wash': 'WA', 'wash.': 'WA', 'calif': 'CA', 'calif.': 'CA',
  'fla': 'FL', 'fla.': 'FL', 'tex': 'TX', 'tex.': 'TX',
  'penn': 'PA', 'penn.': 'PA', 'penna': 'PA', 'penna.': 'PA',
}

// Valid state codes
const VALID_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR'
])

// Normalize state to 2-letter code
function normalizeState(state) {
  if (!state) return null

  const cleaned = state.trim()

  // Already a valid 2-letter code
  const upper = cleaned.toUpperCase()
  if (upper.length === 2 && VALID_STATE_CODES.has(upper)) {
    return upper
  }

  // Look up full name or variation
  const lower = cleaned.toLowerCase()
  if (STATE_MAP[lower]) {
    return STATE_MAP[lower]
  }

  // Try without periods
  const noPeriods = lower.replace(/\./g, '')
  if (STATE_MAP[noPeriods]) {
    return STATE_MAP[noPeriods]
  }

  // Could not normalize
  return null
}

// Normalize phone number to (XXX) XXX-XXXX format
function normalizePhone(phone) {
  if (!phone) return null

  // Extract only digits
  const digits = phone.replace(/\D/g, '')

  // Handle different lengths
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // 11 digits starting with 1 (US country code)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }

  // 7 digits (no area code) - return as-is with formatting
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }

  // Can't normalize - return cleaned version or null if too short
  if (digits.length < 7) return null

  return phone.trim()
}

// Parse CSV string to array of objects
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  // Parse header - handle tab or comma delimited
  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'))

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter)
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || null
    })
    rows.push(row)
  }
  return rows
}

// Map Memberstack fields to our schema with normalization
function mapMemberstackToMember(row) {
  const stateCode = normalizeState(row.state)

  return {
    email: row.email?.toLowerCase().trim(),
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    phone: normalizePhone(row.phone_number || row.phone),
    state: stateCode,
    zip_code: row.zip_code || row.zipcode || null,
    bio: row.member_bio || null,
    wants_to_volunteer: row.volunteering === 'true' || row.volunteering === 'TRUE' || row.volunteering === '1',
    volunteer_details: row.volunteering_details || null,
    // Default mailing list to TRUE (as requested)
    mailing_list_opted_in: true,
    joined_date: row.createdat ? new Date(row.createdat).toISOString() : new Date().toISOString(),
    last_login_at: row.last_login ? new Date(row.last_login).toISOString() : null,
    status: 'active',
    memberstack_id: row.id || row.member_id || null,
    // Will be set later based on state
    _state_code: stateCode,
  }
}

export async function POST(request) {
  try {
    // Verify admin access
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin (user can have multiple admin records)
    const adminClient = createAdminClient()
    const { data: adminRecords } = await adminClient
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)

    // Check if any admin record has sufficient permissions
    const hasAdminAccess = adminRecords?.some(a => ['admin', 'super_admin', 'national_admin'].includes(a.role))
    if (!hasAdminAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get CSV data from request
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const csvText = await file.text()
    const rows = parseCSV(csvText)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data found in CSV' }, { status: 400 })
    }

    // Fetch all state chapters for assignment
    const { data: stateChapters } = await adminClient
      .from('chapters')
      .select('id, state_code')
      .eq('level', 'state')

    // Create state code to chapter ID map
    const stateToChapterId = {}
    stateChapters?.forEach(chapter => {
      if (chapter.state_code) {
        stateToChapterId[chapter.state_code] = chapter.id
      }
    })

    // Process and import members
    const results = {
      total: rows.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      stateAssignments: 0,
      phoneNormalized: 0,
      stateNormalized: 0,
    }

    for (const row of rows) {
      try {
        if (!row.email) {
          results.skipped++
          results.errors.push({ row: row, error: 'Missing email' })
          continue
        }

        const memberData = mapMemberstackToMember(row)
        const stateCode = memberData._state_code
        delete memberData._state_code

        // Track normalization stats
        if (memberData.phone && row.phone_number !== memberData.phone) {
          results.phoneNormalized++
        }
        if (stateCode && row.state !== stateCode) {
          results.stateNormalized++
        }

        // Assign chapter based on state
        if (stateCode && stateToChapterId[stateCode]) {
          memberData.chapter_id = stateToChapterId[stateCode]
          results.stateAssignments++
        }

        // Check if member already exists
        const { data: existing } = await adminClient
          .from('members')
          .select('id')
          .eq('email', memberData.email)
          .single()

        if (existing) {
          // Update existing member
          const { error } = await adminClient
            .from('members')
            .update({
              first_name: memberData.first_name || undefined,
              last_name: memberData.last_name || undefined,
              phone: memberData.phone,
              state: memberData.state,
              zip_code: memberData.zip_code,
              bio: memberData.bio,
              wants_to_volunteer: memberData.wants_to_volunteer,
              volunteer_details: memberData.volunteer_details,
              mailing_list_opted_in: memberData.mailing_list_opted_in,
              memberstack_id: memberData.memberstack_id,
              last_login_at: memberData.last_login_at,
              chapter_id: memberData.chapter_id,
            })
            .eq('id', existing.id)

          if (error) throw error
          results.updated++
        } else {
          // Insert new member
          const { error } = await adminClient
            .from('members')
            .insert(memberData)

          if (error) throw error
          results.imported++
        }
      } catch (err) {
        results.skipped++
        results.errors.push({ email: row.email, error: err.message })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET endpoint to download a sample CSV template
export async function GET() {
  const template = `email\tCreatedAt\tLast Login\tFirst Name\tLast Name\tState\tZip Code\tPhone-Number\tMember Bio\tVolunteering\tMailing List\tVolunteering Details
john@example.com\t2024-01-15\t2024-06-01\tJohn\tDoe\tPennsylvania\t15213\t5551234567\tUnion organizer for 10 years\ttrue\ttrue\tExperience with community outreach`

  return new Response(template, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="member-import-template.csv"'
    }
  })
}
