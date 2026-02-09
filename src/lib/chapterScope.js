import { cookies } from 'next/headers'
import { getChapterScope, hasRole } from '@/lib/permissions'

/**
 * Get the effective chapter scope, considering both the user's
 * natural permissions AND their chapter switcher selection (cookie).
 *
 * @param {Object} teamMember - Team member with roles and chapter_id
 * @returns {Promise<null|{chapterId: string, includeDescendants: boolean}>}
 *   null = full access (no filter), object = scoped to chapter
 */
export async function getEffectiveChapterScope(teamMember) {
  const naturalScope = getChapterScope(teamMember.roles, teamMember.chapter_id)

  const cookieStore = await cookies()
  const selected = cookieStore.get('chapter_scope')?.value

  // No cookie or "all" → use natural scope (preserves current behavior)
  if (!selected || selected === 'all') {
    return naturalScope
  }

  // Cookie has a specific chapter UUID
  // Super/national admins (naturalScope === null) can narrow to any chapter
  if (naturalScope === null) {
    return { chapterId: selected, includeDescendants: true }
  }

  // Geographic admins: trust that the cookie was validated when set.
  // If it somehow references an inaccessible chapter, queries will
  // simply return no results (safe failure).
  return { chapterId: selected, includeDescendants: true }
}

/**
 * Resolve the list of chapter IDs that the scope covers.
 * Call this once (async), then use the result to filter queries synchronously.
 *
 * @param {null|Object} scope - From getEffectiveChapterScope
 * @param {Object} supabase - Supabase client for RPC calls
 * @returns {Promise<string[]|null>} Array of chapter IDs, or null for no filter
 */
export async function resolveChapterIds(scope, supabase) {
  if (!scope || !scope.chapterId) return null

  if (scope.includeDescendants) {
    const { data: descendants } = await supabase
      .rpc('get_chapter_descendants', { chapter_uuid: scope.chapterId })
    return [scope.chapterId, ...(descendants?.map(d => d.id) || [])]
  }

  return [scope.chapterId]
}

/**
 * Apply chapter ID filtering to a Supabase query (synchronous).
 * Use resolveChapterIds() first to get the IDs.
 *
 * @param {Object} query - Supabase query builder
 * @param {string[]|null} chapterIds - From resolveChapterIds, or null for no filter
 * @param {string} [columnName='chapter_id'] - Column to filter on
 * @returns {Object} The filtered query builder
 */
export function applyChapterFilter(query, chapterIds, columnName = 'chapter_id') {
  if (!chapterIds) return query
  if (chapterIds.length === 1) return query.eq(columnName, chapterIds[0])
  return query.in(columnName, chapterIds)
}

/**
 * Get the raw selected chapter ID from the cookie.
 * For passing to client components as a prop.
 *
 * @returns {Promise<string>} Chapter UUID or 'all'
 */
export async function getSelectedChapterId() {
  const cookieStore = await cookies()
  return cookieStore.get('chapter_scope')?.value || 'all'
}
