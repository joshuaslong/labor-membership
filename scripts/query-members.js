// Script to query member counts
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://vzlqpihtmwqjolusyyqw.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bHFwaWh0bXdxam9sdXN5eXF3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI0OTE2MiwiZXhwIjoyMDgzODI1MTYyfQ._ahCPa9IW0OnYVGZonI-IXsk947iauTYOxi9nzPvBwY'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function queryMembers() {
  console.log('=== Membership Analysis ===\n')
  
  // 1. Total count of all members
  const { count: totalMembers, error: error1 } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
  
  if (error1) {
    console.error('Error counting members:', error1)
  } else {
    console.log(`1. Total members in database: ${totalMembers}`)
  }
  
  // 2. Find National chapter
  const { data: nationalChapter, error: error2 } = await supabase
    .from('chapters')
    .select('id, name, level')
    .eq('level', 'national')
    .single()
  
  if (error2) {
    console.error('Error finding national chapter:', error2)
  } else {
    console.log(`\n2. National chapter: ${nationalChapter.name} (ID: ${nationalChapter.id})`)
  }
  
  // 3. Count members in member_chapters for National chapter
  if (nationalChapter) {
    const { count: nationalMemberCount, error: error3 } = await supabase
      .from('member_chapters')
      .select('*', { count: 'exact', head: true })
      .eq('chapter_id', nationalChapter.id)
    
    if (error3) {
      console.error('Error counting national chapter members:', error3)
    } else {
      console.log(`   Members in member_chapters for National: ${nationalMemberCount}`)
    }
  }
  
  // 4. Count members WITHOUT any member_chapters entries
  const { data: allMembers, error: error4 } = await supabase
    .from('members')
    .select('id')
  
  const { data: membersInChapters, error: error5 } = await supabase
    .from('member_chapters')
    .select('member_id')
  
  if (error4 || error5) {
    console.error('Error querying members:', error4 || error5)
  } else {
    const memberIdsInChapters = new Set(membersInChapters.map(mc => mc.member_id))
    const membersWithoutChapters = allMembers.filter(m => !memberIdsInChapters.has(m.id))
    console.log(`\n3. Members without ANY chapter assignment: ${membersWithoutChapters.length}`)
  }
  
  // 5. Get sample of members without chapters
  if (allMembers && membersInChapters) {
    const memberIdsInChapters = new Set(membersInChapters.map(mc => mc.member_id))
    const membersWithoutChaptersIds = allMembers
      .filter(m => !memberIdsInChapters.has(m.id))
      .slice(0, 5)
      .map(m => m.id)
    
    if (membersWithoutChaptersIds.length > 0) {
      const { data: sampleMembers, error: error6 } = await supabase
        .from('members')
        .select('id, email, first_name, last_name, status')
        .in('id', membersWithoutChaptersIds)
      
      if (!error6) {
        console.log('\n4. Sample members without chapters (first 5):')
        sampleMembers.forEach(m => {
          console.log(`   - ${m.first_name} ${m.last_name} (${m.email}) - Status: ${m.status}`)
        })
      }
    }
  }
  
  // 6. Count members by status
  const { data: membersByStatus, error: error7 } = await supabase
    .from('members')
    .select('status')
  
  if (!error7) {
    const statusCounts = membersByStatus.reduce((acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1
      return acc
    }, {})
    
    console.log('\n5. Members by status:')
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`)
    })
  }
  
  // 7. Count ACTIVE members
  const { count: activeMembers, error: error8 } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
  
  if (!error8) {
    console.log(`\n6. Active members: ${activeMembers}`)
  }
  
  // 8. Check if the 177 count might be related to active members in national chapter
  if (nationalChapter) {
    const { data: nationalChapterMembers, error: error9 } = await supabase
      .from('member_chapters')
      .select('member_id')
      .eq('chapter_id', nationalChapter.id)
    
    if (!error9) {
      const nationalMemberIds = nationalChapterMembers.map(mc => mc.member_id)
      
      const { count: activeNationalMembers, error: error10 } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .in('id', nationalMemberIds)
        .eq('status', 'active')
      
      if (!error10) {
        console.log(`   Active members in National chapter: ${activeNationalMembers}`)
      }
    }
  }
  
  console.log('\n=== Analysis Complete ===')
}

queryMembers().catch(console.error)
