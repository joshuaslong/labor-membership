import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: member } = await supabase
    .from('members')
    .select('*, chapters(name, level)')
    .eq('user_id', user.id)
    .single()

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isAdmin = !!adminUser

  if (!member) {
    if (isAdmin) {
      redirect('/admin')
    }
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="card text-center">
          <h1 className="text-2xl font-bold mb-4">Account Setup Required</h1>
          <p className="text-gray-600 mb-6">
            Your account is not linked to a membership. Please contact support.
          </p>
        </div>
      </div>
    )
  }

  const STATUS_COLORS = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    lapsed: 'bg-orange-100 text-orange-800',
    cancelled: 'bg-red-100 text-red-800',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {member.first_name}!
          </h1>
          <p className="text-gray-600">Member Dashboard</p>
        </div>
        {isAdmin && (
          <Link href="/admin" className="btn-primary">
            Admin Dashboard
          </Link>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Membership Status</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Status</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[member.status]}`}>
                {member.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Member Since</span>
              <span className="font-medium">
                {new Date(member.joined_date).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Chapter</span>
              <Link href={`/chapters/${member.chapter_id}`} className="text-labor-red hover:underline">
                {member.chapters?.name}
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Your Profile</h2>
            <Link href="/dashboard/profile" className="text-labor-red text-sm hover:underline">
              Edit
            </Link>
          </div>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-500">Name:</span> {member.first_name} {member.last_name}</p>
            <p><span className="text-gray-500">Email:</span> {member.email}</p>
            {member.phone && <p><span className="text-gray-500">Phone:</span> {member.phone}</p>}
            {member.city && member.state && (
              <p><span className="text-gray-500">Location:</span> {member.city}, {member.state}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
