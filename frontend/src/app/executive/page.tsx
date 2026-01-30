/**
 * Executive Dashboard Page v1.8
 * 
 * Board-level SEO portfolio dashboard.
 * Read-only, high-level strategic overview.
 * 
 * Target users: Board members, C-level executives, Strategy leads.
 */

'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Clock, Building2, Calendar, Download, Presentation } from 'lucide-react';
import {
  ExecutiveOverview,
  PortfolioPerformance,
  RiskRadar,
  ScenarioSummary,
  AutomationTransparency,
  ExecutiveSummary,
} from '@/components/executive';
import { fetchExecutiveDashboardData } from '@/services/executive.service';
import type { ExecutiveDashboardData } from '@/types/executive';

// =============================================================================
// LOADING SKELETON
// =============================================================================

function ExecutiveSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-start">
        <div>
          <div className="h-8 w-64 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-48 bg-gray-100 rounded" />
        </div>
        <div className="h-10 w-32 bg-gray-200 rounded" />
      </div>
      
      {/* Overview skeleton */}
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-40 bg-gray-100 rounded-2xl" />
        ))}
      </div>
      
      {/* Content skeleton */}
      <div className="h-96 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-64 bg-gray-100 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// TAB NAVIGATION
// =============================================================================

type DashboardSection = 'overview' | 'portfolio' | 'risk' | 'scenarios' | 'automation' | 'summary';

interface TabProps {
  id: DashboardSection;
  label: string;
  active: boolean;
  onClick: () => void;
}

function Tab({ id, label, active, onClick }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-slate-900 text-white'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ExecutiveDashboard() {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');
  
  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      
      const dashboardData = await fetchExecutiveDashboardData();
      setData(dashboardData);
    } catch (err) {
      setError('Failed to load executive dashboard. Please try again.');
      console.error('Executive dashboard error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  useEffect(() => {
    loadData();
  }, []);
  
  const handleRefresh = () => {
    loadData(true);
  };
  
  // Format timestamp
  const formatLastUpdated = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <ExecutiveSkeleton />
        </div>
      </div>
    );
  }
  
  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-lg p-8 max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Unable to Load Dashboard
          </h2>
          <p className="text-gray-500 mb-6">
            {error || 'An unexpected error occurred. Please try again.'}
          </p>
          <button
            onClick={() => loadData()}
            className="px-6 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-900 rounded-xl">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Executive Dashboard
                  </h1>
                  <p className="text-sm text-gray-500">
                    {data.meta.portfolioName} • v1.8
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Last updated */}
              <div className="flex items-center gap-2 text-sm text-gray-500 px-3 py-2 bg-white rounded-lg border border-gray-200">
                <Clock className="w-4 h-4" />
                <span>Updated: {formatLastUpdated(data.meta.generatedAt)}</span>
              </div>
              
              {/* Refresh button */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              
              {/* Export buttons */}
              <div className="flex items-center gap-1 border border-gray-200 rounded-lg bg-white overflow-hidden">
                <button className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
                <div className="w-px h-6 bg-gray-200" />
                <button className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                  <Presentation className="w-4 h-4" />
                  <span>Board Deck</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <nav className="flex items-center gap-2 p-1 bg-white rounded-xl border border-gray-200 shadow-sm w-fit">
            <Tab
              id="overview"
              label="Overview"
              active={activeSection === 'overview'}
              onClick={() => setActiveSection('overview')}
            />
            <Tab
              id="portfolio"
              label="Portfolio"
              active={activeSection === 'portfolio'}
              onClick={() => setActiveSection('portfolio')}
            />
            <Tab
              id="risk"
              label="Risk & Governance"
              active={activeSection === 'risk'}
              onClick={() => setActiveSection('risk')}
            />
            <Tab
              id="scenarios"
              label="Scenarios"
              active={activeSection === 'scenarios'}
              onClick={() => setActiveSection('scenarios')}
            />
            <Tab
              id="automation"
              label="Automation"
              active={activeSection === 'automation'}
              onClick={() => setActiveSection('automation')}
            />
            <Tab
              id="summary"
              label="Summary"
              active={activeSection === 'summary'}
              onClick={() => setActiveSection('summary')}
            />
          </nav>
        </header>
        
        {/* Main Content */}
        <main className="space-y-8">
          {activeSection === 'overview' && (
            <>
              <ExecutiveOverview data={data.overview} />
              <PortfolioPerformance data={data.portfolio} />
            </>
          )}
          
          {activeSection === 'portfolio' && (
            <PortfolioPerformance data={data.portfolio} />
          )}
          
          {activeSection === 'risk' && (
            <RiskRadar data={data.risk} />
          )}
          
          {activeSection === 'scenarios' && (
            <ScenarioSummary data={data.scenarios} />
          )}
          
          {activeSection === 'automation' && (
            <AutomationTransparency data={data.automation} />
          )}
          
          {activeSection === 'summary' && (
            <ExecutiveSummary data={data.summary} />
          )}
        </main>
        
        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <span>AI SEO Platform v1.8</span>
              <span>•</span>
              <span>Data Version: {data.meta.dataVersion}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Board-Level Dashboard</span>
              <span>•</span>
              <span>Read-Only View</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
