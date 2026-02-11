import { SearchFilters, PersonSearchResult, EnrichedPerson, SearchResponse } from './types';

const FORAGER_API_URL = process.env.FORAGER_API_URL || 'https://api-v2.forager.ai';
const FORAGER_API_KEY = process.env.FORAGER_API_KEY!;
const FORAGER_ACCOUNT_ID = process.env.FORAGER_ACCOUNT_ID!;

interface ForagerApiOptions {
  method?: string;
  body?: object;
}

async function foragerFetch(endpoint: string, options: ForagerApiOptions = {}) {
  // Build the full URL with account ID: /api/{account_id}/datastorage/{endpoint}
  const url = `${FORAGER_API_URL}/api/${FORAGER_ACCOUNT_ID}/datastorage${endpoint}`;

  const response = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': FORAGER_API_KEY,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Forager API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Sanitize search string - remove special characters and convert spaces to underscores
function sanitizeSearchString(str: string): string {
  return str
    .replace(/[&|!(){}[\]^"~*?:\\]/g, '') // Remove special chars
    .replace(/\s+/g, '_') // Convert spaces to underscores
    .trim();
}

export async function searchPeople(
  filters: SearchFilters,
  page: number = 1,
  pageSize: number = 10
): Promise<SearchResponse> {
  // Build search query based on filters
  const searchParams: Record<string, unknown> = {
    role_is_current: true,
    page: page,
  };

  // Person filters - use text-based search via headline/description
  if (filters.personIndustry) {
    // Search in person headline for industry keywords
    searchParams.person_headline = sanitizeSearchString(filters.personIndustry);
  }
  if (filters.personLocation) {
    searchParams.person_locations = [filters.personLocation];
  }

  // Company/Organization filters - use description for industry keywords
  if (filters.companyIndustry) {
    // Search in organization description for industry keywords
    searchParams.organization_description = sanitizeSearchString(filters.companyIndustry);
  }
  if (filters.companyLocation) {
    searchParams.org_locations = [filters.companyLocation];
  }
  if (filters.companyKeywords) {
    // Search in role title for keywords (more effective than org_name)
    searchParams.role_title = sanitizeSearchString(filters.companyKeywords);
  }

  try {
    const data = await foragerFetch('/person_role_search/', {
      body: searchParams,
    });

    // Transform API response to our format
    // Response structure: { search_results: [{ id, title, organization: {...}, person: {...} }], total_search_results }
    interface ApiPerson {
      id: number;
      full_name: string;
      first_name: string;
      last_name: string;
      photo?: string;
      headline?: string;
      linkedin_info?: {
        public_profile_url?: string;
      };
    }

    interface ApiOrganization {
      id: number;
      name: string;
    }

    interface ApiResult {
      id: number;
      title?: string;
      person: ApiPerson;
      organization?: ApiOrganization;
    }

    // Log raw search results to debug person IDs
    console.log('Raw search results sample:', JSON.stringify(data.search_results?.slice(0, 2), null, 2));

    // Use combination of role ID + person ID + index for uniqueness
    const results: PersonSearchResult[] = (data.search_results || []).map((item: ApiResult, index: number) => ({
      person: {
        id: `${item.id}-${item.person?.id}-${page}-${index}`,  // Unique key combining multiple fields
        forager_person_id: String(item.person?.id || ''),  // Actual person ID for API calls
        full_name: item.person?.full_name || '',
        first_name: item.person?.first_name || '',
        last_name: item.person?.last_name || '',
        photo: item.person?.photo || '',
        headline: item.person?.headline || '',
        linkedin_url: item.person?.linkedin_info?.public_profile_url || '',
        source: 'forager',
      },
      role: {
        title: item.title || item.person?.headline || '',
        company_name: item.organization?.name || '',
        company_id: String(item.organization?.id || ''),
        is_current: true,
      },
    }));

    return {
      results,
      total_count: data.total_search_results || results.length,
      page,
      page_size: pageSize,
      has_more: results.length === pageSize,
    };
  } catch (error) {
    console.error('Error searching people:', error);
    throw error;
  }
}

// Separate function to lookup phone numbers via the contacts endpoint
async function lookupPhoneNumbers(personId: number): Promise<{ phone_number: string; type?: string }[]> {
  try {
    console.log('Looking up phone numbers for person:', personId);
    const results = await foragerFetch('/person_contacts_lookup/phone_numbers/', {
      body: { person_id: personId },
    });

    console.log('Phone lookup response:', JSON.stringify(results, null, 2));

    // Handle different response formats
    if (Array.isArray(results)) {
      return results.map((p: { phone_number?: string; number?: string; type?: string }) => ({
        phone_number: p.phone_number || p.number || '',
        type: p.type,
      })).filter(p => p.phone_number);
    }

    return [];
  } catch (error) {
    console.error('Error looking up phone numbers:', error);
    return [];
  }
}

export async function enrichPerson(personId: string): Promise<EnrichedPerson | null> {
  try {
    // Convert to number since API expects integer person_id
    const numericPersonId = parseInt(personId, 10);
    console.log('Enriching person:', personId, '-> numeric:', numericPersonId);

    // Get person details and phone numbers in parallel
    const [personData, phoneNumbers] = await Promise.all([
      foragerFetch('/person_detail_lookup/', {
        body: { person_id: numericPersonId },
      }),
      lookupPhoneNumbers(numericPersonId),
    ]);

    console.log('Person data for', personId, ':', personData?.full_name);
    console.log('Phone numbers found:', phoneNumbers);

    if (!personData) return null;

    return {
      id: String(personData.id || personId),  // Ensure ID is string for consistent mapping
      full_name: personData.full_name || '',
      first_name: personData.first_name || '',
      last_name: personData.last_name || '',
      photo: personData.photo || '',
      headline: personData.headline || '',
      linkedin_url: personData.linkedin_url || personData.linkedin_info?.public_profile_url || '',
      work_emails: personData.work_emails || [],
      personal_emails: personData.personal_emails || [],
      phone_numbers: phoneNumbers,
      skills: personData.skills || [],
      location: personData.location?.name || '',
      summary: personData.summary || personData.description || '',
      current_role: personData.current_role || null,
      source: 'forager',
    };
  } catch (error) {
    console.error('Error enriching person:', error);
    throw error;
  }
}

export async function enrichMultiplePeople(personIds: string[]): Promise<EnrichedPerson[]> {
  const enrichedPeople: EnrichedPerson[] = [];

  // Filter out empty or invalid IDs
  const validIds = personIds.filter(id => id && id !== '' && id !== 'undefined' && !isNaN(parseInt(id, 10)));
  console.log('Valid person IDs to enrich:', validIds);

  if (validIds.length === 0) {
    console.log('No valid person IDs to enrich');
    return [];
  }

  // Process in parallel with a concurrency limit
  const batchSize = 5;
  for (let i = 0; i < validIds.length; i += batchSize) {
    const batch = validIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(id => enrichPerson(id)));

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        enrichedPeople.push(result.value);
      }
    }
  }

  return enrichedPeople;
}
