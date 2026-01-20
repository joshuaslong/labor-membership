// MailerLite API client using direct REST API calls
// This avoids the SDK which has build-time initialization issues

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api'

async function apiRequest(endpoint, options = {}) {
  const apiKey = process.env.MAILERLITE_API_KEY
  if (!apiKey) {
    throw new Error('MAILERLITE_API_KEY is not configured')
  }

  const response = await fetch(`${MAILERLITE_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `MailerLite API error: ${response.status}`)
  }

  return response.json()
}

// Group IDs will be cached after first fetch
let groupCache = null

/**
 * Get or create a MailerLite group for a chapter
 */
export async function getOrCreateChapterGroup(chapterName) {
  if (!chapterName) return null

  const groupName = `Chapter: ${chapterName}`

  // Check cache first
  if (groupCache) {
    const cached = groupCache.find((g) => g.name === groupName)
    if (cached) return cached.id
  }

  // Fetch all groups
  const groupsResponse = await apiRequest('/groups?limit=100')
  groupCache = groupsResponse.data || []

  // Check if group exists
  const existing = groupCache.find((g) => g.name === groupName)
  if (existing) return existing.id

  // Create new group
  const newGroup = await apiRequest('/groups', {
    method: 'POST',
    body: JSON.stringify({ name: groupName }),
  })

  // Update cache
  groupCache.push(newGroup.data)

  return newGroup.data.id
}

/**
 * Get or create the general mailing list group (for non-member signups)
 */
export async function getOrCreateMailingListGroup() {
  const groupName = 'Mailing List'

  if (groupCache) {
    const cached = groupCache.find((g) => g.name === groupName)
    if (cached) return cached.id
  }

  const groupsResponse = await apiRequest('/groups?limit=100')
  groupCache = groupsResponse.data || []

  const existing = groupCache.find((g) => g.name === groupName)
  if (existing) return existing.id

  const newGroup = await apiRequest('/groups', {
    method: 'POST',
    body: JSON.stringify({ name: groupName }),
  })

  groupCache.push(newGroup.data)
  return newGroup.data.id
}

/**
 * Get or create a group for an initiative
 */
export async function getOrCreateInitiativeGroup(initiativeSlug, initiativeName) {
  const groupName = `Initiative: ${initiativeName}`

  if (groupCache) {
    const cached = groupCache.find((g) => g.name === groupName)
    if (cached) return cached.id
  }

  const groupsResponse = await apiRequest('/groups?limit=100')
  groupCache = groupsResponse.data || []

  const existing = groupCache.find((g) => g.name === groupName)
  if (existing) return existing.id

  const newGroup = await apiRequest('/groups', {
    method: 'POST',
    body: JSON.stringify({ name: groupName }),
  })

  groupCache.push(newGroup.data)
  return newGroup.data.id
}

/**
 * Add or update a subscriber in MailerLite
 */
export async function upsertSubscriber({
  email,
  firstName,
  lastName,
  groupIds = [],
  fields = {},
}) {
  const subscriberData = {
    email: email.toLowerCase(),
    fields: {
      name: firstName || '',
      last_name: lastName || '',
      ...fields,
    },
    groups: groupIds.filter(Boolean),
  }

  try {
    const data = await apiRequest('/subscribers', {
      method: 'POST',
      body: JSON.stringify(subscriberData),
    })
    return { success: true, subscriber: data.data }
  } catch (error) {
    console.error('MailerLite upsert error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Add a member to MailerLite with chapter group
 */
export async function syncMemberToMailerLite(member) {
  const groupIds = []

  // Add to chapter group if they have a chapter
  if (member.chapter_name) {
    const chapterGroupId = await getOrCreateChapterGroup(member.chapter_name)
    if (chapterGroupId) groupIds.push(chapterGroupId)
  }

  // Create "All Members" group if needed
  const allMembersGroupId = await getOrCreateGroup('All Members')
  if (allMembersGroupId) groupIds.push(allMembersGroupId)

  return upsertSubscriber({
    email: member.email,
    firstName: member.first_name,
    lastName: member.last_name,
    groupIds,
    fields: {
      member_id: member.id,
      member_status: member.status || 'active',
      chapter: member.chapter_name || '',
    },
  })
}

/**
 * Add a mailing list signup to MailerLite
 */
export async function syncMailingListSignup({
  email,
  firstName,
  lastName,
  source,
  initiativeSlug,
  initiativeName,
}) {
  const groupIds = []

  // Add to general mailing list
  const mailingListGroupId = await getOrCreateMailingListGroup()
  if (mailingListGroupId) groupIds.push(mailingListGroupId)

  // Add to initiative group if from an initiative
  if (initiativeSlug && initiativeName) {
    const initiativeGroupId = await getOrCreateInitiativeGroup(initiativeSlug, initiativeName)
    if (initiativeGroupId) groupIds.push(initiativeGroupId)
  }

  return upsertSubscriber({
    email,
    firstName,
    lastName,
    groupIds,
    fields: {
      source: source || 'website',
    },
  })
}

/**
 * Generic get or create group helper
 */
export async function getOrCreateGroup(groupName) {
  if (groupCache) {
    const cached = groupCache.find((g) => g.name === groupName)
    if (cached) return cached.id
  }

  const groupsResponse = await apiRequest('/groups?limit=100')
  groupCache = groupsResponse.data || []

  const existing = groupCache.find((g) => g.name === groupName)
  if (existing) return existing.id

  const newGroup = await apiRequest('/groups', {
    method: 'POST',
    body: JSON.stringify({ name: groupName }),
  })

  groupCache.push(newGroup.data)
  return newGroup.data.id
}

/**
 * Get all groups (for admin UI)
 */
export async function getAllGroups() {
  const groupsResponse = await apiRequest('/groups?limit=100')
  groupCache = groupsResponse.data || []
  return groupCache
}

/**
 * Get subscribers in a group
 */
export async function getGroupSubscribers(groupId, { limit = 100, page = 1 } = {}) {
  const data = await apiRequest(`/groups/${groupId}/subscribers?limit=${limit}&page=${page}`)
  return data.data || []
}

/**
 * Send a campaign to a group
 */
export async function sendCampaignToGroup({
  groupId,
  subject,
  htmlContent,
  textContent,
  fromName,
  fromEmail,
}) {
  // Create campaign
  const campaign = await apiRequest('/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      name: `Campaign: ${subject}`,
      type: 'regular',
      emails: [
        {
          subject,
          from_name: fromName || 'Labor Party',
          from: fromEmail || process.env.MAILERLITE_FROM_EMAIL || 'noreply@votelabor.org',
          content: htmlContent,
        },
      ],
      groups: [groupId],
    }),
  })

  // Schedule to send immediately
  const scheduled = await apiRequest(`/campaigns/${campaign.data.id}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ delivery: 'instant' }),
  })

  return { success: true, campaign: scheduled.data }
}

/**
 * Send a campaign to multiple groups
 */
export async function sendCampaignToGroups({
  groupIds,
  subject,
  htmlContent,
  fromName,
}) {
  const campaign = await apiRequest('/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      name: `Campaign: ${subject}`,
      type: 'regular',
      emails: [
        {
          subject,
          from_name: fromName || 'Labor Party',
          from: process.env.MAILERLITE_FROM_EMAIL || 'noreply@votelabor.org',
          content: htmlContent,
        },
      ],
      groups: groupIds,
    }),
  })

  const scheduled = await apiRequest(`/campaigns/${campaign.data.id}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ delivery: 'instant' }),
  })

  return { success: true, campaign: scheduled.data }
}
