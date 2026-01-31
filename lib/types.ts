// Forager API Types

export interface SearchFilters {
  // Person filters
  personIndustry?: string;
  personLocation?: string;
  // Company filters
  companyIndustry?: string;
  companyLocation?: string;
  companyKeywords?: string;
}

export interface ForagerSearchParams {
  filters: SearchFilters;
  page: number;
  pageSize: number;
}

export interface PersonBasic {
  id: string;  // Unique key for React (composite)
  forager_person_id: string;  // Actual Forager person ID for API calls
  full_name: string;
  first_name?: string;
  last_name?: string;
  photo?: string;
  headline?: string;
  linkedin_url?: string;
}

export interface RoleInfo {
  title?: string;
  company_name?: string;
  company_id?: string;
  is_current?: boolean;
  start_date?: string;
  end_date?: string;
}

export interface PersonSearchResult {
  person: PersonBasic;
  role: RoleInfo;
}

export interface SearchResponse {
  results: PersonSearchResult[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// Enriched person with phone numbers
export interface PhoneNumber {
  phone_number: string;
  type?: string;
  is_valid?: boolean;
}

export interface EnrichedPerson {
  id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  photo?: string;
  headline?: string;
  linkedin_url?: string;
  work_emails?: string[];
  personal_emails?: string[];
  phone_numbers?: PhoneNumber[];
  skills?: string[];
  location?: string;
  summary?: string;
  current_role?: RoleInfo;
}

// Lead list types
export interface Lead {
  id: string;
  full_name: string;
  role_title: string;
  company_name: string;
  phone_number: string;
  email?: string;
  linkedin_url?: string;
  location?: string;
  headline?: string;
  added_at: string;
}

// Supabase contact record (matches existing table schema)
export interface ContactRecord {
  id?: string;
  phone_number: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  company?: string;
  headline?: string;
  location?: string;
  linkedin_url?: string;
  source: string;
  source_id?: string;
  raw_data?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

// Cached page for pagination
export interface CachedPage {
  page: number;
  results: PersonSearchResult[];
  timestamp: number;
}

export interface PaginationCache {
  filters: SearchFilters;
  pages: Map<number, PersonSearchResult[]>;
  totalCount: number;
}
