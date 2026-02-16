import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import CollectionPage from '../../c/[collectionSlug]/CollectionPage'

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

async function fetchCollection(supabase, collectionSlug, chapterId) {
  // Try chapter-scoped collection first
  const { data: chapterCol } = await supabase
    .from('resource_collections')
    .select(`
      id,
      name,
      slug,
      description,
      chapter_id,
      resource_collection_sections (
        id,
        name,
        sort_order,
        resource_section_files (
          id,
          file_id,
          sort_order,
          files:file_id (
            id,
            original_filename,
            mime_type,
            file_size_bytes,
            description
          )
        )
      )
    `)
    .eq('slug', collectionSlug)
    .eq('chapter_id', chapterId)
    .eq('is_published', true)
    .single()

  if (chapterCol) return chapterCol

  // Fallback to national collection
  const { data: nationalCol } = await supabase
    .from('resource_collections')
    .select(`
      id,
      name,
      slug,
      description,
      chapter_id,
      resource_collection_sections (
        id,
        name,
        sort_order,
        resource_section_files (
          id,
          file_id,
          sort_order,
          files:file_id (
            id,
            original_filename,
            mime_type,
            file_size_bytes,
            description
          )
        )
      )
    `)
    .eq('slug', collectionSlug)
    .is('chapter_id', null)
    .eq('is_published', true)
    .single()

  return nationalCol || null
}

export async function generateMetadata({ params }) {
  const { slugOrId, collectionSlug } = await params
  const supabase = createAdminClient()

  const chapter = await resolveChapter(supabase, slugOrId)
  if (!chapter || !chapter.public_resources_enabled) {
    return { title: 'Collection Not Found' }
  }

  const collection = await fetchCollection(supabase, collectionSlug, chapter.id)
  if (!collection) {
    return { title: 'Collection Not Found' }
  }

  return {
    title: `${collection.name} — ${chapter.name} Resources — Labor Party`,
    description: collection.description || `Browse and download assets from ${collection.name}.`,
  }
}

export default async function ChapterCollectionPage({ params }) {
  const { slugOrId, collectionSlug } = await params
  const supabase = createAdminClient()

  const chapter = await resolveChapter(supabase, slugOrId)
  if (!chapter || !chapter.public_resources_enabled) {
    notFound()
  }

  const collection = await fetchCollection(supabase, collectionSlug, chapter.id)
  if (!collection) {
    notFound()
  }

  // Sort sections and files
  const sorted = {
    ...collection,
    sections: (collection.resource_collection_sections || [])
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((section) => ({
        ...section,
        files: (section.resource_section_files || [])
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((sf) => ({
            ...sf.files,
            section_file_id: sf.id,
          })),
      })),
  }
  delete sorted.resource_collection_sections

  const chapterSlugOrId = chapter.slug || chapter.id

  return (
    <CollectionPage
      collection={sorted}
      backHref={`/resources/${chapterSlugOrId}`}
      backLabel={`Back to ${chapter.name} Resources`}
    />
  )
}
