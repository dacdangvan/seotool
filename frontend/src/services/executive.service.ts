/**
 * Executive Dashboard Service
 *
 * Service for fetching executive dashboard data from backend API
 * Replaces mock data with real API calls
 */

import type { ExecutiveDashboardData } from '@/types/executive';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Fetch executive dashboard data from backend
 */
export async function fetchExecutiveDashboardData(): Promise<ExecutiveDashboardData> {
  try {
    const response = await fetch(`${API_BASE}/api/executive/dashboard`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Executive API failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('[Executive API] Dashboard data loaded from API');
    return data.data || data;

  } catch (error) {
    console.error('[Executive API] Fetch error:', error);
    // For now, fall back to mock data if API fails
    // TODO: Remove this fallback once backend executive endpoint is implemented
    const { generateExecutiveMockData } = await import('@/lib/executive-mock-data');
    console.warn('[Executive API] Falling back to mock data');
    return generateExecutiveMockData();
  }
}