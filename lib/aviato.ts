import { AviatoSearchFilters, PersonSearchResult, EnrichedPerson, SearchResponse } from './types';

const AVIATO_API_URL = process.env.AVIATO_API_URL || 'https://data.api.aviato.co';
const AVIATO_API_KEY = process.env.AVIATO_API_KEY!;

interface AviatoApiOptions {
  method?: string;
  body?: object;
  params?: Record<string, string>;
}

async function aviatoFetch(endpoint: string, options: AviatoApiOptions = {}) {
  let url = `${AVIATO_API_URL}${endpoint}`;

  if (options.params) {
    const searchParams = new URLSearchParams(options.params);
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, {
    method: options.method || (options.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AVIATO_API_KEY}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Aviato API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Ensure URLs have https:// prefix
function normalizeUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

// Extract current role from Aviato experienceList
// Shape: [{ companyName, companyID, positionList: [{ title, startDate, endDate }], ... }]
interface AviatoPosition {
  title?: string;
  startDate?: string;
  endDate?: string;
  department?: string;
}

interface AviatoExperience {
  companyName?: string;
  companyID?: string;
  positionList?: AviatoPosition[];
  startDate?: string;
  endDate?: string;
}

function getCurrentRole(experienceList?: AviatoExperience[]): { title: string; companyName: string; companyId: string } | null {
  if (!experienceList || experienceList.length === 0) return null;

  // Find experience with no endDate (current) or most recent
  const current = experienceList.find(e => !e.endDate) || experienceList[0];
  const position = current.positionList?.find(p => !p.endDate) || current.positionList?.[0];

  return {
    title: position?.title || '',
    companyName: current.companyName || '',
    companyId: current.companyID || '',
  };
}

export async function searchPeople(
  filters: AviatoSearchFilters,
  page: number = 1,
  pageSize: number = 10
): Promise<SearchResponse> {
  // Build query params for simple search endpoint
  const params: Record<string, string> = {
    page: String(page),
    perPage: String(pageSize),
  };

  if (filters.headline) {
    params.headline = filters.headline;
  }
  if (filters.country) {
    params.country = filters.country;
  }
  if (filters.companyName) {
    params.currentCompanyNames = filters.companyName;
  }
  if (filters.skills) {
    params.skills = filters.skills;
  }
  if (filters.linkedinConnections) {
    params.minLinkedinConnections = String(filters.linkedinConnections);
  }

  try {
    // Step 1: Search to get matching person IDs
    const data = await aviatoFetch('/person/simple/search', {
      method: 'GET',
      params,
    });

    interface SearchItem {
      id: string;
      fullName?: string;
      location?: string;
      URLs?: { linkedin?: string };
    }

    const items: SearchItem[] = data.items || [];

    if (items.length === 0) {
      return { results: [], total_count: 0, page, page_size: pageSize, has_more: false };
    }

    // Step 2: Enrich all results in parallel to get headline/title/company
    const enrichedItems = await Promise.allSettled(
      items.map(item =>
        aviatoFetch('/person/enrich', {
          method: 'GET',
          params: { id: item.id },
        })
      )
    );

    interface EnrichedItem {
      id: string;
      fullName?: string;
      firstName?: string;
      lastName?: string;
      headline?: string;
      location?: string;
      linkedinID?: string;
      URLs?: { linkedin?: string };
      experienceList?: AviatoExperience[];
    }

    const results: PersonSearchResult[] = items.map((item, index) => {
      // Use enriched data if available, fall back to search data
      let enriched: EnrichedItem | null = null;
      const enrichResult = enrichedItems[index];
      if (enrichResult.status === 'fulfilled') {
        enriched = enrichResult.value;
      }

      const role = getCurrentRole(enriched?.experienceList);
      const linkedinUrl = normalizeUrl(enriched?.URLs?.linkedin || item.URLs?.linkedin || '');

      return {
        person: {
          id: `aviato-${item.id}-${page}-${index}`,
          forager_person_id: String(item.id),
          full_name: enriched?.fullName || item.fullName || '',
          first_name: enriched?.firstName || '',
          last_name: enriched?.lastName || '',
          photo: '',
          headline: enriched?.headline || '',
          linkedin_url: linkedinUrl,
          source: 'aviato' as const,
        },
        role: {
          title: role?.title || enriched?.headline || '',
          company_name: role?.companyName || '',
          company_id: role?.companyId || '',
          is_current: true,
        },
      };
    });

    const totalCount = data.totalResults ?? (parseInt(data.count?.value, 10) || results.length);

    return {
      results,
      total_count: totalCount,
      page,
      page_size: pageSize,
      has_more: results.length === pageSize,
    };
  } catch (error) {
    console.error('Error searching Aviato people:', error);
    throw error;
  }
}

async function lookupPhoneNumbers(personId: string): Promise<{ phone_number: string; score?: number }[]> {
  try {
    const data = await aviatoFetch('/person/phone', {
      method: 'GET',
      params: { id: personId },
    });

    // Response: { phones: [{ phoneNumber, score }] }
    const phones = data.phones || [];
    if (Array.isArray(phones)) {
      return phones.map((p: { phoneNumber?: string; score?: number }) => ({
        phone_number: p.phoneNumber || '',
        score: p.score,
      })).filter(p => p.phone_number);
    }

    return [];
  } catch (error) {
    console.error('Error looking up Aviato phone numbers:', error);
    return [];
  }
}

async function lookupEmails(personId: string): Promise<{ email: string; type?: string }[]> {
  try {
    const data = await aviatoFetch('/person/email', {
      method: 'GET',
      params: { id: personId },
    });

    // Response: { emails: [{ email, type, companyID? }] }
    const emails = data.emails || [];
    if (Array.isArray(emails)) {
      return emails.map((e: { email?: string; type?: string }) => ({
        email: e.email || '',
        type: e.type,
      })).filter(e => e.email);
    }

    return [];
  } catch (error) {
    console.error('Error looking up Aviato emails:', error);
    return [];
  }
}

export async function enrichPerson(personId: string): Promise<EnrichedPerson | null> {
  try {
    const [person, phoneNumbers, emails] = await Promise.all([
      aviatoFetch('/person/enrich', {
        method: 'GET',
        params: { id: personId },
      }),
      lookupPhoneNumbers(personId),
      lookupEmails(personId),
    ]);

    if (!person) return null;

    const role = getCurrentRole(person.experienceList);

    const workEmails = emails.filter(e => e.type === 'work').map(e => e.email);
    const personalEmails = emails.filter(e => e.type === 'personal').map(e => e.email);

    return {
      id: String(person.id || personId),
      full_name: person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim(),
      first_name: person.firstName || '',
      last_name: person.lastName || '',
      photo: '',
      headline: person.headline || '',
      linkedin_url: normalizeUrl(person.URLs?.linkedin || ''),
      work_emails: workEmails.length > 0 ? workEmails : emails.map(e => e.email),
      personal_emails: personalEmails,
      phone_numbers: phoneNumbers.map(p => ({ phone_number: p.phone_number })),
      skills: person.skills || [],
      location: person.location || '',
      summary: person.about || person.headline || '',
      current_role: role ? {
        title: role.title,
        company_name: role.companyName,
        company_id: role.companyId,
        is_current: true,
      } : undefined,
      source: 'aviato',
    };
  } catch (error) {
    console.error('Error enriching Aviato person:', error);
    throw error;
  }
}

export async function enrichMultiplePeople(personIds: string[]): Promise<EnrichedPerson[]> {
  const enrichedPeople: EnrichedPerson[] = [];

  const validIds = personIds.filter(id => id && id !== '' && id !== 'undefined');

  if (validIds.length === 0) {
    return [];
  }

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
