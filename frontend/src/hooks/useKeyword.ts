'use client';

/**
 * Keyword Hooks
 * 
 * React hooks for keyword data fetching
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  fetchKeywordOverview, 
  fetchKeywordKPIs,
  fetchKeywordList 
} from '@/services/keyword.service';
import type { 
  KeywordOverviewData, 
  KeywordKPIs,
  KeywordListParams,
  KeywordListResponse,
  KeywordFilters,
  KeywordSortField,
  SortDirection,
} from '@/types/keyword.types';

/**
 * Hook to fetch complete keyword overview data
 */
export function useKeywordOverview(projectId: string) {
  const [data, setData] = useState<KeywordOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchKeywordOverview(projectId);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch keyword overview'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

/**
 * Hook to fetch only KPIs (lighter data load)
 */
export function useKeywordKPIs(projectId: string) {
  const [kpis, setKPIs] = useState<KeywordKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchKeywordKPIs(projectId);
      setKPIs(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch keyword KPIs'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    kpis,
    loading,
    error,
    refetch: fetchData,
  };
}

/**
 * Default filter values
 */
const DEFAULT_FILTERS: KeywordFilters = {
  intent: 'all',
  difficulty: 'all',
  opportunity: 'all',
  mapped: 'all',
  search: '',
  minVolume: undefined,
  maxVolume: undefined,
  minDifficulty: undefined,
  maxDifficulty: undefined,
};

/**
 * Hook to fetch keyword list with filtering, sorting, and pagination
 */
export function useKeywords(projectId: string) {
  const [data, setData] = useState<KeywordListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<KeywordFilters>(DEFAULT_FILTERS);
  
  // Sort state
  const [sortField, setSortField] = useState<KeywordSortField>('searchVolume');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Build params object
  const params: KeywordListParams = useMemo(() => ({
    filters,
    sort: {
      field: sortField,
      direction: sortDirection,
    },
    pagination: {
      page,
      pageSize,
    },
  }), [filters, sortField, sortDirection, page, pageSize]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchKeywordList(projectId, params);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch keywords'));
    } finally {
      setLoading(false);
    }
  }, [projectId, params]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter handlers
  const updateFilter = useCallback(<K extends keyof KeywordFilters>(
    key: K,
    value: KeywordFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page on filter change
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  // Sort handlers
  const updateSort = useCallback((field: KeywordSortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  }, [sortField]);

  // Pagination handlers
  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const updatePageSize = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== '' ||
      (filters.intent && filters.intent !== 'all') ||
      (filters.difficulty && filters.difficulty !== 'all') ||
      (filters.opportunity && filters.opportunity !== 'all') ||
      (filters.mapped && filters.mapped !== 'all') ||
      filters.minVolume !== undefined ||
      filters.maxVolume !== undefined ||
      filters.minDifficulty !== undefined ||
      filters.maxDifficulty !== undefined
    );
  }, [filters]);

  return {
    // Data
    keywords: data?.keywords ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    loading,
    error,
    
    // Filters
    filters,
    updateFilter,
    resetFilters,
    hasActiveFilters,
    
    // Sort
    sortField,
    sortDirection,
    updateSort,
    
    // Pagination
    page,
    pageSize,
    goToPage,
    updatePageSize,
    
    // Refresh
    refetch: fetchData,
  };
}
