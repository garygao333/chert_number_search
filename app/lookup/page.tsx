'use client';

import { useState, useRef, useCallback } from 'react';
import { ParsedName, LookupResult, LookupResponse } from '@/lib/lookup-types';

// Header keywords to skip when parsing CSV
const HEADER_KEYWORDS = ['first_name', 'last_name', 'firstname', 'lastname', 'first name', 'last name', 'name', 'full_name', 'fullname'];

function parseNames(text: string): ParsedName[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const names: ParsedName[] = [];

  for (const line of lines) {
    // Skip header rows
    if (HEADER_KEYWORDS.some(kw => line.toLowerCase().includes(kw))) continue;

    let firstName = '';
    let lastName = '';

    if (line.includes(',')) {
      // CSV format: firstName,lastName or lastName,firstName
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 2) {
        firstName = parts[0];
        lastName = parts[1];
      }
    } else {
      // Space-separated: firstName lastName
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      } else if (parts.length === 1) {
        firstName = parts[0];
      }
    }

    if (firstName || lastName) {
      const fullName = `${firstName} ${lastName}`.trim();
      names.push({
        id: `name-${names.length}`,
        firstName,
        lastName,
        fullName,
      });
    }
  }

  return names;
}

const BATCH_SIZE = 5;

export default function LookupPage() {
  const [names, setNames] = useState<ParsedName[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<LookupResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0 });
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse from file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseNames(text);
      setNames(parsed);
      setSelectedIds(new Set(parsed.map(n => n.id)));
      setResults([]);
    };
    reader.readAsText(file);

    // Reset file input so the same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Parse from pasted text
  const handleParse = () => {
    if (!pasteText.trim()) return;
    const parsed = parseNames(pasteText);
    setNames(parsed);
    setSelectedIds(new Set(parsed.map(n => n.id)));
    setResults([]);
  };

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === names.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(names.map(n => n.id)));
    }
  };

  // Search function — sends batches of BATCH_SIZE for progress updates
  const handleSearch = useCallback(async (source: 'forager' | 'aviato') => {
    const selected = names.filter(n => selectedIds.has(n.id));
    if (selected.length === 0) return;

    setIsSearching(true);
    setSearchProgress({ current: 0, total: selected.length });

    // Initialize results as pending
    const initialResults: LookupResult[] = selected.map(name => ({
      name,
      status: 'searching',
      phoneNumbers: [],
      source,
    }));
    setResults(initialResults);

    const allResults: LookupResult[] = [...initialResults];

    for (let i = 0; i < selected.length; i += BATCH_SIZE) {
      const batch = selected.slice(i, i + BATCH_SIZE);
      const batchNames = batch.map(n => n.fullName);

      try {
        const response = await fetch(`/api/lookup/${source}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names: batchNames }),
        });

        if (!response.ok) throw new Error('Search failed');

        const data: LookupResponse = await response.json();

        // Update results for this batch
        for (let j = 0; j < batch.length; j++) {
          const resultIndex = i + j;
          const apiResult = data.results[j];

          if (apiResult) {
            allResults[resultIndex] = {
              name: batch[j],
              status: apiResult.status === 'found' ? 'found' : apiResult.status === 'error' ? 'error' : 'not_found',
              phoneNumbers: apiResult.phoneNumbers || [],
              email: apiResult.email,
              fullNameMatch: apiResult.matchedName,
              source,
            };
          } else {
            allResults[resultIndex] = {
              ...allResults[resultIndex],
              status: 'error',
            };
          }
        }
      } catch {
        // Mark batch as error
        for (let j = 0; j < batch.length; j++) {
          allResults[i + j] = {
            ...allResults[i + j],
            status: 'error',
          };
        }
      }

      setSearchProgress({ current: Math.min(i + BATCH_SIZE, selected.length), total: selected.length });
      setResults([...allResults]);
    }

    setIsSearching(false);
  }, [names, selectedIds]);

  // Export results CSV
  const exportResults = () => {
    const found = results.filter(r => r.status === 'found' || r.phoneNumbers.length > 0);
    if (found.length === 0) return;

    const headers = ['Name', 'Matched Name', 'Phone Numbers', 'Email', 'Source', 'Status'];
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const rows = results.map(r => [
      r.name.fullName,
      r.fullNameMatch || '',
      r.phoneNumbers.join('; '),
      r.email || '',
      r.source || '',
      r.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCSV).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lookup_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selectedCount = selectedIds.size;
  const foundCount = results.filter(r => r.phoneNumbers.length > 0).length;
  const searchedCount = results.filter(r => r.status !== 'pending' && r.status !== 'searching').length;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Name Lookup</h1>
          <p className="text-sm text-gray-500 mt-1">Upload a CSV of names to search for phone numbers</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">1. Upload Names</h2>

          <div className="flex gap-4 items-start">
            {/* File upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload CSV</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              <p className="text-xs text-gray-400 mt-1">Supports: firstName,lastName or firstName lastName</p>
            </div>

            {/* Divider */}
            <div className="flex items-center self-stretch">
              <span className="text-gray-400 text-sm">or</span>
            </div>

            {/* Paste area */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Paste Names</label>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={"John Smith\nJane Doe\nBob,Johnson"}
                rows={4}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleParse}
                disabled={!pasteText.trim()}
                className="mt-2 px-4 py-1.5 bg-gray-800 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Parse Names
              </button>
            </div>
          </div>
        </div>

        {/* Name List Section */}
        {names.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">
                2. Select Names
                <span className="text-sm font-normal text-gray-500 ml-2">
                  {selectedCount} of {names.length} selected
                </span>
              </h2>
              <button
                onClick={toggleAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {selectedIds.size === names.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
              {names.map(name => (
                <label
                  key={name.id}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(name.id)}
                    onChange={() => toggleSelect(name.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-800">{name.fullName}</span>
                  <span className="text-xs text-gray-400">({name.firstName} + {name.lastName})</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Search + Results Section */}
        {names.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">3. Search</h2>

            {/* Search Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => handleSearch('forager')}
                disabled={isSearching || selectedCount === 0}
                className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Search Forager
                <span className="text-xs opacity-75 ml-1">(best-effort)</span>
              </button>
              <button
                onClick={() => handleSearch('aviato')}
                disabled={isSearching || selectedCount === 0}
                className="px-5 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Search Aviato
              </button>
            </div>

            {/* Progress Bar */}
            {isSearching && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Searching {searchProgress.current} of {searchProgress.total}...</span>
                  <span>{Math.round((searchProgress.current / searchProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(searchProgress.current / searchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Results Table */}
            {results.length > 0 && (
              <>
                {/* Summary */}
                {!isSearching && searchedCount > 0 && (
                  <p className="text-sm text-gray-600">
                    Found phone numbers for <span className="font-semibold text-green-700">{foundCount}</span> of {searchedCount} names
                  </p>
                )}

                <div className="overflow-x-auto border border-gray-200 rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Name</th>
                        <th className="text-left px-4 py-2 font-medium">Match</th>
                        <th className="text-left px-4 py-2 font-medium">Phone</th>
                        <th className="text-left px-4 py-2 font-medium">Email</th>
                        <th className="text-left px-4 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {results.map((r, i) => (
                        <tr key={i} className={r.status === 'found' ? 'bg-green-50' : ''}>
                          <td className="px-4 py-2 text-gray-800">{r.name.fullName}</td>
                          <td className="px-4 py-2 text-gray-600">{r.fullNameMatch || '-'}</td>
                          <td className="px-4 py-2 text-gray-800 font-mono text-xs">
                            {r.phoneNumbers.length > 0 ? r.phoneNumbers.join(', ') : '-'}
                          </td>
                          <td className="px-4 py-2 text-gray-600 text-xs">{r.email || '-'}</td>
                          <td className="px-4 py-2">
                            {r.status === 'searching' && (
                              <span className="inline-flex items-center gap-1 text-blue-600">
                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Searching
                              </span>
                            )}
                            {r.status === 'found' && (
                              <span className="text-green-700 font-medium">Found</span>
                            )}
                            {r.status === 'not_found' && (
                              <span className="text-gray-400">Not found</span>
                            )}
                            {r.status === 'error' && (
                              <span className="text-red-500">Error</span>
                            )}
                            {r.status === 'pending' && (
                              <span className="text-gray-400">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Export Button */}
                {!isSearching && foundCount > 0 && (
                  <button
                    onClick={exportResults}
                    className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Export Results CSV
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
