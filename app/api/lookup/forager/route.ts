import { NextRequest, NextResponse } from 'next/server';
import { LookupResponse } from '@/lib/lookup-types';

const FORAGER_API_URL = process.env.FORAGER_API_URL || 'https://api-v2.forager.ai';
const FORAGER_API_KEY = process.env.FORAGER_API_KEY!;
const FORAGER_ACCOUNT_ID = process.env.FORAGER_ACCOUNT_ID!;

function sanitizeSearchString(str: string): string {
  return str
    .replace(/[&|!(){}[\]^"~*?:\\]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

async function foragerFetch(endpoint: string, body: object) {
  const url = `${FORAGER_API_URL}/api/${FORAGER_ACCOUNT_ID}/datastorage${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': FORAGER_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Forager API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Basic fuzzy check: do first and last name parts appear in the result name?
function isReasonableMatch(searchName: string, resultName: string): boolean {
  const searchParts = searchName.toLowerCase().split(/\s+/);
  const resultLower = resultName.toLowerCase();

  // At least first and last name should appear
  if (searchParts.length < 2) return resultLower.includes(searchParts[0]);

  const firstName = searchParts[0];
  const lastName = searchParts[searchParts.length - 1];

  return resultLower.includes(firstName) && resultLower.includes(lastName);
}

async function searchByName(fullName: string): Promise<LookupResponse['results'][0]> {
  try {
    const sanitized = sanitizeSearchString(fullName);

    // Step 1: Search by headline (best-effort for name search)
    const data = await foragerFetch('/person_role_search/', {
      person_headline: sanitized,
      page: 1,
    });

    interface ForagerPerson {
      id: number;
      full_name: string;
    }

    interface ForagerResult {
      person: ForagerPerson;
    }

    const results: ForagerResult[] = data.search_results || [];

    if (results.length === 0) {
      return { fullName, phoneNumbers: [], status: 'not_found' };
    }

    // Find best match by name
    const match = results.find(r => isReasonableMatch(fullName, r.person.full_name));

    if (!match) {
      return { fullName, phoneNumbers: [], status: 'not_found' };
    }

    const personId = match.person.id;

    // Step 2: Enrich to get phone numbers
    const [personData, phoneResults] = await Promise.all([
      foragerFetch('/person_detail_lookup/', { person_id: personId }),
      foragerFetch('/person_contacts_lookup/phone_numbers/', { person_id: personId }).catch(() => []),
    ]);

    const phoneNumbers: string[] = Array.isArray(phoneResults)
      ? phoneResults
          .map((p: { phone_number?: string; number?: string }) => p.phone_number || p.number || '')
          .filter(Boolean)
      : [];

    const email = personData?.work_emails?.[0] || personData?.personal_emails?.[0] || '';

    return {
      fullName,
      matchedName: match.person.full_name,
      personId: String(personId),
      phoneNumbers,
      email: email || undefined,
      status: phoneNumbers.length > 0 ? 'found' : 'not_found',
    };
  } catch (error) {
    console.error(`Error looking up "${fullName}" via Forager:`, error);
    return { fullName, phoneNumbers: [], status: 'error' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { names } = await request.json() as { names: string[] };

    if (!names || !Array.isArray(names) || names.length === 0) {
      return NextResponse.json({ error: 'names array is required' }, { status: 400 });
    }

    // Process with concurrency of 3
    const results: LookupResponse['results'] = [];
    const concurrency = 3;

    for (let i = 0; i < names.length; i += concurrency) {
      const batch = names.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(batch.map(name => searchByName(name)));

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            fullName: batch[results.length - (i > 0 ? i : 0)] || 'Unknown',
            phoneNumbers: [],
            status: 'error',
          });
        }
      }
    }

    return NextResponse.json({ results } as LookupResponse);
  } catch (error) {
    console.error('Forager lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
