'use client';

/**
 * Mapping Status Badge Component
 * 
 * Display keyword-to-page mapping status with visual indicators for:
 * - Mapped status (mapped/unmapped)
 * - Cannibalization warnings (multiple keywords → same page)
 * - Conflict warnings (same keyword → multiple pages)
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Module 1 – Keyword Intelligence Agent
 */

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Link2,
  Link2Off,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Copy,
  Layers,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type MappingStatus = 
  | 'mapped'           // Keyword is mapped to exactly one page
  | 'unmapped'         // Keyword has no mapped page
  | 'cannibalization'  // Multiple keywords targeting same page
  | 'conflict';        // Same keyword mapped to multiple pages

export interface KeywordMapping {
  keywordId: string;
  keyword: string;
  mappedUrls: string[];
  status: MappingStatus;
  competingKeywords?: string[];  // Other keywords targeting same page
  cannibalizationRisk?: 'low' | 'medium' | 'high';
}

export interface MappingStatusConfig {
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const MAPPING_STATUS_CONFIG: Record<MappingStatus, MappingStatusConfig> = {
  mapped: {
    label: 'Mapped',
    shortLabel: 'OK',
    description: 'Keyword is properly mapped to a target page',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: CheckCircle2,
  },
  unmapped: {
    label: 'Unmapped',
    shortLabel: 'None',
    description: 'No target page assigned for this keyword',
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    icon: Link2Off,
  },
  cannibalization: {
    label: 'Cannibalization',
    shortLabel: 'Cannibal',
    description: 'Multiple keywords targeting the same page may compete against each other',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: Copy,
  },
  conflict: {
    label: 'Conflict',
    shortLabel: 'Conflict',
    description: 'Same keyword mapped to multiple pages - needs resolution',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: AlertCircle,
  },
};

export const CANNIBALIZATION_RISK_CONFIG: Record<'low' | 'medium' | 'high', {
  label: string;
  color: string;
  bgColor: string;
}> = {
  low: {
    label: 'Low Risk',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  medium: {
    label: 'Medium Risk',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
  },
  high: {
    label: 'High Risk',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
};

// =============================================================================
// MAPPING STATUS BADGE
// =============================================================================

interface MappingStatusBadgeProps {
  status: MappingStatus;
  variant?: 'default' | 'compact' | 'detailed';
  size?: 'xs' | 'sm' | 'md';
  showTooltip?: boolean;
  urlCount?: number;
  competingCount?: number;
  className?: string;
}

export function MappingStatusBadge({
  status,
  variant = 'default',
  size = 'sm',
  showTooltip = true,
  urlCount,
  competingCount,
  className,
}: MappingStatusBadgeProps) {
  const config = MAPPING_STATUS_CONFIG[status];
  const Icon = config.icon;

  const sizeStyles = {
    xs: 'text-xs px-1.5 py-0.5 gap-1',
    sm: 'text-xs px-2 py-1 gap-1.5',
    md: 'text-sm px-2.5 py-1.5 gap-2',
  };

  const iconSizes = {
    xs: 'h-3 w-3',
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
  };

  if (variant === 'compact') {
    return (
      <span 
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          sizeStyles[size],
          config.bgColor,
          config.color,
          className
        )}
        title={showTooltip ? config.description : undefined}
      >
        <Icon className={iconSizes[size]} />
      </span>
    );
  }

  if (variant === 'detailed') {
    return (
      <div 
        className={cn(
          'inline-flex flex-col rounded-lg border p-2',
          config.bgColor,
          config.borderColor,
          className
        )}
      >
        <div className={cn('flex items-center gap-2', config.color)}>
          <Icon className={iconSizes[size]} />
          <span className="font-medium">{config.label}</span>
        </div>
        {(urlCount !== undefined || competingCount !== undefined) && (
          <div className="mt-1 text-xs text-gray-600">
            {urlCount !== undefined && (
              <span>{urlCount} URL{urlCount !== 1 ? 's' : ''}</span>
            )}
            {competingCount !== undefined && competingCount > 0 && (
              <span className="ml-2 text-amber-600">
                {competingCount} competing
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <span 
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        sizeStyles[size],
        config.bgColor,
        config.color,
        className
      )}
      title={showTooltip ? config.description : undefined}
    >
      <Icon className={iconSizes[size]} />
      <span>{config.shortLabel}</span>
      {urlCount !== undefined && urlCount > 1 && (
        <span className="ml-1 text-gray-500">({urlCount})</span>
      )}
    </span>
  );
}

// =============================================================================
// CANNIBALIZATION WARNING BADGE
// =============================================================================

interface CannibalizationWarningProps {
  risk: 'low' | 'medium' | 'high';
  competingKeywords: string[];
  targetUrl: string;
  showDetails?: boolean;
  className?: string;
}

export function CannibalizationWarning({
  risk,
  competingKeywords,
  targetUrl,
  showDetails = false,
  className,
}: CannibalizationWarningProps) {
  const riskConfig = CANNIBALIZATION_RISK_CONFIG[risk];

  return (
    <div 
      className={cn(
        'rounded-lg border p-3',
        risk === 'high' && 'border-red-200 bg-red-50',
        risk === 'medium' && 'border-amber-200 bg-amber-50',
        risk === 'low' && 'border-yellow-200 bg-yellow-50',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className={cn(
          'h-5 w-5 flex-shrink-0 mt-0.5',
          risk === 'high' && 'text-red-600',
          risk === 'medium' && 'text-amber-600',
          risk === 'low' && 'text-yellow-600',
        )} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              Cannibalization Warning
            </span>
            <span className={cn(
              'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
              riskConfig.bgColor,
              riskConfig.color,
            )}>
              {riskConfig.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {competingKeywords.length + 1} keywords targeting the same page
          </p>
          
          {showDetails && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase">
                Target URL
              </p>
              <p className="text-sm text-blue-600 truncate">
                {targetUrl}
              </p>
              <p className="text-xs font-medium text-gray-500 uppercase mt-2">
                Competing Keywords
              </p>
              <div className="flex flex-wrap gap-1">
                {competingKeywords.slice(0, 5).map((kw, i) => (
                  <span 
                    key={i}
                    className="inline-flex px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700"
                  >
                    {kw}
                  </span>
                ))}
                {competingKeywords.length > 5 && (
                  <span className="text-xs text-gray-500">
                    +{competingKeywords.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CONFLICT WARNING BADGE
// =============================================================================

interface ConflictWarningProps {
  keyword: string;
  conflictingUrls: string[];
  showDetails?: boolean;
  className?: string;
}

export function ConflictWarning({
  keyword,
  conflictingUrls,
  showDetails = false,
  className,
}: ConflictWarningProps) {
  return (
    <div 
      className={cn(
        'rounded-lg border border-red-200 bg-red-50 p-3',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-600" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              Mapping Conflict
            </span>
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              Needs Resolution
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Keyword "{keyword}" is mapped to {conflictingUrls.length} different pages
          </p>
          
          {showDetails && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase">
                Conflicting URLs
              </p>
              <div className="space-y-1">
                {conflictingUrls.map((url, i) => (
                  <p 
                    key={i}
                    className="text-sm text-blue-600 truncate"
                  >
                    {i + 1}. {url}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAPPING STATUS LEGEND
// =============================================================================

interface MappingStatusLegendProps {
  showDescription?: boolean;
  className?: string;
}

export function MappingStatusLegend({
  showDescription = true,
  className,
}: MappingStatusLegendProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <h4 className="text-sm font-medium text-gray-700">Mapping Status Legend</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.entries(MAPPING_STATUS_CONFIG) as [MappingStatus, MappingStatusConfig][]).map(
          ([status, config]) => {
            const Icon = config.icon;
            return (
              <div 
                key={status}
                className={cn(
                  'flex items-start gap-2 p-2 rounded-lg border',
                  config.bgColor,
                  config.borderColor,
                )}
              >
                <Icon className={cn('h-4 w-4 mt-0.5', config.color)} />
                <div>
                  <span className={cn('font-medium text-sm', config.color)}>
                    {config.label}
                  </span>
                  {showDescription && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {config.description}
                    </p>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAPPING STATS SUMMARY
// =============================================================================

interface MappingStats {
  total: number;
  mapped: number;
  unmapped: number;
  cannibalization: number;
  conflict: number;
}

interface MappingStatsSummaryProps {
  stats: MappingStats;
  className?: string;
}

export function MappingStatsSummary({ stats, className }: MappingStatsSummaryProps) {
  const items: { status: MappingStatus; count: number; percentage: number }[] = [
    { 
      status: 'mapped', 
      count: stats.mapped,
      percentage: stats.total > 0 ? (stats.mapped / stats.total) * 100 : 0,
    },
    { 
      status: 'unmapped', 
      count: stats.unmapped,
      percentage: stats.total > 0 ? (stats.unmapped / stats.total) * 100 : 0,
    },
    { 
      status: 'cannibalization', 
      count: stats.cannibalization,
      percentage: stats.total > 0 ? (stats.cannibalization / stats.total) * 100 : 0,
    },
    { 
      status: 'conflict', 
      count: stats.conflict,
      percentage: stats.total > 0 ? (stats.conflict / stats.total) * 100 : 0,
    },
  ];

  return (
    <div className={cn('space-y-3', className)}>
      {/* Stacked bar */}
      <div className="h-3 rounded-full overflow-hidden flex bg-gray-100">
        {items.map(({ status, percentage }) => {
          const config = MAPPING_STATUS_CONFIG[status];
          if (percentage === 0) return null;
          return (
            <div
              key={status}
              className={cn(
                'h-full transition-all',
                status === 'mapped' && 'bg-green-500',
                status === 'unmapped' && 'bg-gray-300',
                status === 'cannibalization' && 'bg-amber-500',
                status === 'conflict' && 'bg-red-500',
              )}
              style={{ width: `${percentage}%` }}
              title={`${config.label}: ${percentage.toFixed(1)}%`}
            />
          );
        })}
      </div>

      {/* Legend with counts */}
      <div className="flex flex-wrap gap-4 text-sm">
        {items.map(({ status, count, percentage }) => {
          const config = MAPPING_STATUS_CONFIG[status];
          const Icon = config.icon;
          return (
            <div key={status} className="flex items-center gap-1.5">
              <Icon className={cn('h-4 w-4', config.color)} />
              <span className={cn('font-medium', config.color)}>
                {count}
              </span>
              <span className="text-gray-500">
                {config.shortLabel} ({percentage.toFixed(0)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Determine mapping status based on URLs and competing keywords
 */
export function getMappingStatus(
  mappedUrls: string[],
  competingKeywords?: string[]
): MappingStatus {
  if (mappedUrls.length === 0) {
    return 'unmapped';
  }
  if (mappedUrls.length > 1) {
    return 'conflict';
  }
  if (competingKeywords && competingKeywords.length > 0) {
    return 'cannibalization';
  }
  return 'mapped';
}

/**
 * Calculate cannibalization risk based on competing keywords
 */
export function calculateCannibalizationRisk(
  competingKeywordsCount: number
): 'low' | 'medium' | 'high' {
  if (competingKeywordsCount >= 5) return 'high';
  if (competingKeywordsCount >= 3) return 'medium';
  return 'low';
}
