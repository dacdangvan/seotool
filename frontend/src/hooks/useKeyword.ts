'use client';

/**
 * Keyword Hooks
 * 
 * React hooks for keyword data fetching
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchKeywordOverview, fetchKeywordKPIs } from '@/services/keyword.service';
import type { KeywordOverviewData, KeywordKPIs } from '@/types/keyword.types';

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
