import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function Navigation() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  let memberName = null

  if (user) {
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single()
    isAdmin = !!adminUser

    const { data: member } = await supabase
      .from('members')
      .select('first_name')
      .eq('user_id', user.id)
      .single()
    memberName = member?.first_name
  }

  return (
    <nav className="bg-labor-red text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl">Labor Party</Link>
        <div className="flex gap-6 items-center">
          <Link href="/chapters" className="hover:text-red-200">Chapters</Link>

          {user ? (
            <>
              <Link href="/dashboard" className="hover:text-red-200">Dashboard</Link>
              {isAdmin && (
                <Link href="/admin" className="hover:text-red-200">Admin</Link>
              )}
              <div className="flex items-center gap-3">
                <span className="text-red-200 text-sm">
                  {memberName || user.email}
                </span>
                <form action="/api/auth/logout" method="POST">
                  <button type="submit" className="text-sm hover:text-red-200">
                    Log Out
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              <Link href="/join" className="hover:text-red-200">Join</Link>
              <Link href="/login" className="bg-white text-labor-red px-4 py-2 rounded-lg font-medium hover:bg-red-50">
                Log In
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
