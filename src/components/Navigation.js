import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import MobileNav from './MobileNav'

export default async function Navigation() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  let memberName = null

  if (user) {
    // Check for team member with admin roles
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('id, roles, chapter_id, is_media_team')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()
    isAdmin = teamMember?.roles?.some(r => ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin'].includes(r))

    const { data: member } = await supabase
      .from('members')
      .select('first_name')
      .eq('user_id', user.id)
      .single()
    memberName = member?.first_name
  }

  const navData = {
    isLoggedIn: !!user,
    isAdmin,
    memberName: memberName || user?.email?.split('@')[0] || null,
  }

  return (
    <nav className="sticky top-0 z-50 bg-labor-red-700 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center flex-shrink-0">
          <Image
            src="/logo-white.png"
            alt="Labor Party"
            width={160}
            height={40}
            className="h-7 sm:h-8 w-auto"
            priority
          />
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-1">
          <Link
            href="/chapters"
            className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            Chapters
          </Link>
          <Link
            href="/initiatives"
            className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            Initiatives
          </Link>
          <Link
            href="/contribute"
            className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            Contribute
          </Link>
          <Link
            href="/events"
            className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            Events
          </Link>
          <Link
            href="/organize"
            className="px-3 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            Organize
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

              <div className="ml-2 pl-3 border-l border-white/20 flex items-center gap-2">
                <span className="text-sm text-white/70 truncate max-w-[120px] lg:max-w-[180px]">
                  {memberName || user.email?.split('@')[0]}
                </span>
                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors whitespace-nowrap"
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

        {/* Mobile Navigation */}
        <MobileNav {...navData} />
      </div>
    </nav>
  )
}
