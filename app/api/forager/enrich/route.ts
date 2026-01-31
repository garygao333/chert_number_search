import { NextRequest, NextResponse } from 'next/server';
import { enrichMultiplePeople } from '@/lib/forager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personIds } = body as { personIds: string[] };

    if (!personIds || !Array.isArray(personIds) || personIds.length === 0) {
      return NextResponse.json(
        { error: 'personIds array is required' },
        { status: 400 }
      );
    }

    console.log('Enrich API called with personIds:', personIds);
    const enrichedPeople = await enrichMultiplePeople(personIds);
    console.log('Enriched people count:', enrichedPeople.length);
    console.log('People with phones:', enrichedPeople.filter(p => p.phone_numbers?.length > 0).length);

    // Filter to only include people with phone numbers
    const peopleWithPhones = enrichedPeople.filter(
      person => person.phone_numbers && person.phone_numbers.length > 0
    );

    return NextResponse.json({
      enrichedPeople: peopleWithPhones,
      totalRequested: personIds.length,
      totalWithPhones: peopleWithPhones.length,
    });
  } catch (error) {
    console.error('Enrich API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Enrichment failed' },
      { status: 500 }
    );
  }
}
