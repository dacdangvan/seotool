/**
 * CrawlStatusIcon Component
 * 
 * Displays crawl status with appropriate icon and color
 * - NOT_STARTED → gray clock
 * - QUEUED → gray spinner
 * - RUNNING → blue spinner
 * - COMPLETED → green check
 * - PARTIAL → yellow warning (cancelled)
 * - FAILED → red error icon
 */

'use client';

import { 
  Clock, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  RefreshCw 
} from 'lucide-react';
import { CrawlStatus } from '@/types/auth';

interface CrawlStatusIconProps {
  status: CrawlStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<CrawlStatus, {
  icon: typeof Clock;
  color: string;
  bgColor: string;
  label: string;
  description: string;
  animate?: boolean;
}> = {
  not_started: {
    icon: Clock,
    color: 'text-gray-400',
    bgColor: 'bg-gray-100',
    label: 'Not Started',
    description: 'Crawl has not been initiated yet',
  },
  queued: {
    icon: Loader2,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    label: 'Queued',
    description: 'Crawl is queued and waiting to start',
    animate: true,
  },
  running: {
    icon: RefreshCw,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    label: 'Running',
    description: 'Crawl is in progress',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    label: 'Completed',
    description: 'Crawl completed successfully',
  },
  cancelled: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    label: 'Cancelled',
    description: 'Crawl was cancelled before completion',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    label: 'Failed',
    description: 'Crawl encountered an error',
  },
};

const SIZE_CONFIG = {
  sm: {
    icon: 14,
    padding: 'p-1',
    text: 'text-xs',
  },
  md: {
    icon: 18,
    padding: 'p-1.5',
    text: 'text-sm',
  },
  lg: {
    icon: 24,
    padding: 'p-2',
    text: 'text-base',
  },
};

export function CrawlStatusIcon({ 
  status, 
  size = 'md', 
  showLabel = false,
  className = '' 
}: CrawlStatusIconProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  return (
    <div 
      className={`inline-flex items-center gap-1.5 ${className}`}
      role="status"
      aria-label={`Crawl status: ${config.label}. ${config.description}`}
    >
      <div 
        className={`
          ${sizeConfig.padding} 
          ${config.bgColor} 
          rounded-full 
          flex items-center justify-center
          transition-colors duration-200
        `}
        title={`${config.label}: ${config.description}`}
      >
        <Icon 
          size={sizeConfig.icon} 
          className={`
            ${config.color}
            ${config.animate ? 'animate-spin' : ''}
          `}
          aria-hidden="true"
        />
      </div>
      {showLabel && (
        <span className={`${sizeConfig.text} ${config.color} font-medium`}>
          {config.label}
        </span>
      )}
    </div>
  );
}

// Tooltip version with more details
export function CrawlStatusBadge({ 
  status, 
  progress,
  lastCrawlAt,
  size = 'md',
  className = '' 
}: CrawlStatusIconProps & { 
  progress?: number;
  lastCrawlAt?: string | null;
}) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;
  const isRunning = status === 'running' || status === 'queued';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div 
      className={`group relative inline-flex items-center gap-2 ${className}`}
      role="status"
      aria-label={`Crawl status: ${config.label}`}
    >
      {/* Icon */}
      <div 
        className={`
          ${sizeConfig.padding} 
          ${config.bgColor} 
          rounded-full 
          flex items-center justify-center
          transition-all duration-200
          group-hover:scale-110
        `}
      >
        <Icon 
          size={sizeConfig.icon} 
          className={`
            ${config.color}
            ${config.animate ? 'animate-spin' : ''}
          `}
          aria-hidden="true"
        />
      </div>

      {/* Progress bar for running status */}
      {isRunning && progress !== undefined && (
        <div className="flex items-center gap-2 min-w-[80px]">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 font-mono w-8">
            {progress}%
          </span>
        </div>
      )}

      {/* Tooltip */}
      <div className="
        absolute bottom-full left-1/2 -translate-x-1/2 mb-2
        px-3 py-2 
        bg-gray-900 text-white text-xs rounded-lg
        opacity-0 invisible
        group-hover:opacity-100 group-hover:visible
        transition-all duration-200
        whitespace-nowrap
        z-50
        shadow-lg
      ">
        <div className="font-semibold mb-1">{config.label}</div>
        <div className="text-gray-300">{config.description}</div>
        {lastCrawlAt && (
          <div className="text-gray-400 mt-1 text-[10px]">
            Last crawl: {formatDate(lastCrawlAt)}
          </div>
        )}
        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
          <div className="border-4 border-transparent border-t-gray-900" />
        </div>
      </div>
    </div>
  );
}

export default CrawlStatusIcon;
