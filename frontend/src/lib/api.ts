/**
 * Dashboard API Client
 * 
 * v0.7 - Client for fetching dashboard data from orchestrator
 */

import type { DashboardData, CopilotMessage } from '@/types/dashboard';
import { mockDashboardData, mockCopilotResponses } from './mock-data';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// For MVP, use mock data. In production, fetch from backend.
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

/**
 * Fetch aggregated dashboard data
 */
export async function fetchDashboardData(): Promise<DashboardData> {
  if (USE_MOCK) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockDashboardData;
  }
  
  const response = await fetch(`${API_BASE}/dashboard`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    next: { revalidate: 60 }, // Cache for 60 seconds
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }
  
  return response.json();
}

/**
 * Send message to AI Copilot
 */
export async function sendCopilotMessage(
  message: string,
  history: CopilotMessage[]
): Promise<string> {
  if (USE_MOCK) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Simple keyword matching for demo
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('traffic') || lowerMessage.includes('drop')) {
      return mockCopilotResponses['traffic'];
    }
    if (lowerMessage.includes('keyword') || lowerMessage.includes('ranking')) {
      return mockCopilotResponses['ranking'];
    }
    if (lowerMessage.includes('content') || lowerMessage.includes('page')) {
      return mockCopilotResponses['content'];
    }
    return mockCopilotResponses['general'];
  }
  
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
}

/**
 * Refresh specific dashboard section
 */
export async function refreshDashboardSection(
  section: 'kpi' | 'health' | 'forecast' | 'recommendations'
): Promise<Partial<DashboardData>> {
  if (USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    switch (section) {
      case 'kpi':
        return { kpiOverview: mockDashboardData.kpiOverview };
      case 'health':
        return { seoHealth: mockDashboardData.seoHealth };
      case 'forecast':
        return { forecast: mockDashboardData.forecast };
      case 'recommendations':
        return { recommendations: mockDashboardData.recommendations };
      default:
        return {};
    }
  }
  
  const response = await fetch(`${API_BASE}/dashboard/${section}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to refresh ${section}`);
  }
  
  return response.json();
}
