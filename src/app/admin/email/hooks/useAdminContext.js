import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook for managing admin authentication, permissions, and accessible chapters
 */
export function useAdminContext() {
  const [adminInfo, setAdminInfo] = useState(null)
  const [adminEmail, setAdminEmail] = useState('')
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadAdminContext = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setError('Not authenticated')
          setLoading(false)
          return
        }

        // Get admin info (user can have multiple admin records)
        const { data: adminRecords } = await supabase
          .from('admin_users')
          .select('id, role, chapter_id, chapters(id, name)')
          .eq('user_id', user.id)

        // Use highest privilege role for determining access
        let admin = null
        if (adminRecords && adminRecords.length > 0) {
          const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
          admin = adminRecords.reduce((highest, current) => {
            const currentIndex = roleHierarchy.indexOf(current.role)
            const highestIndex = roleHierarchy.indexOf(highest.role)
            return currentIndex < highestIndex ? current : highest
          }, adminRecords[0])
        }

        if (!admin) {
          setError('No admin access')
          setLoading(false)
          return
        }

        setAdminInfo(admin)

        // Get admin's email from members table
        const { data: adminMember } = await supabase
          .from('members')
          .select('email')
          .eq('user_id', user.id)
          .single()

        if (adminMember?.email) {
          setAdminEmail(adminMember.email)
        }

        // Load chapters based on admin role
        if (['super_admin', 'national_admin'].includes(admin.role)) {
          // Super admins can see all chapters
          const { data: allChapters } = await supabase
            .from('chapters')
            .select('id, name, level')
            .order('name')

          setChapters(allChapters || [])
        } else if (admin.chapter_id) {
          // Get descendants for chapter admins
          const { data: descendants } = await supabase
            .rpc('get_chapter_descendants', { chapter_uuid: admin.chapter_id })

          // Also include their own chapter
          const chapterIds = [admin.chapter_id, ...(descendants?.map(d => d.id) || [])]

          const { data: accessibleChapters } = await supabase
            .from('chapters')
            .select('id, name, level')
            .in('id', chapterIds)
            .order('name')

          setChapters(accessibleChapters || [])
        }

        setLoading(false)
      } catch (err) {
        console.error('Error loading admin context:', err)
        setError(err.message)
        setLoading(false)
      }
    }

    loadAdminContext()
  }, [])

  const isSuperAdmin = ['super_admin', 'national_admin'].includes(adminInfo?.role)

  return {
    adminInfo,
    adminEmail,
    chapters,
    loading,
    error,
    isSuperAdmin
  }
}
