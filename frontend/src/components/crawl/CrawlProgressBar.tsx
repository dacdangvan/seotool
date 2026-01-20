/**
 * CrawlProgressBar Component
 * 
 * Animated progress bar for crawl progress display
 * - Smooth transitions
 * - Color changes based on progress
 * - Optional labels and stats
 */

'use client';

interface CrawlProgressBarProps {
  progress: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showPercentage?: boolean;
  animated?: boolean;
  color?: 'blue' | 'green' | 'red' | 'yellow';
  className?: string;
}

const SIZE_CONFIG = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

const COLOR_CONFIG = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
};

export function CrawlProgressBar({
  progress,
  size = 'md',
  showLabel = false,
  showPercentage = true,
  animated = true,
  color = 'blue',
  className = '',
}: CrawlProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  
  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Progress</span>
          {showPercentage && (
            <span className="text-xs font-mono text-gray-500">{clampedProgress}%</span>
          )}
        </div>
      )}
      
      <div className={`
        w-full 
        ${SIZE_CONFIG[size]} 
        bg-gray-200 
        rounded-full 
        overflow-hidden
      `}>
        <div
          className={`
            ${SIZE_CONFIG[size]}
            ${COLOR_CONFIG[color]}
            rounded-full
            ${animated ? 'transition-all duration-500 ease-out' : ''}
          `}
          style={{ width: `${clampedProgress}%` }}
          role="progressbar"
          aria-valuenow={clampedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Crawl progress: ${clampedProgress}%`}
        />
      </div>
      
      {!showLabel && showPercentage && (
        <div className="flex justify-end mt-1">
          <span className="text-xs font-mono text-gray-500">{clampedProgress}%</span>
        </div>
      )}
    </div>
  );
}

/**
 * Detailed progress display with stats
 */
interface CrawlProgressDetailProps {
  progress: number;
  pagesProcessed?: number;
  totalPages?: number;
  urlsDiscovered?: number;
  issuesFound?: number;
  elapsedTime?: number;
  className?: string;
}

export function CrawlProgressDetail({
  progress,
  pagesProcessed = 0,
  totalPages,
  urlsDiscovered = 0,
  issuesFound = 0,
  elapsedTime,
  className = '',
}: CrawlProgressDetailProps) {
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Progress Bar */}
      <CrawlProgressBar 
        progress={progress} 
        showLabel 
        showPercentage 
        animated 
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
          <span className="text-gray-500">Pages</span>
          <span className="font-medium text-gray-900">
            {pagesProcessed}{totalPages ? `/${totalPages}` : ''}
          </span>
        </div>
        
        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
          <span className="text-gray-500">URLs Found</span>
          <span className="font-medium text-gray-900">{urlsDiscovered}</span>
        </div>
        
        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
          <span className="text-gray-500">Issues</span>
          <span className={`font-medium ${issuesFound > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
            {issuesFound}
          </span>
        </div>
        
        {elapsedTime !== undefined && (
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <span className="text-gray-500">Time</span>
            <span className="font-medium text-gray-900">{formatTime(elapsedTime)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default CrawlProgressBar;
