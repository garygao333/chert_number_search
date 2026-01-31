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

export async function searchPeople(
  filters: SearchFilters,
  page: number = 1,
  pageSize: number = 10
): Promise<SearchResponse> {
  // Build search query based on filters
  const searchParams: Record<string, unknown> = {
    role_is_current: true,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };

  // Person filters
  if (filters.personIndustry) {
    searchParams.person_industries = [filters.personIndustry];
  }
  if (filters.personLocation) {
    searchParams.person_locations = [filters.personLocation];
  }

  // Company/Organization filters
  if (filters.companyIndustry) {
    searchParams.org_industries = [filters.companyIndustry];
  }
  if (filters.companyLocation) {
    searchParams.org_locations = [filters.companyLocation];
  }
  if (filters.companyKeywords) {
    searchParams.org_name = filters.companyKeywords;
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

    const results: PersonSearchResult[] = (data.search_results || []).map((item: ApiResult) => ({
      person: {
        id: String(item.person?.id || item.id || ''),
        full_name: item.person?.full_name || '',
        first_name: item.person?.first_name || '',
        last_name: item.person?.last_name || '',
        photo: item.person?.photo || '',
        headline: item.person?.headline || '',
        linkedin_url: item.person?.linkedin_info?.public_profile_url || '',
      },
      role: {
        title: item.title || '',
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

export async function enrichPerson(personId: string): Promise<EnrichedPerson | null> {
  try {
    const data = await foragerFetch('/person_detail_lookup/', {
      body: {
        person_id: personId,
        reveal_phone_numbers: true,
        do_contacts_enrichment: true,
      },
    });

    if (!data) return null;

    return {
      id: data.id || personId,
      full_name: data.full_name || '',
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      photo: data.photo || '',
      headline: data.headline || '',
      linkedin_url: data.linkedin_url || data.linkedin_info?.public_profile_url || '',
      work_emails: data.work_emails || [],
      personal_emails: data.personal_emails || [],
      phone_numbers: data.phone_numbers || [],
      skills: data.skills || [],
      location: data.location || '',
      summary: data.summary || '',
      current_role: data.current_role || null,
    };
  } catch (error) {
    console.error('Error enriching person:', error);
    throw error;
  }
}

export async function enrichMultiplePeople(personIds: string[]): Promise<EnrichedPerson[]> {
  const enrichedPeople: EnrichedPerson[] = [];

  // Process in parallel with a concurrency limit
  const batchSize = 5;
  for (let i = 0; i < personIds.length; i += batchSize) {
    const batch = personIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(id => enrichPerson(id)));

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        enrichedPeople.push(result.value);
      }
    }
  }

  return enrichedPeople;
}
