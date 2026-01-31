'use client';

import { PersonSearchResult } from '@/lib/types';

interface PersonListProps {
  results: PersonSearchResult[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  currentPage: number;
  hasMore: boolean;
  hasPrevious: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  isLoading: boolean;
  totalCount: number;
}

export default function PersonList({
  results,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  currentPage,
  hasMore,
  hasPrevious,
  onNextPage,
  onPreviousPage,
  isLoading,
  totalCount,
}: PersonListProps) {
  const allSelected = results.length > 0 && results.every(r => selectedIds.has(r.person.id));

  if (results.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-lg font-medium">No results found</p>
          <p className="text-sm">Try adjusting your search filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={allSelected ? onClearSelection : onSelectAll}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {allSelected ? 'Clear Selection' : 'Select All'}
          </button>
          {selectedIds.size > 0 && (
            <span className="text-sm text-gray-500">
              {selectedIds.size} selected
            </span>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {totalCount > 0 ? `${totalCount.toLocaleString()} results` : 'No results'}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="flex items-center gap-3 text-gray-500">
              <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Loading...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((result) => (
              <div
                key={result.person.id}
                className={`bg-white rounded-lg border p-4 flex items-center gap-4 transition-colors ${
                  selectedIds.has(result.person.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => onToggleSelect(result.person.id)}
                  className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedIds.has(result.person.id)
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300 hover:border-blue-500'
                  }`}
                >
                  {selectedIds.has(result.person.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Avatar */}
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {result.person.photo ? (
                    <img
                      src={result.person.photo}
                      alt={result.person.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-medium text-gray-500">
                      {result.person.full_name?.charAt(0) || '?'}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 truncate">
                      {result.person.full_name || 'Unknown'}
                    </h3>
                    {result.person.linkedin_url && (
                      <a
                        href={result.person.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {result.role.title || 'No title'}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {result.role.company_name || 'No company'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onPreviousPage}
          disabled={!hasPrevious || isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">Page {currentPage}</span>
        <button
          onClick={onNextPage}
          disabled={!hasMore || isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
