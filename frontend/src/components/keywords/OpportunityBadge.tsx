'use client';

/**
 * Opportunity Badge Component
 * 
 * Displays keyword opportunity score with:
 * - Color-coded badge (high/medium/low)
 * - Optional numeric score display
 * - Explanatory tooltip
 * - Multiple size variants
 */

import React, { useState } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import type { OpportunityLevel, Keyword } from '@/types/keyword.types';
import { OPPORTUNITY_CONFIG } from '@/types/keyword.types';
import { 
  Star, 
  TrendingUp, 
  Target, 
  BarChart3,
  HelpCircle,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

// Extended opportunity configuration with icons and colors
const OPPORTUNITY_EXTENDED: Record<OpportunityLevel, {
  icon: React.ElementType;
  gradient: string;
  borderColor: string;
  scoreRange: string;
  factors: string[];
}> = {
  high: {
    icon: Star,
    gradient: 'from-green-500 to-emerald-600',
    borderColor: 'border-green-500',
    scoreRange: '70-100',
    factors: [
      'High search volume relative to difficulty',
      'Low to medium competition',
      'Strong ranking potential',
      'Good conversion intent',
    ],
  },
  medium: {
    icon: TrendingUp,
    gradient: 'from-yellow-500 to-amber-600',
    borderColor: 'border-yellow-500',
    scoreRange: '40-69',
    factors: [
      'Balanced search volume and difficulty',
      'Moderate competition',
      'Achievable with effort',
      'Worth targeting with strategy',
    ],
  },
  low: {
    icon: AlertCircle,
    gradient: 'from-gray-400 to-gray-500',
    borderColor: 'border-gray-400',
    scoreRange: '0-39',
    factors: [
      'Low search volume or high difficulty',
      'Strong competition',
      'May require significant resources',
      'Consider as secondary targets',
    ],
  },
};

interface OpportunityBadgeProps {
  opportunity: OpportunityLevel;
  score?: number; // Optional numeric score (0-100)
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showScore?: boolean;
  showTooltip?: boolean;
  showIcon?: boolean;
  variant?: 'default' | 'pill' | 'compact' | 'detailed';
  className?: string;
}

interface OpportunityTooltipProps {
  opportunity: OpportunityLevel;
  score?: number;
  onClose: () => void;
}

/**
 * Calculate opportunity score from keyword data
 * Score = (Volume Factor * 0.4) + (Difficulty Factor * 0.4) + (Intent Factor * 0.2)
 */
export function calculateOpportunityScore(keyword: Keyword): number {
  // Volume factor (0-100): Higher volume = higher score (logarithmic scale)
  const volumeFactor = Math.min(100, Math.log10(keyword.searchVolume + 1) * 25);
  
  // Difficulty factor (0-100): Lower difficulty = higher score
  const difficultyFactor = 100 - keyword.difficulty;
  
  // Intent factor (0-100): Transactional/commercial > informational > navigational
  const intentScores = {
    transactional: 100,
    commercial: 80,
    informational: 50,
    navigational: 30,
  };
  const intentFactor = intentScores[keyword.intent] || 50;
  
  // Weighted calculation
  const score = (volumeFactor * 0.4) + (difficultyFactor * 0.4) + (intentFactor * 0.2);
  
  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Get opportunity level from score
 */
export function getOpportunityLevel(score: number): OpportunityLevel {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function OpportunityTooltip({ opportunity, score, onClose }: OpportunityTooltipProps) {
  const config = OPPORTUNITY_CONFIG[opportunity];
  const extended = OPPORTUNITY_EXTENDED[opportunity];
  const Icon = extended.icon;

  return (
    <div className="absolute z-50 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-4 left-0 top-full mt-2">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            'p-2 rounded-lg bg-gradient-to-br text-white',
            extended.gradient
          )}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className={cn('font-semibold', config.color)}>{config.label}</div>
            {score !== undefined && (
              <div className="text-sm text-gray-500">Score: {score}/100</div>
            )}
          </div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-3">{config.description}</p>

      {/* Score Range */}
      <div className="mb-3">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
          Score Range
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={cn('h-full bg-gradient-to-r', extended.gradient)}
              style={{ 
                width: opportunity === 'high' ? '100%' : opportunity === 'medium' ? '69%' : '39%',
                marginLeft: opportunity === 'high' ? '70%' : opportunity === 'medium' ? '40%' : '0%',
              }}
            />
          </div>
          <span className="text-xs text-gray-600 font-medium">{extended.scoreRange}</span>
        </div>
      </div>

      {/* Factors */}
      <div className="mb-3">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
          What This Means
        </div>
        <ul className="space-y-1">
          {extended.factors.map((factor, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
              <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{factor}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Score Formula */}
      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
        <div className="text-xs font-medium text-blue-800 mb-1">📊 How Score is Calculated</div>
        <p className="text-xs text-blue-700">
          Score = (Volume × 40%) + (100 - Difficulty) × 40% + (Intent × 20%)
        </p>
      </div>
    </div>
  );
}

export function OpportunityBadge({
  opportunity,
  score,
  size = 'md',
  showScore = false,
  showTooltip = true,
  showIcon = true,
  variant = 'default',
  className,
}: OpportunityBadgeProps) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const config = OPPORTUNITY_CONFIG[opportunity];
  const extended = OPPORTUNITY_EXTENDED[opportunity];
  const Icon = extended.icon;

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-xs gap-0.5',
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-sm gap-1.5',
    lg: 'px-3 py-1.5 text-base gap-2',
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  // Compact variant - just the score with color
  if (variant === 'compact') {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => showTooltip && setIsTooltipOpen(!isTooltipOpen)}
          onMouseEnter={() => showTooltip && setIsTooltipOpen(true)}
          onMouseLeave={() => showTooltip && setIsTooltipOpen(false)}
          className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm',
            config.bgColor,
            config.color,
            showTooltip && 'cursor-help',
            className
          )}
        >
          {score !== undefined ? score : opportunity === 'high' ? '★' : opportunity === 'medium' ? '◆' : '○'}
        </button>
        {isTooltipOpen && showTooltip && (
          <OpportunityTooltip 
            opportunity={opportunity} 
            score={score}
            onClose={() => setIsTooltipOpen(false)} 
          />
        )}
      </div>
    );
  }

  // Detailed variant - card style with more info
  if (variant === 'detailed') {
    return (
      <div className={cn(
        'inline-flex items-center gap-3 px-4 py-3 rounded-xl border-2',
        config.bgColor,
        extended.borderColor,
        className
      )}>
        <div className={cn(
          'p-2 rounded-lg bg-gradient-to-br text-white',
          extended.gradient
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className={cn('font-semibold', config.color)}>{config.label}</div>
          {score !== undefined && (
            <div className="text-sm text-gray-500">Score: {score}/100</div>
          )}
        </div>
      </div>
    );
  }

  // Default and Pill variants
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => showTooltip && setIsTooltipOpen(!isTooltipOpen)}
        onMouseEnter={() => showTooltip && setIsTooltipOpen(true)}
        onMouseLeave={() => showTooltip && setIsTooltipOpen(false)}
        className={cn(
          'inline-flex items-center font-medium transition-all',
          variant === 'pill' ? 'rounded-full' : 'rounded-lg',
          config.bgColor,
          config.color,
          sizeClasses[size],
          showTooltip && 'cursor-help hover:ring-2 hover:ring-offset-1',
          showTooltip && opportunity === 'high' && 'hover:ring-green-300',
          showTooltip && opportunity === 'medium' && 'hover:ring-yellow-300',
          showTooltip && opportunity === 'low' && 'hover:ring-gray-300',
          className
        )}
      >
        {showIcon && <Icon className={iconSizes[size]} />}
        {showScore && score !== undefined ? (
          <span>{score}</span>
        ) : (
          <span>{config.label}</span>
        )}
        {showTooltip && <HelpCircle className={cn('opacity-50', iconSizes[size])} />}
      </button>

      {isTooltipOpen && showTooltip && (
        <OpportunityTooltip 
          opportunity={opportunity} 
          score={score}
          onClose={() => setIsTooltipOpen(false)} 
        />
      )}
    </div>
  );
}

