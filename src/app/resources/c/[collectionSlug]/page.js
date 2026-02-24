import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import CollectionPage from './CollectionPage'

export async function generateMetadata({ params }) {
  const { collectionSlug } = await params
  const supabase = createAdminClient()

  const { data: collection } = await supabase
    .from('resource_collections')
    .select('name, description')
    .eq('slug', collectionSlug)
    .is('chapter_id', null)
    .single()

  if (!collection) return { title: 'Collection Not Found' }

  return {
    title: `${collection.name} — Resources — Labor Party`,
    description: collection.description || `Browse and download assets from ${collection.name}.`,
  }
}

export default async function NationalCollectionPage({ params }) {
  const { collectionSlug } = await params
  const supabase = createAdminClient()

  const { data: collection, error } = await supabase
    .from('resource_collections')
    .select(`
      id,
      name,
      slug,
      description,
      resource_sections (
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

  if (error || !collection) {
    notFound()
  }

  // Sort sections by sort_order, and files within each section
  const sorted = {
    ...collection,
    sections: (collection.resource_sections || [])
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
  delete sorted.resource_sections

  return (
    <CollectionPage
      collection={sorted}
      backHref="/resources"
      backLabel="Back to Resources"
    />
  )
}
