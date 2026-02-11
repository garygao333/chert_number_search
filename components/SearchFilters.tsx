'use client';

import { SearchFilters as SearchFiltersType, AviatoSearchFilters, DataSource } from '@/lib/types';

interface SearchFiltersProps {
  filters: SearchFiltersType;
  onFiltersChange: (filters: SearchFiltersType) => void;
  onSearch: () => void;
  isLoading: boolean;
  activeSource: DataSource;
  onSourceChange: (source: DataSource) => void;
  aviatoFilters: AviatoSearchFilters;
  onAviatoFiltersChange: (filters: AviatoSearchFilters) => void;
}

export default function SearchFilters({
  filters,
  onFiltersChange,
  onSearch,
  isLoading,
  activeSource,
  onSourceChange,
  aviatoFilters = {},
  onAviatoFiltersChange,
}: SearchFiltersProps) {
  const handleForagerInputChange = (field: keyof SearchFiltersType, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value || undefined,
    });
  };

  const handleAviatoInputChange = (field: keyof AviatoSearchFilters, value: string | number) => {
    onAviatoFiltersChange({
      ...aviatoFilters,
      [field]: value || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      onSearch();
    }
  };

  const handleClear = () => {
    if (activeSource === 'forager') {
      onFiltersChange({});
    } else {
      onAviatoFiltersChange({});
    }
  };

  return (
    <div className="w-72 bg-white border-r border-gray-200 p-4 flex flex-col h-full">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Filters</h2>

      {/* Source Toggle */}
      <div className="mb-4 flex rounded-lg overflow-hidden border border-gray-300">
        <button
          onClick={() => onSourceChange('forager')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeSource === 'forager'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Forager
        </button>
        <button
          onClick={() => onSourceChange('aviato')}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeSource === 'aviato'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Aviato
        </button>
      </div>

      {activeSource === 'forager' ? (
        <>
          {/* Person Filters */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Person
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Headline Keywords</label>
                <input
                  type="text"
                  placeholder="e.g., Recruiter, Sales"
                  value={filters.personIndustry || ''}
                  onChange={(e) => handleForagerInputChange('personIndustry', e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Location</label>
                <input
                  type="text"
                  placeholder="e.g., San Francisco, CA"
                  value={filters.personLocation || ''}
                  onChange={(e) => handleForagerInputChange('personLocation', e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Company Filters */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Company
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description Keywords</label>
                <input
                  type="text"
                  placeholder="e.g., Staffing, Recruiting"
                  value={filters.companyIndustry || ''}
                  onChange={(e) => handleForagerInputChange('companyIndustry', e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Location</label>
                <input
                  type="text"
                  placeholder="e.g., New York, NY"
                  value={filters.companyLocation || ''}
                  onChange={(e) => handleForagerInputChange('companyLocation', e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Role Title Keywords</label>
                <input
                  type="text"
                  placeholder="e.g., Technical, Manager"
                  value={filters.companyKeywords || ''}
                  onChange={(e) => handleForagerInputChange('companyKeywords', e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Aviato Filters */
        <div className="mb-6 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Headline Keywords</label>
            <input
              type="text"
              placeholder="e.g., Engineer, Designer"
              value={aviatoFilters.headline || ''}
              onChange={(e) => handleAviatoInputChange('headline', e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Country</label>
            <input
              type="text"
              placeholder="e.g., United States"
              value={aviatoFilters.country || ''}
              onChange={(e) => handleAviatoInputChange('country', e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Company Name</label>
            <input
              type="text"
              placeholder="e.g., Google, Meta"
              value={aviatoFilters.companyName || ''}
              onChange={(e) => handleAviatoInputChange('companyName', e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Skills</label>
            <input
              type="text"
              placeholder="e.g., Python, React"
              value={aviatoFilters.skills || ''}
              onChange={(e) => handleAviatoInputChange('skills', e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Role Description Keywords</label>
            <input
              type="text"
              placeholder="e.g., recruiting agency, staffing"
              value={aviatoFilters.experienceDescription || ''}
              onChange={(e) => handleAviatoInputChange('experienceDescription', e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Min LinkedIn Connections</label>
            <input
              type="number"
              placeholder="e.g., 500"
              value={aviatoFilters.linkedinConnections || ''}
              onChange={(e) => handleAviatoInputChange('linkedinConnections', e.target.value ? parseInt(e.target.value, 10) : '')}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-auto space-y-2">
        <button
          onClick={onSearch}
          disabled={isLoading}
          className={`w-full px-4 py-2 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
            activeSource === 'aviato'
              ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Searching...
            </span>
          ) : (
            'Search'
          )}
        </button>

        <button
          onClick={handleClear}
          className="w-full px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}
