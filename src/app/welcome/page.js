import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: member } = await supabase
    .from('members')
    .select('first_name, chapters(name)')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to the fight, {member.first_name}!
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          You're officially a member of {member.chapters?.name || 'the Labor Party'}.
          Together, we're building something different.
        </p>

        {/* Contribution Card */}
        <div className="card bg-labor-red-50 border border-labor-red-100 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Power the movement
          </h2>
          <p className="text-gray-600 mb-4">
            We don't take corporate money—ever. Your contribution, big or small,
            keeps us independent and fighting for working people.
          </p>
          <Link href="/dashboard/contribute" className="btn-primary w-full py-3">
            Contribute Now
          </Link>
          <p className="text-xs text-gray-500 mt-2">
            Monthly or one-time contributions welcome
          </p>
        </div>

        {/* Skip Link */}
        <Link
          href="/dashboard"
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          Skip for now → Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
