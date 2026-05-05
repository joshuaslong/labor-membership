import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const maxDuration = 60

// Fields the original per-row update touched. Anything outside this list (email,
// mailing_list_opted_in, joined_date, status) is intentionally preserved on existing rows.
const UPDATEABLE_FIELDS = [
  'first_name', 'last_name', 'phone', 'state', 'zip_code', 'bio',
  'wants_to_volunteer', 'volunteer_experience', 'volunteer_skills',
  'volunteer_interests', 'memberstack_id', 'last_login_at', 'chapter_id',
]

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

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

// Check if a CSV value is truthy
function isTruthy(value) {
  if (!value) return false
  const v = value.toString().trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes' || v === 'y'
}

// Map Memberstack fields to our schema with normalization
function mapMemberstackToMember(row) {
  const stateCode = normalizeState(row.state)
  const isVolunteer = isTruthy(row.volunteering) || isTruthy(row.volunteer)
  const isDonor = isTruthy(row.donor)
  const isOrganizer = isTruthy(row.organizer)

  // Build segments array from CSV data
  const segments = []
  if (isVolunteer) segments.push('volunteer')
  if (isDonor) segments.push('donor')
  if (isOrganizer) segments.push('organizer')

  return {
    email: row.email?.toLowerCase().trim(),
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    phone: normalizePhone(row.phone_number || row.phone),
    state: stateCode,
    zip_code: row.zip_code || row.zipcode || null,
    bio: row.member_bio || null,
    wants_to_volunteer: isVolunteer,
    volunteer_experience: row.volunteer_experience || null,
    volunteer_skills: row.volunteer_skills || null,
    volunteer_interests: row.volunteer_interests || null,
    // Default mailing list to TRUE (as requested)
    mailing_list_opted_in: true,
    joined_date: row.createdat ? new Date(row.createdat).toISOString() : new Date().toISOString(),
    last_login_at: row.last_login ? new Date(row.last_login).toISOString() : null,
    status: 'active',
    memberstack_id: row.id || row.member_id || null,
    // Internal fields (removed before insert)
    _state_code: stateCode,
    _segments: segments,
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

    // Check if user is admin
    const adminClient = createAdminClient()
    const { data: teamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id, is_media_team')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    // Check if team member has sufficient permissions
    const hasAdminAccess = teamMember?.roles?.some(r => ['super_admin', 'national_admin'].includes(r))
    if (!hasAdminAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get team member ID for segment applied_by tracking
    const adminUserId = teamMember?.id || null

    // Get CSV data from request
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const csvText = await file.text()
    const rawRows = parseCSV(csvText)

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'No data found in CSV' }, { status: 400 })
    }

    // Fetch all state chapters for assignment
    const { data: stateChapters } = await adminClient
      .from('chapters')
      .select('id, state_code')
      .eq('level', 'state')

    const stateToChapterId = {}
    stateChapters?.forEach(c => { if (c.state_code) stateToChapterId[c.state_code] = c.id })

    const results = {
      total: rawRows.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      stateAssignments: 0,
      phoneNormalized: 0,
      stateNormalized: 0,
      segmentsApplied: 0,
    }

    // Pass 1: normalize, dedupe by email (last occurrence wins to mirror per-row loop semantics)
    const validRowsByEmail = new Map()
    for (const row of rawRows) {
      if (!row.email) {
        results.skipped++
        const label = `${row.first_name || ''} ${row.last_name || ''}`.trim() || '(no email)'
        results.errors.push({ email: label, error: 'Missing email' })
        continue
      }

      const memberData = mapMemberstackToMember(row)
      const stateCode = memberData._state_code
      const segments = memberData._segments
      delete memberData._state_code
      delete memberData._segments

      if (memberData.phone && row.phone_number !== memberData.phone) results.phoneNormalized++
      if (stateCode && row.state !== stateCode) results.stateNormalized++

      if (stateCode && stateToChapterId[stateCode]) {
        memberData.chapter_id = stateToChapterId[stateCode]
        results.stateAssignments++
      }

      validRowsByEmail.set(memberData.email, { memberData, segments })
    }

    const emails = [...validRowsByEmail.keys()]
    if (emails.length === 0) {
      return NextResponse.json({ success: true, results })
    }

    // Pass 2: bulk-fetch existing members so we can split into insert/update buckets
    const existingByEmail = new Map()
    for (const emailChunk of chunk(emails, 1000)) {
      const { data: existing, error: fetchErr } = await adminClient
        .from('members')
        .select(['id', 'email', ...UPDATEABLE_FIELDS].join(', '))
        .in('email', emailChunk)
      if (fetchErr) throw fetchErr
      existing?.forEach(m => existingByEmail.set(m.email, m))
    }

    // Pass 3: build uniform-shape rows for insert vs update.
    // For updates, merge non-empty new fields over existing values so every row in the
    // upsert has the same column set (PostgREST bulk upsert union-of-columns rule).
    // The `new || existing` pattern preserves the original `|| undefined` semantics —
    // notably keeping `wants_to_volunteer` from being flipped true → false.
    const toInsert = []
    const toUpdate = []
    for (const [email, { memberData }] of validRowsByEmail) {
      const existing = existingByEmail.get(email)
      if (existing) {
        const merged = { id: existing.id }
        for (const field of UPDATEABLE_FIELDS) {
          merged[field] = memberData[field] || existing[field]
        }
        toUpdate.push(merged)
      } else {
        toInsert.push(memberData)
      }
    }

    // Pass 4: bulk insert new members; on chunk error, fall back to per-row to identify which row failed
    const newEmailToId = new Map()
    for (const insertChunk of chunk(toInsert, 200)) {
      const { data: inserted, error: insertErr } = await adminClient
        .from('members')
        .insert(insertChunk)
        .select('id, email')

      if (insertErr) {
        for (const row of insertChunk) {
          const { data: ins, error: rowErr } = await adminClient
            .from('members').insert(row).select('id').single()
          if (rowErr) {
            results.skipped++
            results.errors.push({ email: row.email, error: rowErr.message })
          } else {
            newEmailToId.set(row.email, ins.id)
            results.imported++
          }
        }
      } else {
        inserted?.forEach(m => newEmailToId.set(m.email, m.id))
        results.imported += inserted?.length || 0
      }
    }

    // Pass 5: bulk upsert updates (by id); per-row fallback on chunk error
    for (const updateChunk of chunk(toUpdate, 200)) {
      const { error: updateErr } = await adminClient
        .from('members')
        .upsert(updateChunk, { onConflict: 'id' })

      if (updateErr) {
        for (const row of updateChunk) {
          const { id, ...patch } = row
          const { error: rowErr } = await adminClient
            .from('members').update(patch).eq('id', id)
          if (rowErr) {
            results.skipped++
            results.errors.push({ email: row.email || `id:${id}`, error: rowErr.message })
          } else {
            results.updated++
          }
        }
      } else {
        results.updated += updateChunk.length
      }
    }

    // Pass 6: collect all (member_id, segment) pairs and bulk-upsert in one shot
    const allSegmentRows = []
    for (const [email, { segments }] of validRowsByEmail) {
      if (segments.length === 0) continue
      const memberId = existingByEmail.get(email)?.id ?? newEmailToId.get(email)
      if (!memberId) continue // insert failed for this row; skip its segments
      for (const segment of segments) {
        allSegmentRows.push({
          member_id: memberId,
          segment,
          applied_by: adminUserId,
          auto_applied: false,
        })
      }
    }

    for (const segChunk of chunk(allSegmentRows, 1000)) {
      const { error: segErr } = await adminClient
        .from('member_segments')
        .upsert(segChunk, { onConflict: 'member_id,segment', ignoreDuplicates: true })
      if (!segErr) results.segmentsApplied += segChunk.length
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
  const template = `email,CreatedAt,Last Login,First Name,Last Name,State,Zip Code,Phone-Number,Member Bio,Volunteering,Volunteer Experience,Volunteer Skills,Volunteer Interests,Mailing List,Donor,Organizer
john@example.com,2024-01-15,2024-06-01,John,Doe,Pennsylvania,15213,5551234567,"Union organizer for 10 years",true,"5 years canvassing and phone banking","Public speaking, Data entry","Electoral campaigns, Community outreach",true,false,true`

  return new Response(template, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="member-import-template.csv"'
    }
  })
}
