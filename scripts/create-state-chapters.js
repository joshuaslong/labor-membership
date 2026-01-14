// Script to create all US state chapters
// Run with: node scripts/create-state-chapters.js

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://vzlqpihtmwqjolusyyqw.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bHFwaWh0bXdxam9sdXN5eXF3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI0OTE2MiwiZXhwIjoyMDgzODI1MTYyfQ._ahCPa9IW0OnYVGZonI-IXsk947iauTYOxi9nzPvBwY'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'PR', name: 'Puerto Rico' },
]

async function createStateChapters() {
  console.log('Finding National chapter...')

  // Get national chapter ID
  const { data: national, error: nationalError } = await supabase
    .from('chapters')
    .select('id')
    .eq('level', 'national')
    .single()

  if (nationalError || !national) {
    console.error('Could not find national chapter:', nationalError)
    return
  }

  console.log('National chapter ID:', national.id)

  // Get existing state chapters
  const { data: existingChapters } = await supabase
    .from('chapters')
    .select('state_code')
    .eq('level', 'state')

  const existingCodes = new Set(existingChapters?.map(c => c.state_code) || [])
  console.log('Existing state chapters:', [...existingCodes])

  // Create missing state chapters
  const chaptersToCreate = US_STATES
    .filter(state => !existingCodes.has(state.code))
    .map(state => ({
      name: `${state.name} Labor Party`,
      level: 'state',
      state_code: state.code,
      parent_id: national.id,
      is_active: true,
    }))

  if (chaptersToCreate.length === 0) {
    console.log('All state chapters already exist!')
    return
  }

  console.log(`Creating ${chaptersToCreate.length} state chapters...`)

  const { data, error } = await supabase
    .from('chapters')
    .insert(chaptersToCreate)
    .select()

  if (error) {
    console.error('Error creating chapters:', error)
    return
  }

  console.log(`Successfully created ${data.length} state chapters:`)
  data.forEach(c => console.log(`  - ${c.name} (${c.state_code})`))
}

createStateChapters()
