import TopNav from '@/components/TopNav'
import { getCurrentTeamMember, getAccessibleSections } from '@/lib/teamMember'
import { hasRole } from '@/lib/permissions'
import { getSelectedChapterId } from '@/lib/chapterScope'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function WorkspaceLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember) {
    redirect('/login')
  }

  const sections = ['workspace', ...getAccessibleSections(teamMember.roles)]

  // Determine available chapters for the switcher
  let availableChapters = []
  let showAllOption = false

  if (hasRole(teamMember.roles, ['super_admin', 'national_admin'])) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('chapters')
      .select('id, name, level')
      .eq('is_active', true)
      .order('level')
      .order('name')
    availableChapters = data || []
    showAllOption = true
  } else if (hasRole(teamMember.roles, ['state_admin', 'county_admin'])) {
    const supabase = await createClient()

    const [{ data: ownChapter }, { data: descendants }] = await Promise.all([
      supabase
        .from('chapters')
        .select('id, name, level')
        .eq('id', teamMember.chapter_id)
        .single(),
      supabase.rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
    ])

    availableChapters = [ownChapter, ...(descendants || [])].filter(Boolean)
    showAllOption = availableChapters.length > 1
  }
  // city_admin and specialist roles: no switcher needed

  const selectedChapterId = await getSelectedChapterId()

  return (
    <div className="min-h-screen bg-stone-50">
      <TopNav
        sections={sections}
        availableChapters={availableChapters}
        selectedChapterId={selectedChapterId}
        showAllOption={showAllOption}
      />
      {children}
    </div>
  )
}
