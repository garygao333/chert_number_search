import { NextRequest, NextResponse } from 'next/server';
import { searchPeople, searchCompaniesByIndustry } from '@/lib/aviato';
import { AviatoSearchFilters, CompanyMatch } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filters, page = 1, pageSize = 10 } = body as {
      filters: AviatoSearchFilters;
      page?: number;
      pageSize?: number;
    };

    let companyMatches: CompanyMatch[] = [];

    // If companyIndustry is set, do 2-step search:
    // 1. Search companies by industry → get LinkedIn slugs
    // 2. Search people at those companies
    const filtersForPeople = { ...filters };
    if (filters.companyIndustry) {
      companyMatches = await searchCompaniesByIndustry(filters.companyIndustry);

      if (companyMatches.length > 0) {
        // Pass company LinkedIn slugs as a comma-separated companyLinkedinIds
        filtersForPeople._companyLinkedinIds = companyMatches.map(c => c.linkedinSlug);
      }

      // Remove companyIndustry so it doesn't get passed as a query param
      delete filtersForPeople.companyIndustry;
    }

    const results = await searchPeople(filtersForPeople, page, pageSize);
    return NextResponse.json({ ...results, companyMatches });
  } catch (error) {
    console.error('Aviato Search API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