/**
 * Opportunity Score Bar
 * Visual progress bar showing opportunity score
 */
export function OpportunityScoreBar({ 
  score,
  showLabel = true,
  height = 8,
  className,
}: { 
  score: number;
  showLabel?: boolean;
  height?: number;
  className?: string;
}) {
  const level = getOpportunityLevel(score);
  const extended = OPPORTUNITY_EXTENDED[level];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div 
        className="flex-1 bg-gray-200 rounded-full overflow-hidden"
        style={{ height }}
      >
        <div 
          className={cn('h-full bg-gradient-to-r transition-all', extended.gradient)}
          style={{ width: `${score}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn('text-sm font-medium min-w-[2.5rem] text-right', OPPORTUNITY_CONFIG[level].color)}>
          {score}
        </span>
      )}
    </div>
  );
}

/**
 * Opportunity Legend
 * Shows all opportunity levels with explanations
 */
export function OpportunityLegend({ className }: { className?: string }) {
  const [expandedLevel, setExpandedLevel] = useState<OpportunityLevel | null>(null);
  const levels: OpportunityLevel[] = ['high', 'medium', 'low'];

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-yellow-500" />
        <h3 className="font-medium text-gray-900">Opportunity Score Guide</h3>
      </div>
      
      <div className="space-y-2">
        {levels.map(level => {
          const config = OPPORTUNITY_CONFIG[level];
          const extended = OPPORTUNITY_EXTENDED[level];
          const Icon = extended.icon;
          const isExpanded = expandedLevel === level;

          return (
            <div 
              key={level}
              className={cn(
                'rounded-lg border transition-all cursor-pointer',
                isExpanded ? cn('border-2', extended.borderColor, config.bgColor) : 'border-transparent hover:bg-gray-50'
              )}
            >
              <button
                type="button"
                onClick={() => setExpandedLevel(isExpanded ? null : level)}
                className="w-full flex items-center gap-3 p-2"
              >
                <div className={cn(
                  'p-1.5 rounded-lg bg-gradient-to-br text-white',
                  extended.gradient
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-medium text-sm', config.color)}>
                      {config.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({extended.scoreRange})
                    </span>
                  </div>
                  {!isExpanded && (
                    <p className="text-xs text-gray-500 truncate">{config.description}</p>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3">
                  <p className="text-sm text-gray-600 mb-2">{config.description}</p>
                  <ul className="space-y-1">
                    {extended.factors.map((factor, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Opportunity Distribution Summary
 * Shows count of keywords by opportunity level
 */
export function OpportunityDistribution({ 
  high, 
  medium, 
  low,
  total,
  className,
}: { 
  high: number;
  medium: number;
  low: number;
  total: number;
  className?: string;
}) {
  const getPercentage = (count: number) => total > 0 ? ((count / total) * 100).toFixed(1) : '0';

  return (
    <div className={cn('space-y-2', className)}>
      {/* Stacked bar */}
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
        {high > 0 && (
          <div 
            className="bg-gradient-to-r from-green-500 to-emerald-600 transition-all"
            style={{ width: `${getPercentage(high)}%` }}
            title={`High: ${high} (${getPercentage(high)}%)`}
          />
        )}
        {medium > 0 && (
          <div 
            className="bg-gradient-to-r from-yellow-500 to-amber-600 transition-all"
            style={{ width: `${getPercentage(medium)}%` }}
            title={`Medium: ${medium} (${getPercentage(medium)}%)`}
          />
        )}
        {low > 0 && (
          <div 
            className="bg-gradient-to-r from-gray-400 to-gray-500 transition-all"
            style={{ width: `${getPercentage(low)}%` }}
            title={`Low: ${low} (${getPercentage(low)}%)`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-600" />
          <span className="text-gray-600">High: {high}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-yellow-500 to-amber-600" />
          <span className="text-gray-600">Medium: {medium}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-gray-400 to-gray-500" />
          <span className="text-gray-600">Low: {low}</span>
        </div>
      </div>
    </div>
  );
}

export default OpportunityBadge;
