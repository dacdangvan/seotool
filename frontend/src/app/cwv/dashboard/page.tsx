'use client';

/**
 * CWV Dashboard Page
 * 
 * Core Web Vitals health dashboard at project level
 * Shows KPIs, distributions, and drill-down to All Pages
 */

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  RefreshCw, 
  ExternalLink,
  Download,
  Calendar,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

import { CWVKpiCards, CWVKpiData } from '@/components/cwv/CWVKpiCards';
import { CWVDistributionChart, CWVDistributionData, CWVUrlSamples } from '@/components/cwv/CWVDistributionChart';
import { getCWVDashboard, CWVDashboardData } from '@/services/cwv-dashboard.service';
import { DeviceProfile, CWVStatus } from '@/types/cwv.types';

// Loading skeleton component
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="h-10 bg-gray-200 rounded w-40" />
      </div>
      
      {/* KPI cards skeleton */}
      <div className="h-32 bg-gray-200 rounded-xl" />
      <div className="flex gap-4">
        <div className="flex-1 h-32 bg-gray-200 rounded-xl" />
        <div className="flex-1 h-32 bg-gray-200 rounded-xl" />
        <div className="flex-1 h-32 bg-gray-200 rounded-xl" />
      </div>
      
      {/* Charts skeleton */}
      <div className="h-64 bg-gray-200 rounded-xl" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-48 bg-gray-200 rounded-xl" />
        <div className="h-48 bg-gray-200 rounded-xl" />
        <div className="h-48 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}

// Error state component
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Failed to load dashboard
      </h3>
      <p className="text-gray-500 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

// Empty state component
function EmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-200">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Calendar className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        No CWV data available
      </h3>
      <p className="text-gray-500 text-center max-w-md mb-4">
        Core Web Vitals haven't been measured for this project yet. 
        Run a crawl with CWV measurement enabled to see insights here.
      </p>
      <Link
        href={`/crawl?projectId=${projectId}`}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
      >
        <ExternalLink size={16} />
        Go to Crawl
      </Link>
    </div>
  );
}

// Main dashboard content
function CWVDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const projectId = searchParams.get('projectId') ?? 'default';
  
  const [device, setDevice] = useState<DeviceProfile>('mobile');
  const [data, setData] = useState<CWVDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch dashboard data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const dashboardData = await getCWVDashboard(projectId, device);
      setData(dashboardData);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [projectId, device]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle drill-down: navigate to All Pages with filter
  const handleStatusClick = (status: CWVStatus) => {
    router.push(`/crawl?projectId=${projectId}&cwvFilter=${status}&cwvDevice=${device}`);
  };

  const handleMetricClick = (metric: 'lcp' | 'inp' | 'cls', status: CWVStatus) => {
    router.push(`/crawl?projectId=${projectId}&cwvMetric=${metric}&cwvFilter=${status}&cwvDevice=${device}`);
  };

  // Export functionality (placeholder)
  const handleExport = () => {
    if (!data) return;
    
    const exportData = {
      project: data.projectName,
      device: data.device,
      timestamp: data.lastUpdated,
      kpi: data.kpi,
      distribution: data.distribution
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cwv-report-${projectId}-${device}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  if (!data || data.kpi.totalUrls === 0) {
    return <EmptyState projectId={projectId} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/crawl/dashboard?projectId=${projectId}`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Core Web Vitals Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              {data.projectName} • Last updated: {new Date(data.lastUpdated).toLocaleString()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <CWVKpiCards
        data={data.kpi}
        device={device}
        onDeviceChange={setDevice}
        onStatusClick={handleStatusClick}
      />

      {/* Distribution Charts */}
      <CWVDistributionChart
        data={data.distribution}
        urlSamples={data.urlSamples}
        onMetricClick={handleMetricClick}
      />

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/crawl?projectId=${projectId}&cwvFilter=poor&cwvDevice=${device}`}
            className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
          >
            View Poor URLs ({data.kpi.poorUrls})
          </Link>
          <Link
            href={`/crawl?projectId=${projectId}&cwvMetric=lcp&cwvFilter=poor&cwvDevice=${device}`}
            className="px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
          >
            Fix Slow LCP
          </Link>
          <Link
            href={`/crawl?projectId=${projectId}&cwvMetric=cls&cwvFilter=poor&cwvDevice=${device}`}
            className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            Fix Layout Shift
          </Link>
          <Link
            href={`/crawl?projectId=${projectId}`}
            className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            View All Pages
          </Link>
        </div>
      </div>

      {/* Recommendations */}
      {(data.kpi.poorUrls > 0 || data.kpi.needsImprovementUrls > 0) && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">💡 Recommendations</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            {data.distribution.lcp.poor > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-amber-500">•</span>
                <span>
                  <strong>{data.distribution.lcp.poor} URLs</strong> have poor LCP. 
                  Consider optimizing images, reducing server response time, or using a CDN.
                </span>
              </li>
            )}
            {data.distribution.cls.poor > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-amber-500">•</span>
                <span>
                  <strong>{data.distribution.cls.poor} URLs</strong> have poor CLS. 
                  Ensure images have explicit dimensions and avoid dynamically injected content.
                </span>
              </li>
            )}
            {data.distribution.inp.poor > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-amber-500">•</span>
                <span>
                  <strong>{data.distribution.inp.poor} URLs</strong> have poor INP. 
                  Reduce JavaScript execution time and optimize event handlers.
                </span>
              </li>
            )}
            {data.kpi.passRate < 75 && (
              <li className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>
                  Only <strong>{data.kpi.passRate.toFixed(0)}%</strong> of URLs pass CWV assessment. 
                  Aim for at least 75% to maintain good search rankings.
                </span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Main page component with Suspense boundary
export default function CWVDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Suspense fallback={<DashboardSkeleton />}>
          <CWVDashboardContent />
        </Suspense>
      </div>
    </div>
  );
}
