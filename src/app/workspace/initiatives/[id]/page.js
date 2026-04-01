import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import InitiativeForm from '@/components/InitiativeForm'

export default async function EditInitiativePage({ params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const { id } = await params
  const supabase = createAdminClient()
  const { data: initiative } = await supabase
    .from('initiatives')
    .select('*')
    .eq('id', id)
    .single()

  if (!initiative) {
    redirect('/workspace/initiatives')
  }

  return <InitiativeForm initiative={initiative} />
}
