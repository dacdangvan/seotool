'use client';

/**
 * Keyword Action Card Component
 * 
 * Display AI-generated actionable suggestions per keyword/cluster:
 * - Action type and description
 * - Expected impact metrics
 * - Confidence level
 * - Approve / Ignore actions (role-based)
 * - Execution status tracking
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Module 1 – Keyword Intelligence Agent
 * Integrates with v1.x Autonomous Decision Layer
 */

import React, { useState, useMemo, useCallback } from 'react';
import { cn, formatNumber, formatCompact, formatPercent } from '@/lib/utils';
import type { SearchIntent, OpportunityLevel } from '@/types/keyword.types';
import { SEARCH_INTENT_CONFIG, OPPORTUNITY_CONFIG } from '@/types/keyword.types';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  FileText,
  Link2,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  BarChart3,
  Lightbulb,
  Shield,
  Info,
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type ActionType =
  | 'create_content'      // Create new content for keyword
  | 'optimize_content'    // Optimize existing content
  | 'add_internal_link'   // Add internal links
  | 'update_meta'         // Update meta title/description
  | 'expand_cluster'      // Expand keyword cluster
  | 'fix_cannibalization' // Resolve keyword cannibalization
  | 'target_featured'     // Target featured snippet
  | 'improve_ranking';    // General ranking improvement

export type ActionPriority = 'critical' | 'high' | 'medium' | 'low';

export type ActionStatus = 
  | 'pending'     // Awaiting decision
  | 'approved'    // Approved, awaiting execution
  | 'executing'   // Currently being executed
  | 'completed'   // Successfully executed
  | 'failed'      // Execution failed
  | 'ignored';    // User chose to ignore

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ExpectedImpact {
  trafficChange: number;        // Expected % traffic change
  rankingChange: number;        // Expected ranking positions
  timeToImpact: string;         // e.g., "2-4 weeks"
  confidenceScore: number;      // 0-100
}

export interface KeywordAction {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  reasoning: string;            // AI explanation for this suggestion
  priority: ActionPriority;
  status: ActionStatus;
  confidence: ConfidenceLevel;
  expectedImpact: ExpectedImpact;
  
  // Target info
  keywordId?: string;
  keyword?: string;
  clusterId?: string;
  clusterName?: string;
  targetUrl?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: 'ai' | 'user';
  approvedBy?: string;
  executedAt?: string;
  
  // Risk assessment (from v1.1)
  riskLevel: 'safe' | 'low' | 'medium' | 'high';
  reversible: boolean;
}

export interface ActionTypeConfig {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const ACTION_TYPE_CONFIG: Record<ActionType, ActionTypeConfig> = {
  create_content: {
    label: 'Create Content',
    description: 'Generate new SEO-optimized content',
    icon: FileText,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  optimize_content: {
    label: 'Optimize Content',
    description: 'Improve existing content for better rankings',
    icon: Sparkles,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
  },
  add_internal_link: {
    label: 'Add Internal Link',
    description: 'Create internal links for better authority flow',
    icon: Link2,
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
  },
  update_meta: {
    label: 'Update Meta Tags',
    description: 'Improve title and meta description',
    icon: Target,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
  },
  expand_cluster: {
    label: 'Expand Cluster',
    description: 'Add related keywords to topic cluster',
    icon: Zap,
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
  },
  fix_cannibalization: {
    label: 'Fix Cannibalization',
    description: 'Resolve keyword competition between pages',
    icon: AlertTriangle,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
  },
  target_featured: {
    label: 'Target Featured Snippet',
    description: 'Optimize for position zero',
    icon: BarChart3,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
  },
  improve_ranking: {
    label: 'Improve Ranking',
    description: 'General ranking optimization',
    icon: TrendingUp,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
  },
};

export const PRIORITY_CONFIG: Record<ActionPriority, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  critical: {
    label: 'Critical',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
  },
  high: {
    label: 'High',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
  },
  medium: {
    label: 'Medium',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
  },
  low: {
    label: 'Low',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
  },
};

export const STATUS_CONFIG: Record<ActionStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  pending: {
    label: 'Pending Review',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: CheckCircle2,
  },
  executing: {
    label: 'Executing',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    icon: Loader2,
  },
  completed: {
    label: 'Completed',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: XCircle,
  },
  ignored: {
    label: 'Ignored',
    color: 'text-gray-400',
    bgColor: 'bg-gray-50',
    icon: EyeOff,
  },
};

