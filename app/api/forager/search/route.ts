import { NextRequest, NextResponse } from 'next/server';
import { searchPeople } from '@/lib/forager';
import { SearchFilters } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filters, page = 1, pageSize = 10 } = body as {
      filters: SearchFilters;
      page?: number;
      pageSize?: number;
    };

    const results = await searchPeople(filters, page, pageSize);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
