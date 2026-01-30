/**
 * Dashboard API Client
 * 
 * v0.8 - Client for fetching dashboard data from orchestrator
 * Updated: Support hybrid mode (mock auth + real data)
 */

import type { DashboardData, CopilotMessage } from '@/types/dashboard';

const API_BASE = '/api';

// For MVP, use mock data. In production, fetch from backend.
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
const USE_REAL_DATA = process.env.NEXT_PUBLIC_USE_REAL_DATA === 'true';
// If USE_REAL_DATA is true, always fetch from API regardless of USE_MOCK
const FETCH_FROM_API = USE_REAL_DATA || !USE_MOCK;

/**
 * Fetch aggregated dashboard data for a project
 */
export async function fetchDashboardData(projectId?: string): Promise<DashboardData> {
  // Always fetch from API - no mock data fallback in production
  // Mock data is only for development with NEXT_PUBLIC_USE_MOCK=true
  
  try {
    // Build URL - if projectId provided, use it; otherwise call default endpoint
    // Note: Dashboard routes have /api prefix in backend
    const url = projectId 
      ? `${API_BASE}/api/dashboard/${projectId}`
      : `${API_BASE}/api/dashboard`;
    
    console.log('[API] Fetching dashboard data from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dashboard API failed: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('[API] Dashboard data loaded from API');
    return data.data || data;
    
  } catch (error) {
    console.error('[API] Dashboard fetch error:', error);
    throw error; // Don't fall back to mock data
  }
}

/**
 * Send message to AI Copilot
 */
export async function sendCopilotMessage(
  message: string,
  history: CopilotMessage[]
): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/copilot/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to get copilot response');
    }
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error sending copilot message:', error);
    return 'I apologize, but I am unable to provide a response at this time. Please ensure the backend is running and try again.';
  }
}

/**
 * Refresh specific dashboard section
 */
export async function refreshDashboardSection(
  section: 'kpi' | 'health' | 'forecast' | 'recommendations'
): Promise<Partial<DashboardData>> {
  try {
    const response = await fetch(`${API_BASE}/dashboard/${section}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to refresh dashboard ${section}`);
    }
    
    return response.json();
  } catch (error) {
    console.error(`Error refreshing dashboard ${section}:`, error);
    return {}; // Return empty object instead of mock data
  }
}