export const CONFIDENCE_CONFIG: Record<ConfidenceLevel, {
  label: string;
  color: string;
  bgColor: string;
  minScore: number;
}> = {
  high: {
    label: 'High Confidence',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    minScore: 80,
  },
  medium: {
    label: 'Medium Confidence',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    minScore: 60,
  },
  low: {
    label: 'Low Confidence',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    minScore: 0,
  },
};

export const RISK_CONFIG: Record<KeywordAction['riskLevel'], {
  label: string;
  color: string;
  bgColor: string;
}> = {
  safe: {
    label: 'Safe',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  low: {
    label: 'Low Risk',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  medium: {
    label: 'Medium Risk',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  high: {
    label: 'High Risk',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface PriorityBadgeProps {
  priority: ActionPriority;
  size?: 'xs' | 'sm' | 'md';
}

export function PriorityBadge({ priority, size = 'sm' }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];
  const sizeStyles = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium',
      sizeStyles[size],
      config.bgColor,
      config.color,
    )}>
      {config.label}
    </span>
  );
}

interface StatusBadgeProps {
  status: ActionStatus;
  size?: 'xs' | 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const sizeStyles = {
    xs: 'text-xs px-1.5 py-0.5 gap-1',
    sm: 'text-xs px-2 py-1 gap-1.5',
    md: 'text-sm px-2.5 py-1 gap-1.5',
  };
  const iconSizes = {
    xs: 'h-3 w-3',
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
  };

  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium',
      sizeStyles[size],
      config.bgColor,
      config.color,
    )}>
      <Icon className={cn(
        iconSizes[size],
        status === 'executing' && 'animate-spin'
      )} />
      {config.label}
    </span>
  );
}

interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel;
  score?: number;
  showScore?: boolean;
}

export function ConfidenceBadge({ confidence, score, showScore = false }: ConfidenceBadgeProps) {
  const config = CONFIDENCE_CONFIG[confidence];

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full text-xs px-2 py-1 font-medium',
      config.bgColor,
      config.color,
    )}>
      <Lightbulb className="h-3 w-3" />
      {showScore && score !== undefined ? `${score}%` : config.label}
    </span>
  );
}

interface RiskBadgeProps {
  riskLevel: KeywordAction['riskLevel'];
  reversible?: boolean;
}

export function RiskBadge({ riskLevel, reversible }: RiskBadgeProps) {
  const config = RISK_CONFIG[riskLevel];

  return (
    <div className="flex items-center gap-2">
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full text-xs px-2 py-1 font-medium',
        config.bgColor,
        config.color,
      )}>
        <Shield className="h-3 w-3" />
        {config.label}
      </span>
      {reversible && (
        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
          <RotateCcw className="h-3 w-3" />
          Reversible
        </span>
      )}
    </div>
  );
}

interface ImpactPreviewProps {
  impact: ExpectedImpact;
  compact?: boolean;
}

export function ImpactPreview({ impact, compact = false }: ImpactPreviewProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <div className={cn(
          'flex items-center gap-1',
          impact.trafficChange > 0 ? 'text-green-600' : 'text-red-600'
        )}>
          {impact.trafficChange > 0 ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}
          <span>{formatPercent(impact.trafficChange)} traffic</span>
        </div>
        <span className="text-gray-400">•</span>
        <span className="text-gray-600">{impact.timeToImpact}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-500 mb-1">Traffic Change</p>
        <p className={cn(
          'text-lg font-bold flex items-center gap-1',
          impact.trafficChange > 0 ? 'text-green-600' : 'text-red-600'
        )}>
          {impact.trafficChange > 0 ? (
            <TrendingUp className="h-5 w-5" />
          ) : (
            <TrendingDown className="h-5 w-5" />
          )}
          {formatPercent(impact.trafficChange)}
        </p>
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-500 mb-1">Ranking Change</p>
        <p className={cn(
          'text-lg font-bold',
          impact.rankingChange > 0 ? 'text-green-600' : 'text-red-600'
        )}>
          {impact.rankingChange > 0 ? '+' : ''}{impact.rankingChange} positions
        </p>
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-500 mb-1">Time to Impact</p>
        <p className="text-lg font-bold text-gray-700 flex items-center gap-1">
          <Clock className="h-5 w-5" />
          {impact.timeToImpact}
        </p>
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-500 mb-1">Confidence</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={cn(
                'h-full rounded-full transition-all',
                impact.confidenceScore >= 80 && 'bg-green-500',
                impact.confidenceScore >= 60 && impact.confidenceScore < 80 && 'bg-yellow-500',
                impact.confidenceScore < 60 && 'bg-red-500',
              )}
              style={{ width: `${impact.confidenceScore}%` }}
            />
          </div>
          <span className="text-sm font-bold text-gray-700">{impact.confidenceScore}%</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT: KeywordActionCard
