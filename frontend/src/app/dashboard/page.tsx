/**
 * Dashboard Page
 * 
 * v0.7 - Manager Dashboard for SEO decision-makers
 */

'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import {
  KPIOverview,
  SEOHealthPanel,
  ForecastChart,
  RecommendationPanel,
  ManagerCopilot,
} from '@/components/dashboard';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { Sidebar } from '@/components/Sidebar';
import { RoleGuard } from '@/components/RoleGuard';
import { useProject } from '@/context/ProjectContext';
import { fetchDashboardData } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';

function DashboardContent() {
  const { currentProject } = useProject();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      
      const dashboardData = await fetchDashboardData();
      setData(dashboardData);
    } catch (err) {
      setError('Failed to load dashboard data. Please try again.');
      console.error('Dashboard error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentProject]);

  const handleRefresh = () => {
    loadData(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <main className="ml-64 p-8">
          <div className="mb-8">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
          </div>
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <main className="ml-64 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {error || 'Something went wrong'}
            </h2>
            <button
              onClick={() => loadData()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {currentProject ? currentProject.name : 'SEO Dashboard'}
            </h1>
            <p className="text-gray-500 mt-1">Overview of your SEO performance</p>
          </div>
          
          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            {/* Last Updated */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>Updated {formatRelativeTime(data.kpiOverview.lastUpdated)}</span>
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="space-y-6">
          {/* KPI Overview - Top Section */}
          <KPIOverview data={data.kpiOverview} />

          {/* SEO Health & Risk Panel */}
          <SEOHealthPanel data={data.seoHealth} />

          {/* Two Column Layout: Forecast + Recommendations */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ForecastChart data={data.forecast} />
            <RecommendationPanel data={data.recommendations} />
          </div>

          {/* AI Copilot - Full Width */}
          <ManagerCopilot />
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>AI SEO Tool v0.7 • Manager Dashboard</p>
        </footer>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RoleGuard requiredPermissions={['dashboard:view']}>
      <DashboardContent />
    </RoleGuard>
  );
}
