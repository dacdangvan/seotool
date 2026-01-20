/**
 * useUrlInventory Hook
 * 
 * React hook for fetching and managing URL inventory data
 * Per AI_SEO_TOOL_PROMPT_BOOK.md v2.6 Section 11
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchUrlInventory,
  getCrawlCoverage,
  getUrlInventoryStats,
} from '@/services/url-inventory.service';
import type {
  UrlInventoryResponse,
  UrlInventoryFilters,
  UrlInventoryItem,
  UrlInventoryStats,
  CrawlCoverageSummary,
  UrlInventoryState,
  UrlDiscoverySource,
} from '@/types/url-inventory.types';

interface UseUrlInventoryOptions {
  /** Project ID */
  projectId: string;
  /** Initial page (default: 1) */
  initialPage?: number;
  /** Page size (default: 50) */
  pageSize?: number;
  /** Initial filters */
  initialFilters?: UrlInventoryFilters;
  /** Auto-refresh interval in ms (default: 0 = disabled) */
  refreshInterval?: number;
}

interface UseUrlInventoryReturn {
  /** URL inventory items for current page */
  items: UrlInventoryItem[];
  /** Is loading */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Current page */
  page: number;
  /** Total pages */
  totalPages: number;
  /** Total items */
  totalItems: number;
  /** Statistics */
  stats: UrlInventoryStats | null;
  /** Current filters */
  filters: UrlInventoryFilters;
  /** Go to page */
  goToPage: (page: number) => void;
  /** Set filters */
  setFilters: (filters: UrlInventoryFilters) => void;
  /** Update single filter */
  updateFilter: <K extends keyof UrlInventoryFilters>(key: K, value: UrlInventoryFilters[K]) => void;
  /** Reset filters */
  resetFilters: () => void;
  /** Refresh data */
  refresh: () => void;
}

/**
 * Hook for fetching URL inventory with pagination and filtering
 */
export function useUrlInventory({
  projectId,
  initialPage = 1,
  pageSize = 50,
  initialFilters = {},
  refreshInterval = 0,
}: UseUrlInventoryOptions): UseUrlInventoryReturn {
  const [items, setItems] = useState<UrlInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState<UrlInventoryStats | null>(null);
  const [filters, setFiltersState] = useState<UrlInventoryFilters>(initialFilters);

  const isMounted = useRef(true);

  const loadData = useCallback(async () => {
    if (!projectId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchUrlInventory(projectId, page, pageSize, filters);

      if (isMounted.current) {
        setItems(response.items);
        setTotalPages(response.pagination.totalPages);
        setTotalItems(response.pagination.totalItems);
        setStats(response.stats);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load URL inventory');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [projectId, page, pageSize, filters]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    isMounted.current = true;
    loadData();

    return () => {
      isMounted.current = false;
    };
  }, [loadData]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(loadData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, loadData]);

  const goToPage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  }, [totalPages]);

  const setFilters = useCallback((newFilters: UrlInventoryFilters) => {
    setFiltersState(newFilters);
    setPage(1); // Reset to first page when filters change
  }, []);

  const updateFilter = useCallback(<K extends keyof UrlInventoryFilters>(
    key: K,
    value: UrlInventoryFilters[K]
  ) => {
    setFiltersState(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState({});
    setPage(1);
  }, []);

  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  return {
    items,
    isLoading,
    error,
    page,
    totalPages,
    totalItems,
    stats,
    filters,
    goToPage,
    setFilters,
    updateFilter,
    resetFilters,
    refresh,
  };
}

/**
 * Hook for fetching crawl coverage summary
 * Per § 11.8 - Always show crawl coverage
 */
export function useCrawlCoverage(projectId: string, refreshInterval = 0) {
  const [coverage, setCoverage] = useState<CrawlCoverageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const loadCoverage = useCallback(async () => {
    if (!projectId) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await getCrawlCoverage(projectId);
      
      if (isMounted.current) {
        setCoverage(data);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load crawl coverage');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [projectId]);

  useEffect(() => {
    isMounted.current = true;
    loadCoverage();

    return () => {
      isMounted.current = false;
    };
  }, [loadCoverage]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(loadCoverage, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, loadCoverage]);

  return { coverage, isLoading, error, refresh: loadCoverage };
}

export default useUrlInventory;
