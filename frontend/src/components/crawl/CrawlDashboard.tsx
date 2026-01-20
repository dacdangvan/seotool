'use client';

/**
 * CrawlDashboard Component
 * 
 * Main dashboard showing crawl health overview
 * Combines KPI cards with charts
 */

import React, { useEffect, useState } from 'react';
import { RefreshCw, Calendar, ExternalLink, Gauge } from 'lucide-react';
import Link from 'next/link';
import { CrawlSummary } from '@/types/crawl-summary.types';
import { getCrawlSummary } from '@/services/crawl-summary.service';
import { CrawlSummaryCards } from './CrawlSummaryCards';
import { CrawlStatusChart } from './CrawlStatusChart';
import { CrawlIssuesChart } from './CrawlIssuesChart';
import { CrawlProgressBar } from './CrawlProgressBar';

interface CrawlDashboardProps {
  projectId: string;
  onNavigateToPages?: (filter?: string) => void;
  onNavigateToCWV?: () => void;
}

export function CrawlDashboard({ projectId, onNavigateToPages, onNavigateToCWV }: CrawlDashboardProps) {
  const [summary, setSummary] = useState<CrawlSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCrawlSummary(projectId);
      setSummary(data);
    } catch (err) {
      setError('Failed to load crawl summary');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [projectId]);

  // Handle KPI card click - navigate to filtered pages
  const handleCardClick = (cardType: string) => {
    onNavigateToPages?.(cardType);
  };

  // Handle issue click - navigate to filtered issues
  const handleIssueClick = (issueType: string) => {
    onNavigateToPages?.(`issue:${issueType}`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="h-80 bg-gray-200 rounded-xl" />
          <div className="h-80 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">{error}</p>
        <button
          onClick={fetchSummary}
          className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // No data state
  if (!summary || summary.crawlStatus === 'not_started') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <RefreshCw size={32} className="text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Crawl Data Yet</h3>
        <p className="text-gray-500 mb-4">
          Start a crawl to see your site's SEO health overview
        </p>
        <button
          onClick={() => onNavigateToPages?.('start-crawl')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Start Crawl
        </button>
      </div>
    );
  }

  // Running state
  if (summary.crawlStatus === 'running') {
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <RefreshCw size={24} className="text-blue-600 animate-spin" />
              <div>
                <h3 className="font-semibold text-blue-800">Crawl in Progress</h3>
                <p className="text-sm text-blue-600">Please wait while we analyze your site</p>
              </div>
            </div>
            <span className="text-2xl font-bold text-blue-700">
              {summary.crawlProgress || 0}%
            </span>
          </div>
          <CrawlProgressBar progress={summary.crawlProgress || 0} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Crawl Overview</h2>
          <p className="text-gray-500">
            Site health summary for {summary.projectName || 'your project'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {summary.kpis.lastCrawlDate && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar size={16} />
              <span>
                Last crawl: {new Date(summary.kpis.lastCrawlDate).toLocaleDateString()}
              </span>
            </div>
          )}
          <button
            onClick={fetchSummary}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh data"
          >
            <RefreshCw size={20} />
          </button>
          <button
            onClick={() => onNavigateToPages?.('all')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ExternalLink size={16} />
            View All Pages
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <CrawlSummaryCards
        kpis={summary.kpis}
        onCardClick={handleCardClick}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CrawlStatusChart
          data={summary.statusCodes}
          title="HTTP Status Distribution"
        />
        <CrawlIssuesChart
          data={summary.issues}
          title="SEO Issues Overview"
          onIssueClick={handleIssueClick}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <h4 className="text-sm font-medium text-gray-600 mb-3">Quick Actions</h4>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/cwv/dashboard?projectId=${projectId}`}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Gauge size={16} />
            Core Web Vitals Dashboard
          </Link>
          <button
            onClick={() => onNavigateToPages?.('issues')}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            View All Issues
          </button>
          <button
            onClick={() => onNavigateToPages?.('4xx')}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Fix Broken Links
          </button>
          <button
            onClick={() => onNavigateToPages?.('noindex')}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Review Noindex Pages
          </button>
          <button
            onClick={() => onNavigateToPages?.('slow')}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Improve Page Speed
          </button>
        </div>
      </div>
    </div>
  );
}

export default CrawlDashboard;
