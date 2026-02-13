import { NextRequest, NextResponse } from 'next/server';
import { enrichPerson } from '@/lib/aviato';
import { LookupResponse } from '@/lib/lookup-types';

const AVIATO_API_URL = process.env.AVIATO_API_URL || 'https://data.api.aviato.co';
const AVIATO_API_KEY = process.env.AVIATO_API_KEY!;

async function searchByName(fullName: string): Promise<LookupResponse['results'][0]> {
  try {
    // Step 1: Search by fullName
    const params = new URLSearchParams({
      fullName,
      page: '1',
      perPage: '1',
    });

    const searchResponse = await fetch(`${AVIATO_API_URL}/person/simple/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AVIATO_API_KEY}`,
      },
    });

    if (!searchResponse.ok) {
      console.error(`Aviato search failed for "${fullName}": ${searchResponse.status}`);
      return { fullName, phoneNumbers: [], status: 'error' };
    }

    const data = await searchResponse.json();
    const items = data.items || [];

    if (items.length === 0) {
      return { fullName, phoneNumbers: [], status: 'not_found' };
    }

    const person = items[0];
    const personId = String(person.id);

    // Step 2: Enrich to get phone/email
    const enriched = await enrichPerson(personId);

    if (!enriched) {
      return { fullName, matchedName: person.fullName, personId, phoneNumbers: [], status: 'not_found' };
    }

    const phoneNumbers = (enriched.phone_numbers || []).map(p => p.phone_number).filter(Boolean);
    const email = enriched.work_emails?.[0] || enriched.personal_emails?.[0] || '';

    return {
      fullName,
      matchedName: enriched.full_name || person.fullName,
      personId,
      phoneNumbers,
      email: email || undefined,
      status: phoneNumbers.length > 0 ? 'found' : 'not_found',
    };
  } catch (error) {
    console.error(`Error looking up "${fullName}" via Aviato:`, error);
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
    console.error('Aviato lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
