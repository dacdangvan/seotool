'use client';

/**
 * CrawlSummaryCards Component
 * 
 * KPI cards showing high-level crawl health metrics
 * Manager-friendly labels, clickable to view details
 */

import React from 'react';
import { 
  FileText, 
  AlertTriangle, 
  EyeOff, 
  AlertCircle, 
  ServerCrash,
  CheckCircle2,
  Clock,
  TrendingUp
} from 'lucide-react';
import { CrawlKPIs } from '@/types/crawl-summary.types';

interface CrawlSummaryCardsProps {
  kpis: CrawlKPIs;
  onCardClick?: (cardType: string) => void;
}

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'green' | 'amber' | 'red' | 'blue' | 'gray';
  onClick?: () => void;
  highlight?: boolean;
}

function KPICard({ title, value, subtitle, icon, color, onClick, highlight }: KPICardProps) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };

  const iconColorClasses = {
    green: 'text-green-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
    blue: 'text-blue-500',
    gray: 'text-gray-500',
  };

  return (
    <div
      className={`
        relative rounded-xl border p-5 transition-all duration-200
        ${colorClasses[color]}
        ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}
        ${highlight ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-2 rounded-lg bg-white/50 ${iconColorClasses[color]}`}>
          {icon}
        </div>
      </div>
      
      {onClick && (
        <div className="absolute bottom-2 right-3 text-xs text-gray-400">
          Click to view →
        </div>
      )}
    </div>
  );
}

export function CrawlSummaryCards({ kpis, onCardClick }: CrawlSummaryCardsProps) {
  const healthPercentage = kpis.totalPages > 0 
    ? Math.round((kpis.healthyPages / kpis.totalPages) * 100)
    : 0;

  const formatLoadTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-4">
      {/* Primary KPIs Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Pages Crawled"
          value={kpis.totalPages.toLocaleString()}
          subtitle={kpis.lastCrawlDate ? `Last crawl: ${new Date(kpis.lastCrawlDate).toLocaleDateString()}` : undefined}
          icon={<FileText size={24} />}
          color="blue"
          onClick={() => onCardClick?.('all')}
        />
        
        <KPICard
          title="Site Health Score"
          value={`${healthPercentage}%`}
          subtitle={`${kpis.healthyPages} healthy pages`}
          icon={<TrendingUp size={24} />}
          color={healthPercentage >= 80 ? 'green' : healthPercentage >= 60 ? 'amber' : 'red'}
        />
        
        <KPICard
          title="Pages with Issues"
          value={kpis.pagesWithIssues.toLocaleString()}
          subtitle={kpis.totalPages > 0 ? `${Math.round((kpis.pagesWithIssues / kpis.totalPages) * 100)}% of pages` : undefined}
          icon={<AlertTriangle size={24} />}
          color={kpis.pagesWithIssues > 0 ? 'amber' : 'green'}
          onClick={() => onCardClick?.('issues')}
          highlight={kpis.pagesWithIssues > 20}
        />
        
        <KPICard
          title="Avg. Load Time"
          value={formatLoadTime(kpis.avgLoadTime)}
          subtitle={kpis.avgLoadTime > 3000 ? 'Needs improvement' : 'Good performance'}
          icon={<Clock size={24} />}
          color={kpis.avgLoadTime <= 2000 ? 'green' : kpis.avgLoadTime <= 3000 ? 'amber' : 'red'}
        />
      </div>

      {/* Secondary KPIs Row */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard
          title="Noindex Pages"
          value={kpis.noindexPages.toLocaleString()}
          subtitle="Hidden from search engines"
          icon={<EyeOff size={24} />}
          color={kpis.noindexPages > 0 ? 'amber' : 'gray'}
          onClick={() => onCardClick?.('noindex')}
        />
        
        <KPICard
          title="Client Errors (4xx)"
          value={kpis.errorPages4xx.toLocaleString()}
          subtitle="Broken links, not found"
          icon={<AlertCircle size={24} />}
          color={kpis.errorPages4xx > 0 ? 'red' : 'green'}
          onClick={() => onCardClick?.('4xx')}
          highlight={kpis.errorPages4xx > 5}
        />
        
        <KPICard
          title="Server Errors (5xx)"
          value={kpis.errorPages5xx.toLocaleString()}
          subtitle="Server issues"
          icon={<ServerCrash size={24} />}
          color={kpis.errorPages5xx > 0 ? 'red' : 'green'}
          onClick={() => onCardClick?.('5xx')}
          highlight={kpis.errorPages5xx > 0}
        />
      </div>
    </div>
  );
}

export default CrawlSummaryCards;
