import { createAdminClient } from '@/lib/supabase/server'
import ResourcesPortal from './ResourcesPortal'

export const metadata = {
  title: 'Resources — Labor Party',
  description: 'Download campaign assets, brand materials, and official documents.',
}

export default async function NationalResourcesPage() {
  const supabase = createAdminClient()

  const { data: collections, error } = await supabase
    .from('resource_collections')
    .select(`
      id,
      name,
      slug,
      description,
      resource_collection_sections (
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
  }

  // Transform to add asset counts and first image thumbnail
  const enriched = (collections || []).map((col) => {
    const sections = col.resource_collection_sections || []
    let assetCount = 0
    let firstImageFileId = null

    for (const section of sections) {
      const sectionFiles = section.resource_section_files || []
      assetCount += sectionFiles.length
      if (!firstImageFileId) {
        const imageFile = sectionFiles.find(
          (sf) => sf.files?.mime_type?.startsWith('image/')
        )
        if (imageFile) {
          firstImageFileId = imageFile.file_id
        }
      }
    }

    return {
      id: col.id,
      name: col.name,
      slug: col.slug,
      description: col.description,
      sectionCount: sections.length,
      assetCount,
      thumbnailFileId: firstImageFileId,
    }
  })

  return (
    <ResourcesPortal
      collections={enriched}
      title="Resources"
      subtitle="Download official campaign assets, brand materials, and documents."
      basePath="/resources/c"
    />
  )
}
