/**
 * useCrawlStatus Hook
 * 
 * Provides real-time crawl status polling for projects
 * - Polls every N seconds when crawl is running
 * - Stops polling when completed/failed
 * - Smooth updates without flicker
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CrawlStatus } from '@/types/auth';
import { projectService } from '@/services/project.service';

export interface CrawlStatusData {
  projectId: string;
  status: CrawlStatus;
  progress: number;
  isRunning: boolean;
  canTrigger: boolean;
  lastCrawlAt: string | null;
  error?: string;
}

interface UseCrawlStatusOptions {
  /** Polling interval in milliseconds when crawl is running */
  pollingInterval?: number;
  /** Whether to auto-start polling */
  autoStart?: boolean;
  /** Callback when status changes */
  onStatusChange?: (status: CrawlStatus, previousStatus: CrawlStatus) => void;
  /** Callback when crawl completes */
  onComplete?: () => void;
  /** Callback when crawl fails */
  onError?: (error: string) => void;
}

const DEFAULT_POLLING_INTERVAL = 2000; // 2 seconds

export function useCrawlStatus(
  projectId: string | null,
  options: UseCrawlStatusOptions = {}
) {
  const {
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    autoStart = true,
    onStatusChange,
    onComplete,
    onError,
  } = options;

  const [data, setData] = useState<CrawlStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<CrawlStatus | null>(null);
  const isMountedRef = useRef(true);

  // Fetch crawl status
  const fetchStatus = useCallback(async () => {
    if (!projectId) return;

    try {
      const result = await projectService.getCrawlStatus(projectId);
      
      if (!isMountedRef.current) return;

      setData(result);
      setError(null);

      // Handle status change callback
      if (previousStatusRef.current && previousStatusRef.current !== result.status) {
        onStatusChange?.(result.status, previousStatusRef.current);

        // Handle completion
        if (result.status === 'completed' && previousStatusRef.current === 'running') {
          onComplete?.();
        }

        // Handle failure
        if (result.status === 'failed') {
          onError?.(result.error || 'Crawl failed');
        }
      }

      previousStatusRef.current = result.status;
    } catch (err) {
      if (!isMountedRef.current) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch crawl status';
      setError(errorMessage);
      console.error('Failed to fetch crawl status:', err);
    }
  }, [projectId, onStatusChange, onComplete, onError]);

  // Initial fetch
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchStatus();
    setIsLoading(false);
  }, [fetchStatus]);

  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    
    intervalRef.current = setInterval(fetchStatus, pollingInterval);
  }, [fetchStatus, pollingInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Trigger crawl
  const triggerCrawl = useCallback(async (options?: {
    maxPages?: number;
    maxDepth?: number;
  }) => {
    if (!projectId) return;

    setIsLoading(true);
    try {
      const result = await projectService.triggerCrawl(projectId, options);
      
      // Immediately update local state
      setData(prev => prev ? {
        ...prev,
        status: result.status,
        progress: 0,
        isRunning: true,
        canTrigger: false,
      } : null);

      // Start polling to track progress
      startPolling();

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to trigger crawl';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, startPolling]);

  // Cancel crawl
  const cancelCrawl = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    try {
      const result = await projectService.cancelCrawl(projectId);
      
      // Update local state
      setData(prev => prev ? {
        ...prev,
        status: 'cancelled',
        isRunning: false,
        canTrigger: true,
      } : null);

      // Stop polling
      stopPolling();

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel crawl';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, stopPolling]);

  // Auto-manage polling based on status
  useEffect(() => {
    if (!data) return;

    const isRunning = data.status === 'running' || data.status === 'queued';
    
    if (isRunning) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [data?.status, startPolling, stopPolling]);

  // Initial fetch on mount
  useEffect(() => {
    isMountedRef.current = true;

    if (projectId && autoStart) {
      refresh();
    }

    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [projectId, autoStart, refresh, stopPolling]);

  return {
    // Data
    data,
    status: data?.status || 'not_started',
    progress: data?.progress || 0,
    isRunning: data?.isRunning || false,
    canTrigger: data?.canTrigger ?? true,
    lastCrawlAt: data?.lastCrawlAt || null,

    // State
    isLoading,
    error,

    // Actions
    refresh,
    triggerCrawl,
    cancelCrawl,
    startPolling,
    stopPolling,
  };
}

/**
 * Hook to track multiple projects' crawl status
 */
export function useMultiProjectCrawlStatus(
  projectIds: string[],
  options: Omit<UseCrawlStatusOptions, 'onStatusChange' | 'onComplete' | 'onError'> = {}
) {
  const { pollingInterval = DEFAULT_POLLING_INTERVAL } = options;

  const [statusMap, setStatusMap] = useState<Record<string, CrawlStatusData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Fetch all statuses
  const fetchAllStatuses = useCallback(async () => {
    if (projectIds.length === 0) return;

    try {
      const results = await Promise.all(
        projectIds.map(async (id) => {
          try {
            const status = await projectService.getCrawlStatus(id);
            return { id, status };
          } catch {
            return null;
          }
        })
      );

      if (!isMountedRef.current) return;

      const newStatusMap: Record<string, CrawlStatusData> = {};
      results.forEach((result) => {
        if (result) {
          newStatusMap[result.id] = result.status;
        }
      });

      setStatusMap(newStatusMap);
    } catch (err) {
      console.error('Failed to fetch crawl statuses:', err);
    }
  }, [projectIds]);

  // Check if any project is running
  const hasRunningCrawl = Object.values(statusMap).some(
    (s) => s.status === 'running' || s.status === 'queued'
  );

  // Manage polling
  useEffect(() => {
    if (hasRunningCrawl) {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(fetchAllStatuses, pollingInterval);
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasRunningCrawl, fetchAllStatuses, pollingInterval]);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    
    setIsLoading(true);
    fetchAllStatuses().finally(() => setIsLoading(false));

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchAllStatuses]);

  return {
    statusMap,
    isLoading,
    hasRunningCrawl,
    refresh: fetchAllStatuses,
    getStatus: (projectId: string) => statusMap[projectId] || null,
  };
}

export default useCrawlStatus;
