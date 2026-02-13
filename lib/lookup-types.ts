export interface ParsedName {
  id: string;          // "name-0", "name-1", etc.
  firstName: string;
  lastName: string;
  fullName: string;
}

export interface LookupResult {
  name: ParsedName;
  status: 'pending' | 'searching' | 'found' | 'not_found' | 'error';
  phoneNumbers: string[];
  email?: string;
  fullNameMatch?: string;  // actual name returned by API
  source?: 'forager' | 'aviato';
}

export interface LookupResponse {
  results: {
    fullName: string;
    matchedName?: string;
    personId?: string;
    phoneNumbers: string[];
    email?: string;
    status: 'found' | 'not_found' | 'error';
  }[];
}