// =============================================================================

interface KeywordActionCardProps {
  action: KeywordAction;
  canApprove?: boolean;
  canExecute?: boolean;
  onApprove?: (actionId: string) => void;
  onIgnore?: (actionId: string) => void;
  onExecute?: (actionId: string) => void;
  onRetry?: (actionId: string) => void;
  onViewDetails?: (actionId: string) => void;
  variant?: 'default' | 'compact' | 'expanded';
  className?: string;
}

export function KeywordActionCard({
  action,
  canApprove = false,
  canExecute = false,
  onApprove,
  onIgnore,
  onExecute,
  onRetry,
  onViewDetails,
  variant = 'default',
  className,
}: KeywordActionCardProps) {
  const [isExpanded, setIsExpanded] = useState(variant === 'expanded');
  const [isApproving, setIsApproving] = useState(false);
  const [isIgnoring, setIsIgnoring] = useState(false);

  const typeConfig = ACTION_TYPE_CONFIG[action.type];
  const TypeIcon = typeConfig.icon;

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsApproving(true);
    try {
      await onApprove(action.id);
    } finally {
      setIsApproving(false);
    }
  };

  const handleIgnore = async () => {
    if (!onIgnore) return;
    setIsIgnoring(true);
    try {
      await onIgnore(action.id);
    } finally {
      setIsIgnoring(false);
    }
  };

  const canTakeAction = action.status === 'pending' && canApprove;
  const canRunExecution = action.status === 'approved' && canExecute;
  const canRetryAction = action.status === 'failed' && canExecute;

  if (variant === 'compact') {
    return (
      <div 
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border transition-colors',
          'hover:bg-gray-50',
          action.status === 'ignored' && 'opacity-60',
          className
        )}
      >
        <div className={cn(
          'p-2 rounded-lg flex-shrink-0',
          typeConfig.bgColor
        )}>
          <TypeIcon className={cn('h-4 w-4', typeConfig.color)} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">
              {action.title}
            </span>
            <PriorityBadge priority={action.priority} size="xs" />
          </div>
          {action.keyword && (
            <span className="text-sm text-gray-500 truncate block">
              {action.keyword}
            </span>
          )}
        </div>

        <ImpactPreview impact={action.expectedImpact} compact />
        
        <StatusBadge status={action.status} size="xs" />

        {canTakeAction && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleApprove}
              disabled={isApproving}
              className="p-1.5 rounded hover:bg-green-100 text-green-600"
              title="Approve"
            >
              <ThumbsUp className="h-4 w-4" />
            </button>
            <button
              onClick={handleIgnore}
              disabled={isIgnoring}
              className="p-1.5 rounded hover:bg-gray-200 text-gray-500"
              title="Ignore"
            >
              <ThumbsDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Default/Expanded variant
  return (
    <div 
      className={cn(
        'rounded-lg border transition-all',
        action.priority === 'critical' && 'border-red-200 bg-red-50/30',
        action.priority === 'high' && 'border-orange-200',
        action.status === 'ignored' && 'opacity-60',
        className
      )}
    >
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className={cn(
          'p-2.5 rounded-lg flex-shrink-0',
          typeConfig.bgColor
        )}>
          <TypeIcon className={cn('h-5 w-5', typeConfig.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900">
                  {action.title}
                </h3>
                <PriorityBadge priority={action.priority} />
                <StatusBadge status={action.status} />
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {action.description}
              </p>
            </div>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-100 rounded flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>

          {/* Target info */}
          {(action.keyword || action.clusterName || action.targetUrl) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {action.keyword && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-gray-700">
                  <Target className="h-3 w-3" />
                  {action.keyword}
                </span>
              )}
              {action.clusterName && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 rounded text-purple-700">
                  Cluster: {action.clusterName}
                </span>
              )}
              {action.targetUrl && (
                <a 
                  href={action.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 rounded text-blue-700 hover:bg-blue-200"
                >
                  <ExternalLink className="h-3 w-3" />
                  Target Page
                </a>
              )}
            </div>
          )}

          {/* Quick impact preview */}
          {!isExpanded && (
            <div className="mt-3">
              <ImpactPreview impact={action.expectedImpact} compact />
            </div>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* AI Reasoning */}
          <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-800 mb-1">
              <Sparkles className="h-4 w-4" />
              AI Reasoning
            </div>
            <p className="text-sm text-gray-700">{action.reasoning}</p>
          </div>

          {/* Impact metrics */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Expected Impact</h4>
            <ImpactPreview impact={action.expectedImpact} />
          </div>

          {/* Risk & Confidence */}
          <div className="flex items-center justify-between">
            <RiskBadge riskLevel={action.riskLevel} reversible={action.reversible} />
            <ConfidenceBadge 
              confidence={action.confidence} 
              score={action.expectedImpact.confidenceScore}
              showScore
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              {action.createdBy === 'ai' ? 'AI Generated' : 'User Created'} • {action.createdAt}
            </div>

            <div className="flex items-center gap-2">
              {onViewDetails && (
                <button
                  onClick={() => onViewDetails(action.id)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1"
                >
                  <Eye className="h-4 w-4" />
                  Details
                </button>
              )}

              {canRetryAction && onRetry && (
                <button
                  onClick={() => onRetry(action.id)}
                  className="px-3 py-1.5 text-sm text-orange-600 hover:bg-orange-100 rounded-lg flex items-center gap-1"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retry
                </button>
              )}

              {canRunExecution && onExecute && (
                <button
                  onClick={() => onExecute(action.id)}
                  className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1"
                >
                  <Play className="h-4 w-4" />
                  Execute
                </button>
              )}

              {canTakeAction && (
                <>
                  <button
                    onClick={handleIgnore}
                    disabled={isIgnoring}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg flex items-center gap-1',
                      'text-gray-600 hover:bg-gray-100',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {isIgnoring ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ThumbsDown className="h-4 w-4" />
                    )}
                    Ignore
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={isApproving}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg flex items-center gap-1',
                      'text-white bg-green-600 hover:bg-green-700',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {isApproving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-4 w-4" />
                    )}
                    Approve
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ACTION LIST COMPONENT
// =============================================================================

interface KeywordActionListProps {
  actions: KeywordAction[];
  loading?: boolean;
  canApprove?: boolean;
  canExecute?: boolean;
  onApprove?: (actionId: string) => void;
  onIgnore?: (actionId: string) => void;
  onExecute?: (actionId: string) => void;
  onRetry?: (actionId: string) => void;
  onViewDetails?: (actionId: string) => void;
  variant?: 'default' | 'compact';
  showFilters?: boolean;
  className?: string;
}

export function KeywordActionList({
  actions,
  loading = false,
  canApprove = false,
  canExecute = false,
  onApprove,
  onIgnore,
  onExecute,
  onRetry,
  onViewDetails,
  variant = 'default',
  showFilters = true,
  className,
}: KeywordActionListProps) {
  const [filterType, setFilterType] = useState<ActionType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ActionStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<ActionPriority | 'all'>('all');
  const [showIgnored, setShowIgnored] = useState(false);

  const filteredActions = useMemo(() => {
    return actions.filter(action => {
      if (!showIgnored && action.status === 'ignored') return false;
      if (filterType !== 'all' && action.type !== filterType) return false;
      if (filterStatus !== 'all' && action.status !== filterStatus) return false;
      if (filterPriority !== 'all' && action.priority !== filterPriority) return false;
      return true;
    });
  }, [actions, filterType, filterStatus, filterPriority, showIgnored]);

  // Group by priority for better organization
  const groupedActions = useMemo(() => {
    const groups: Record<ActionPriority, KeywordAction[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };
    filteredActions.forEach(action => {
      groups[action.priority].push(action);
    });
    return groups;
  }, [filteredActions]);

  const stats = useMemo(() => ({
    total: actions.length,
    pending: actions.filter(a => a.status === 'pending').length,
    approved: actions.filter(a => a.status === 'approved').length,
    completed: actions.filter(a => a.status === 'completed').length,
    ignored: actions.filter(a => a.status === 'ignored').length,
  }), [actions]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="font-medium text-gray-900">{stats.total} Suggestions</span>
        <span className="text-gray-400">|</span>
        <span className="text-yellow-600">{stats.pending} Pending</span>
        <span className="text-blue-600">{stats.approved} Approved</span>
        <span className="text-green-600">{stats.completed} Completed</span>
        {stats.ignored > 0 && (
          <span className="text-gray-400">{stats.ignored} Ignored</span>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as ActionType | 'all')}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="all">All Types</option>
            {Object.entries(ACTION_TYPE_CONFIG).map(([type, config]) => (
              <option key={type} value={type}>{config.label}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ActionStatus | 'all')}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
              <option key={status} value={status}>{config.label}</option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as ActionPriority | 'all')}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="all">All Priorities</option>
            {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
              <option key={priority} value={priority}>{config.label}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showIgnored}
              onChange={(e) => setShowIgnored(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show Ignored
          </label>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse rounded-lg border p-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredActions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Sparkles className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No suggestions found</p>
          <p className="text-sm mt-1">
            {actions.length === 0 
              ? 'AI is analyzing your keywords...' 
              : 'Try adjusting your filters'}
          </p>
        </div>
      )}

      {/* Action list */}
      {!loading && variant === 'default' && (
        <div className="space-y-6">
          {(['critical', 'high', 'medium', 'low'] as ActionPriority[]).map(priority => {
            const group = groupedActions[priority];
            if (group.length === 0) return null;
            
            return (
              <div key={priority}>
                <h3 className={cn(
                  'text-sm font-medium mb-2 flex items-center gap-2',
                  PRIORITY_CONFIG[priority].color
                )}>
                  {PRIORITY_CONFIG[priority].label} Priority
                  <span className="text-gray-400 font-normal">({group.length})</span>
                </h3>
                <div className="space-y-3">
                  {group.map(action => (
                    <KeywordActionCard
                      key={action.id}
                      action={action}
                      canApprove={canApprove}
                      canExecute={canExecute}
                      onApprove={onApprove}
                      onIgnore={onIgnore}
                      onExecute={onExecute}
                      onRetry={onRetry}
                      onViewDetails={onViewDetails}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && variant === 'compact' && (
        <div className="space-y-2">
          {filteredActions.map(action => (
            <KeywordActionCard
              key={action.id}
              action={action}
              variant="compact"
              canApprove={canApprove}
              canExecute={canExecute}
              onApprove={onApprove}
              onIgnore={onIgnore}
              onExecute={onExecute}
              onRetry={onRetry}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ACTION SUMMARY COMPONENT
// =============================================================================

interface ActionSummaryProps {
  actions: KeywordAction[];
  className?: string;
}

export function ActionSummary({ actions, className }: ActionSummaryProps) {
  const stats = useMemo(() => {
    const byType: Partial<Record<ActionType, number>> = {};
    const byPriority: Record<ActionPriority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    let totalImpact = 0;

    actions.filter(a => a.status === 'pending').forEach(action => {
      byType[action.type] = (byType[action.type] || 0) + 1;
      byPriority[action.priority]++;
      totalImpact += action.expectedImpact.trafficChange;
    });

    return { byType, byPriority, totalImpact, pending: actions.filter(a => a.status === 'pending').length };
  }, [actions]);

  return (
    <div className={cn('bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">AI Action Summary</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-sm text-gray-500">Pending Actions</p>
          <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Critical/High</p>
          <p className="text-2xl font-bold text-orange-600">
            {stats.byPriority.critical + stats.byPriority.high}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Expected Impact</p>
          <p className={cn(
            'text-2xl font-bold',
            stats.totalImpact > 0 ? 'text-green-600' : 'text-gray-600'
          )}>
            {stats.totalImpact > 0 ? '+' : ''}{stats.totalImpact.toFixed(0)}%
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Top Action Type</p>
          <p className="text-lg font-bold text-gray-900">
            {Object.entries(stats.byType).sort((a, b) => b[1] - a[1])[0]?.[0] 
              ? ACTION_TYPE_CONFIG[Object.entries(stats.byType).sort((a, b) => b[1] - a[1])[0][0] as ActionType].label
              : '-'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
