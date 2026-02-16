import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import ResourcesPortal from '../ResourcesPortal'

async function resolveChapter(supabase, slugOrId) {
  // Try slug first
  const { data: bySlug } = await supabase
    .from('chapters')
    .select('id, name, slug, public_resources_enabled')
    .eq('slug', slugOrId)
    .single()

  if (bySlug) return bySlug

  // Fallback to UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(slugOrId)) {
    const { data: byId } = await supabase
      .from('chapters')
      .select('id, name, slug, public_resources_enabled')
      .eq('id', slugOrId)
      .single()

    if (byId) return byId
  }

  return null
}

async function fetchCollections(supabase, chapterId) {
  const { data, error } = await supabase
    .from('resource_collections')
    .select(`
      id,
      name,
      slug,
      description,
      chapter_id,
      resource_sections (
        id,
        resource_section_files (
          id,
          file_id,
          files:file_id (
            id,
            mime_type
          )
        )
      )
    `)
    .eq('chapter_id', chapterId)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to fetch chapter collections:', error)
    return []
  }

  return (data || []).map((col) => {
    const sections = col.resource_sections || []
    let assetCount = 0
    let firstImageFileId = null

    for (const section of sections) {
      const sectionFiles = section.resource_section_files || []
      assetCount += sectionFiles.length
      if (!firstImageFileId) {
        const imageFile = sectionFiles.find(
          (sf) => sf.files?.mime_type?.startsWith('image/')
        )
        if (imageFile) firstImageFileId = imageFile.file_id
      }
    }

    return {
      id: col.id,
      name: col.name,
      slug: col.slug,
      description: col.description,
      chapter_id: col.chapter_id,
      sectionCount: sections.length,
      assetCount,
      thumbnailFileId: firstImageFileId,
    }
  })
}

async function fetchNationalCollections(supabase) {
  const { data, error } = await supabase
    .from('resource_collections')
    .select(`
      id,
      name,
      slug,
      description,
      resource_sections (
        id,
        resource_section_files (
          id,
          file_id,
          files:file_id (
            id,
            mime_type
          )
        )
      )
    `)
    .is('chapter_id', null)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to fetch national collections:', error)
    return []
  }

  return (data || []).map((col) => {
    const sections = col.resource_sections || []
    let assetCount = 0
    let firstImageFileId = null

    for (const section of sections) {
      const sectionFiles = section.resource_section_files || []
      assetCount += sectionFiles.length
      if (!firstImageFileId) {
        const imageFile = sectionFiles.find(
          (sf) => sf.files?.mime_type?.startsWith('image/')
        )
        if (imageFile) firstImageFileId = imageFile.file_id
      }
    }

    return {
      id: col.id,
      name: col.name,
      slug: col.slug,
      description: col.description,
      chapter_id: null,
      sectionCount: sections.length,
      assetCount,
      thumbnailFileId: firstImageFileId,
    }
  })
}

export async function generateMetadata({ params }) {
  const { slugOrId } = await params
  const supabase = createAdminClient()
  const chapter = await resolveChapter(supabase, slugOrId)

  if (!chapter || !chapter.public_resources_enabled) {
    return { title: 'Resources Not Found' }
  }

  return {
    title: `${chapter.name} Resources — Labor Party`,
    description: `Browse and download resources from ${chapter.name}.`,
  }
}

export default async function ChapterPortalPage({ params }) {
  const { slugOrId } = await params
  const supabase = createAdminClient()

  const chapter = await resolveChapter(supabase, slugOrId)

  if (!chapter || !chapter.public_resources_enabled) {
    notFound()
  }

  const chapterSlugOrId = chapter.slug || chapter.id
  const [chapterCollections, nationalCollections] = await Promise.all([
    fetchCollections(supabase, chapter.id),
    fetchNationalCollections(supabase),
  ])

  return (
    <div>
      {/* Chapter collections */}
      <ResourcesPortal
        collections={chapterCollections}
        title="Resources"
        subtitle={`Resources and assets from ${chapter.name}.`}
        chapterName={chapter.name}
        basePath={`/resources/${chapterSlugOrId}`}
      />

      {/* National resources section */}
      {nationalCollections.length > 0 && (
        <div className="border-t border-stone-200">
          <ResourcesPortal
            collections={nationalCollections}
            title="National Resources"
            subtitle="Official national campaign assets and documents."
            basePath={`/resources/${chapterSlugOrId}`}
          />
        </div>
      )}
    </div>
  )
}
