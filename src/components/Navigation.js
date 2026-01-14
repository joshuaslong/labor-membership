import Link from 'next/link'
import Image from 'next/image'
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
    <nav className="sticky top-0 z-50 bg-labor-red border-b border-labor-red-600">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/logo-white.png"
            alt="Labor Party"
            width={160}
            height={40}
            className="h-8 w-auto"
            priority
          />
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-1">
          <Link
            href="/chapters"
            className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            Chapters
          </Link>

          {user ? (
            <>
              <Link
                href="/dashboard"
                className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              >
                Dashboard
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                >
                  Admin
                </Link>
              )}

              <div className="ml-2 pl-3 border-l border-white/20 flex items-center gap-3">
                <span className="text-sm text-white/70">
                  {memberName || user.email?.split('@')[0]}
                </span>
                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                  >
                    Log out
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              <Link
                href="/join"
                className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              >
                Join
              </Link>
              <Link
                href="/login"
                className="ml-2 px-4 py-2 text-sm font-medium bg-white text-labor-red rounded-md hover:bg-white/90 transition-colors"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
