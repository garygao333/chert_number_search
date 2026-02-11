'use client';

import { useState, useCallback, useRef } from 'react';
import SearchFilters from '@/components/SearchFilters';
import PersonList from '@/components/PersonList';
import LeadList from '@/components/LeadList';
import {
  SearchFilters as SearchFiltersType,
  AviatoSearchFilters,
  DataSource,
  PersonSearchResult,
  Lead,
  EnrichedPerson,
  ContactRecord,
  CompanyMatch,
} from '@/lib/types';

export default function Home() {
  // Source state
  const [activeSource, setActiveSource] = useState<DataSource>('forager');

  // Forager search state
  const [filters, setFilters] = useState<SearchFiltersType>({});

  // Aviato search state
  const [aviatoFilters, setAviatoFilters] = useState<AviatoSearchFilters>({});

  // Search results state
  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Cache for pagination (back button)
  const pageCache = useRef<Map<string, Map<number, PersonSearchResult[]>>>(new Map());
  const lastFiltersKey = useRef<string>('');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Lead list state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Company matches from industry search (for terminal display)
  const [companyMatches, setCompanyMatches] = useState<CompanyMatch[]>([]);

  // Get cache key from filters
  const getFiltersKey = (source: DataSource, f: SearchFiltersType | AviatoSearchFilters): string => {
    return `${source}:${JSON.stringify(f)}`;
  };

  // Handle source change — clear results/selection but keep leads
  const handleSourceChange = (source: DataSource) => {
    if (source === activeSource) return;
    setActiveSource(source);
    setResults([]);
    setSelectedIds(new Set());
    setCurrentPage(1);
    setTotalCount(0);
    setHasMore(false);
  };

  // Search function
  const performSearch = useCallback(async (page: number, isNewSearch: boolean = false) => {
    const currentFilters = activeSource === 'forager' ? filters : aviatoFilters;
    const filtersKey = getFiltersKey(activeSource, currentFilters);

    // Check cache first (for back navigation)
    if (!isNewSearch && pageCache.current.has(filtersKey)) {
      const filterCache = pageCache.current.get(filtersKey)!;
      if (filterCache.has(page)) {
        setResults(filterCache.get(page)!);
        setCurrentPage(page);
        return;
      }
    }

    setIsSearching(true);

    try {
      const apiUrl = activeSource === 'forager' ? '/api/forager/search' : '/api/aviato/search';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: currentFilters, page, pageSize: 10 }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();

      // Initialize cache for new search
      if (isNewSearch || filtersKey !== lastFiltersKey.current) {
        pageCache.current.set(filtersKey, new Map());
        lastFiltersKey.current = filtersKey;
        setSelectedIds(new Set());
      }

      // Cache the results
      const filterCache = pageCache.current.get(filtersKey)!;
      filterCache.set(page, data.results);

      setResults(data.results);
      setCurrentPage(page);
      setTotalCount(data.total_count);
      setHasMore(data.has_more);

      // Capture company matches from Aviato industry search
      if (data.companyMatches) {
        setCompanyMatches(data.companyMatches);
      } else {
        setCompanyMatches([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [activeSource, filters, aviatoFilters]);

  // Handle search button click
  const handleSearch = () => {
    setCurrentPage(1);
    performSearch(1, true);
  };

  // Handle pagination
  const handleNextPage = () => {
    performSearch(currentPage + 1, false);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      performSearch(currentPage - 1, false);
    }
  };

  // Check if previous page is cached
  const hasPreviousPage = currentPage > 1;

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(results.map((r) => r.person.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Confirm selection - enrich and add to lead list
  const handleConfirmSelection = async () => {
    if (selectedIds.size === 0) return;

    setIsEnriching(true);

    try {
      // Get selected results and group by source
      const selectedResults = results.filter(r => selectedIds.has(r.person.id));

      const foragerResults = selectedResults.filter(r => r.person.source === 'forager');
      const aviatoResults = selectedResults.filter(r => r.person.source === 'aviato');

      // Enrich from each source in parallel
      const enrichPromises: Promise<EnrichedPerson[]>[] = [];

      if (foragerResults.length > 0) {
        const foragerPersonIds = [...new Set(foragerResults.map(r => r.person.forager_person_id))];
        enrichPromises.push(
          fetch('/api/forager/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personIds: foragerPersonIds }),
          }).then(res => {
            if (!res.ok) throw new Error('Forager enrichment failed');
            return res.json();
          }).then(data => data.enrichedPeople as EnrichedPerson[])
        );
      }

      if (aviatoResults.length > 0) {
        const aviatoPersonIds = [...new Set(aviatoResults.map(r => r.person.forager_person_id))];
        enrichPromises.push(
          fetch('/api/aviato/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personIds: aviatoPersonIds }),
          }).then(res => {
            if (!res.ok) throw new Error('Aviato enrichment failed');
            return res.json();
          }).then(data => data.enrichedPeople as EnrichedPerson[])
        );
      }

      const enrichedArrays = await Promise.all(enrichPromises);
      const enrichedPeople = enrichedArrays.flat();

      // Get the original results for role information (map by forager_person_id)
      const resultMap = new Map<string, PersonSearchResult>();
      selectedResults.forEach((r) => resultMap.set(r.person.forager_person_id, r));

      // Convert enriched people to leads
      const newLeads: Lead[] = enrichedPeople
        .filter((p) => p.phone_numbers && p.phone_numbers.length > 0)
        .map((p) => {
          const originalResult = resultMap.get(p.id);
          return {
            id: p.id,
            full_name: p.full_name,
            role_title: originalResult?.role.title || p.current_role?.title || '',
            company_name: originalResult?.role.company_name || p.current_role?.company_name || '',
            phone_number: p.phone_numbers![0].phone_number,
            email: p.work_emails?.[0] || p.personal_emails?.[0] || '',
            linkedin_url: p.linkedin_url,
            location: p.location,
            headline: p.headline,
            added_at: new Date().toISOString(),
            source: p.source,
          };
        });

      if (newLeads.length === 0) {
        alert('No phone numbers found for the selected profiles.');
        return;
      }

      // Add to leads (avoid duplicates)
      setLeads((prev) => {
        const existingIds = new Set(prev.map((l) => l.id));
        const uniqueNewLeads = newLeads.filter((l) => !existingIds.has(l.id));
        return [...prev, ...uniqueNewLeads];
      });

      // Save to Supabase
      const currentFilters = activeSource === 'forager' ? filters : aviatoFilters;
      const searchQuery = Object.entries(currentFilters)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ');

      const contacts: ContactRecord[] = newLeads.map((lead) => ({
        phone_number: lead.phone_number,
        full_name: lead.full_name,
        role: lead.role_title,
        company: lead.company_name,
        headline: lead.headline,
        location: lead.location,
        linkedin_url: lead.linkedin_url,
        source: lead.source,
        source_id: lead.id,
        raw_data: {
          email: lead.email,
          search_query: searchQuery,
          added_at: lead.added_at,
        },
      }));

      await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts }),
      });

      // Clear selection
      setSelectedIds(new Set());

      alert(`Added ${newLeads.length} leads with phone numbers to the list.`);
    } catch (error) {
      console.error('Enrichment error:', error);
      alert('Failed to enrich profiles. Please try again.');
    } finally {
      setIsEnriching(false);
    }
  };

  // Lead list handlers
  const removeLead = (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  const clearLeads = () => {
    if (confirm('Are you sure you want to clear all leads?')) {
      setLeads([]);
    }
  };

  // Export to CSV
  const exportCSV = () => {
    if (leads.length === 0) return;

    setIsExporting(true);

    try {
      // CSV headers
      const headers = ['Name', 'Source', 'Role', 'Company', 'Phone', 'Email', 'LinkedIn', 'Location', 'Headline', 'Added At'];

      // CSV rows
      const rows = leads.map((lead) => [
        lead.full_name,
        lead.source === 'aviato' ? 'Aviato' : 'Forager',
        lead.role_title,
        lead.company_name,
        lead.phone_number,
        lead.email || '',
        lead.linkedin_url || '',
        lead.location || '',
        lead.headline || '',
        lead.added_at,
      ]);

      // Escape CSV values
      const escapeCSV = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      // Build CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map(escapeCSV).join(',')),
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Chert Number Search</h1>
          <p className="text-sm text-gray-500">Search and enrich contacts with phone numbers</p>
        </div>

        {/* Confirm Selection Button */}
        <button
          onClick={handleConfirmSelection}
          disabled={selectedIds.size === 0 || isEnriching}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isEnriching ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Enriching...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Confirm Selection ({selectedIds.size})
            </>
          )}
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <SearchFilters
          filters={filters}
          onFiltersChange={setFilters}
          onSearch={handleSearch}
          isLoading={isSearching}
          activeSource={activeSource}
          onSourceChange={handleSourceChange}
          aviatoFilters={aviatoFilters}
          onAviatoFiltersChange={setAviatoFilters}
          companyMatches={companyMatches}
        />

        {/* Results */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <PersonList
            results={results}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            currentPage={currentPage}
            hasMore={hasMore}
            hasPrevious={hasPreviousPage}
            onNextPage={handleNextPage}
            onPreviousPage={handlePreviousPage}
            isLoading={isSearching}
            totalCount={totalCount}
          />

          {/* Lead List */}
          <LeadList
            leads={leads}
            onRemoveLead={removeLead}
            onClearLeads={clearLeads}
            onExportCSV={exportCSV}
            isExporting={isExporting}
          />
        </div>
      </div>
    </div>
  );
}
