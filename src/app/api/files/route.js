import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { BUCKET_PREFIXES } from '@/lib/r2'

const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']

function getHighestRole(roles) {
  if (!roles || roles.length === 0) return null
  let bestIndex = Infinity
  let bestRole = null
  for (const r of roles) {
    const idx = roleHierarchy.indexOf(r)
    if (idx !== -1 && idx < bestIndex) {
      bestIndex = idx
      bestRole = r
    }
  }
  return bestRole
}

// GET - List files based on user's access level
export async function GET(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { searchParams } = new URL(request.url)
    const bucketPrefix = searchParams.get('bucket')
    const chapterId = searchParams.get('chapter_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const search = searchParams.get('search')

    const adminClient = createAdminClient()

    // Build base query
    let query = adminClient
      .from('files')
      .select(`
        id,
        r2_key,
        bucket_prefix,
        original_filename,
        file_size_bytes,
        mime_type,
        access_tier,
        chapter_id,
        folder_id,
        description,
        tags,
        uploaded_by,
        uploaded_at,
        chapters (
          id,
          name,
          state_code
        )
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('uploaded_at', { ascending: false })

    // If not authenticated, only show public files
    if (!user) {
      query = query.eq('access_tier', 'public')
    } else {
      // Get team member record for the user
      const { data: teamMember } = await adminClient
        .from('team_members')
        .select('id, roles, chapter_id, is_media_team')
        .eq('user_id', user.id)
        .eq('active', true)
        .single()

      const highestRole = getHighestRole(teamMember?.roles)
      const isMediaTeam = teamMember?.is_media_team || false

      // Filter based on access level
      if (!highestRole) {
        // Regular member - only public and member-tier files
        query = query.in('access_tier', ['public', 'members'])
      } else if (teamMember.roles.some(r => ['super_admin', 'national_admin'].includes(r))) {
        // Full access - no additional filter needed
      } else {
        // Chapter admin - need to filter by jurisdiction
        const { data: descendants } = await adminClient
          .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
        const allowedChapterIds = descendants?.map(d => d.id) || []
        if (teamMember.chapter_id) {
          allowedChapterIds.push(teamMember.chapter_id)
        }

        // Build access filter
        const accessFilters = ['access_tier.in.(public,members)']

        if (allowedChapterIds.length > 0) {
          accessFilters.push(`and(access_tier.eq.chapter,chapter_id.in.(${allowedChapterIds.join(',')}))`)
        }

        if (isMediaTeam) {
          accessFilters.push('access_tier.eq.media')
        }

        query = query.or(accessFilters.join(','))
      }
    }

    // Apply filters
    if (bucketPrefix) {
      query = query.eq('bucket_prefix', bucketPrefix)
    }
    if (chapterId) {
      query = query.eq('chapter_id', chapterId)
    }
    if (search) {
      query = query.ilike('original_filename', `%${search}%`)
    }

    const folderId = searchParams.get('folder_id')
    if (folderId === 'root') {
      query = query.is('folder_id', null)
    } else if (folderId) {
      query = query.eq('folder_id', folderId)
    }

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: files, error, count } = await query

    if (error) throw error

    // Get uploader info
    const uploaderIds = [...new Set(files.map(f => f.uploaded_by).filter(Boolean))]
    let uploaderMap = {}

    if (uploaderIds.length > 0) {
      const { data: uploaders } = await adminClient
        .from('members')
        .select('user_id, first_name, last_name')
        .in('user_id', uploaderIds)

      uploaderMap = (uploaders || []).reduce((acc, u) => {
        acc[u.user_id] = `${u.first_name} ${u.last_name}`
        return acc
      }, {})
    }

    const enrichedFiles = files.map(f => ({
      ...f,
      uploader_name: uploaderMap[f.uploaded_by] || 'Unknown',
    }))

    return NextResponse.json({
      files: enrichedFiles,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })

  } catch (error) {
    console.error('List files error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
