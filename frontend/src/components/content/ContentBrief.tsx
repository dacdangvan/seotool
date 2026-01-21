'use client';

/**
 * Content Brief Component
 * 
 * Generate and display structured Content Briefs based on keyword/cluster data:
 * - Primary & secondary keywords
 * - Search intent validation
 * - Suggested outline (H1-H3)
 * - Internal links to include
 * - SEO constraints (brand, risk)
 * - Cannibalization check status
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Section 12 – Keyword Research ↔ Content Engine Integration
 */

import React, { useState, useMemo } from 'react';
import { cn, formatNumber, formatCompact } from '@/lib/utils';
import type { SearchIntent, OpportunityLevel, Keyword } from '@/types/keyword.types';
import { SEARCH_INTENT_CONFIG, OPPORTUNITY_CONFIG } from '@/types/keyword.types';
import {
  FileText,
  Target,
  Sparkles,
  Link2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Edit3,
  Eye,
  ListTree,
  Hash,
  ExternalLink,
  Shield,
  TrendingUp,
  Clock,
  Info,
  Zap,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type ContentType = 
  | 'blog_article'
  | 'landing_page'
  | 'product_page'
  | 'faq_support'
  | 'comparison'
  | 'guide';

export type ContentMode = 
  | 'create'    // New content for unmapped keywords
  | 'optimize'  // Improve existing content
  | 'assist';   // Suggest sections only

export type BriefStatus = 
  | 'draft'
  | 'validated'
  | 'approved'
  | 'in_progress'
  | 'completed';

export type CannibalizationStatus = 
  | 'clear'           // No conflicts
  | 'warning'         // Potential overlap
  | 'blocked'         // Must resolve before proceeding
  | 'resolved';       // Was blocked, now resolved

export interface OutlineItem {
  level: 1 | 2 | 3;
  text: string;
  keywords?: string[];
  wordCount?: number;
}

export interface InternalLinkSuggestion {
  url: string;
  title: string;
  anchorText: string;
  relevanceScore: number;
  reason: string;
}

export interface ContentBrief {
  id: string;
  
  // Source
  keywordId?: string;
  clusterId?: string;
  
  // Keywords
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: SearchIntent;
  searchVolume: number;
  difficulty: number;
  opportunity: OpportunityLevel;
  
  // Content Planning
  contentType: ContentType;
  contentMode: ContentMode;
  targetUrl: string | null;        // Existing URL for optimize mode
  suggestedSlug?: string;          // For create mode
  
  // Structure
  suggestedTitle: string;
  suggestedMetaDescription: string;
  outline: OutlineItem[];
  estimatedWordCount: number;
  
  // Internal Links
  internalLinks: InternalLinkSuggestion[];
  
  // Constraints & Validation
  cannibalizationStatus: CannibalizationStatus;
  cannibalizationDetails?: {
    conflictingUrls: string[];
    conflictingKeywords: string[];
    recommendation: string;
  };
  brandConstraints?: string[];
  seoConstraints?: string[];
  
  // Status & Metadata
  status: BriefStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: 'ai' | 'user';
  approvedBy?: string;
  
  // AI Reasoning
  aiReasoning: string;
  confidenceScore: number;
}

export interface ContentTypeConfig {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  suitableIntents: SearchIntent[];
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const CONTENT_TYPE_CONFIG: Record<ContentType, ContentTypeConfig> = {
  blog_article: {
    label: 'Blog Article',
    description: 'Educational or informational long-form content',
    icon: FileText,
    suitableIntents: ['informational', 'commercial'],
  },
  landing_page: {
    label: 'Landing Page',
    description: 'Conversion-focused page for campaigns',
    icon: Target,
    suitableIntents: ['transactional', 'commercial'],
  },
  product_page: {
    label: 'Product/Service Page',
    description: 'Detailed product or service information',
    icon: Zap,
    suitableIntents: ['transactional', 'commercial', 'navigational'],
  },
  faq_support: {
    label: 'FAQ / Support',
    description: 'Question-answer or help content',
    icon: Info,
    suitableIntents: ['informational', 'navigational'],
  },
  comparison: {
    label: 'Comparison',
    description: 'Side-by-side comparison content',
    icon: ListTree,
    suitableIntents: ['commercial', 'informational'],
  },
  guide: {
    label: 'Guide / Tutorial',
    description: 'Step-by-step instructional content',
    icon: FileText,
    suitableIntents: ['informational', 'transactional'],
  },
};

export const CONTENT_MODE_CONFIG: Record<ContentMode, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  create: {
    label: 'Create New',
    description: 'Generate new content for unmapped keywords',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  optimize: {
    label: 'Optimize',
    description: 'Improve existing content',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  assist: {
    label: 'Assist',
    description: 'Suggest sections and enhancements only',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
};

export const BRIEF_STATUS_CONFIG: Record<BriefStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  draft: {
    label: 'Draft',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: Edit3,
  },
  validated: {
    label: 'Validated',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: CheckCircle2,
  },
  approved: {
    label: 'Approved',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: CheckCircle2,
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    icon: Clock,
  },
  completed: {
    label: 'Completed',
    color: 'text-green-700',
    bgColor: 'bg-green-200',
    icon: CheckCircle2,
  },
};

export const CANNIBALIZATION_STATUS_CONFIG: Record<CannibalizationStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  clear: {
    label: 'No Conflicts',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: CheckCircle2,
  },
  warning: {
    label: 'Potential Overlap',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: AlertTriangle,
  },
  blocked: {
    label: 'Must Resolve',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: XCircle,
  },
  resolved: {
    label: 'Resolved',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: CheckCircle2,
  },
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface ContentTypeBadgeProps {
  type: ContentType;
  size?: 'sm' | 'md';
}

export function ContentTypeBadge({ type, size = 'sm' }: ContentTypeBadgeProps) {
  const config = CONTENT_TYPE_CONFIG[type];
  const Icon = config.icon;
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full font-medium',
      'bg-gray-100 text-gray-700',
      size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
    )}>
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {config.label}
    </span>
  );
}

interface ContentModeBadgeProps {
  mode: ContentMode;
  size?: 'sm' | 'md';
}

export function ContentModeBadge({ mode, size = 'sm' }: ContentModeBadgeProps) {
  const config = CONTENT_MODE_CONFIG[mode];
  
  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium',
      config.bgColor,
      config.color,
      size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
    )}>
      {config.label}
    </span>
  );
}

interface BriefStatusBadgeProps {
  status: BriefStatus;
  size?: 'sm' | 'md';
}

export function BriefStatusBadge({ status, size = 'sm' }: BriefStatusBadgeProps) {
  const config = BRIEF_STATUS_CONFIG[status];
  const Icon = config.icon;
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-medium',
      config.bgColor,
      config.color,
      size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
    )}>
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {config.label}
    </span>
  );
}

interface CannibalizationBadgeProps {
  status: CannibalizationStatus;
  details?: ContentBrief['cannibalizationDetails'];
  showDetails?: boolean;
}

export function CannibalizationBadge({ 
  status, 
  details,
  showDetails = false 
}: CannibalizationBadgeProps) {
  const config = CANNIBALIZATION_STATUS_CONFIG[status];
  const Icon = config.icon;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <div className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
        config.bgColor,
        config.color,
      )}>
        <Icon className="h-3.5 w-3.5" />
        {config.label}
        {showDetails && details && status !== 'clear' && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-1 hover:opacity-70"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>
      
      {expanded && details && (
        <div className={cn(
          'p-3 rounded-lg border text-sm',
          config.bgColor.replace('100', '50'),
          config.color.replace('700', '800'),
        )}>
          {details.conflictingUrls.length > 0 && (
            <div className="mb-2">
              <p className="font-medium mb-1">Conflicting URLs:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                {details.conflictingUrls.map((url, i) => (
                  <li key={i} className="truncate">{url}</li>
                ))}
              </ul>
            </div>
          )}
          {details.recommendation && (
            <p className="text-xs mt-2">
              <strong>Recommendation:</strong> {details.recommendation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface IntentMatchIndicatorProps {
  intent: SearchIntent;
  contentType: ContentType;
}

export function IntentMatchIndicator({ intent, contentType }: IntentMatchIndicatorProps) {
  const typeConfig = CONTENT_TYPE_CONFIG[contentType];
  const isMatch = typeConfig.suitableIntents.includes(intent);
  const intentConfig = SEARCH_INTENT_CONFIG[intent];

  return (
    <div className={cn(
      'flex items-center gap-2 p-2 rounded-lg border',
      isMatch ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
    )}>
      {isMatch ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-red-600" />
      )}
      <div className="text-sm">
        <span className={cn('font-medium', intentConfig.color)}>
          {intentConfig.label}
        </span>
        <span className="text-gray-500 mx-1">→</span>
        <span className="text-gray-700">{typeConfig.label}</span>
        {!isMatch && (
          <span className="text-red-600 ml-2 text-xs">(Intent mismatch)</span>
        )}
      </div>
    </div>
  );
}

interface OutlinePreviewProps {
  outline: OutlineItem[];
  showKeywords?: boolean;
  editable?: boolean;
  onChange?: (outline: OutlineItem[]) => void;
}

export function OutlinePreview({ 
  outline, 
  showKeywords = false,
  editable = false,
  onChange,
}: OutlinePreviewProps) {
  return (
    <div className="space-y-1">
      {outline.map((item, index) => (
        <div 
          key={index}
          className={cn(
            'flex items-start gap-2 py-1.5 px-2 rounded hover:bg-gray-50',
            item.level === 1 && 'pl-0',
            item.level === 2 && 'pl-4',
            item.level === 3 && 'pl-8',
          )}
        >
          <span className={cn(
            'flex-shrink-0 font-mono text-xs rounded px-1.5 py-0.5',
            item.level === 1 && 'bg-blue-100 text-blue-700',
            item.level === 2 && 'bg-gray-100 text-gray-600',
            item.level === 3 && 'bg-gray-50 text-gray-500',
          )}>
            H{item.level}
          </span>
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-gray-900',
              item.level === 1 && 'font-semibold text-base',
              item.level === 2 && 'font-medium text-sm',
              item.level === 3 && 'text-sm',
            )}>
              {item.text}
            </p>
            {showKeywords && item.keywords && item.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {item.keywords.map((kw, kwIndex) => (
                  <span 
                    key={kwIndex}
                    className="inline-flex items-center px-1.5 py-0.5 bg-purple-50 text-purple-600 text-xs rounded"
                  >
                    <Hash className="h-2.5 w-2.5 mr-0.5" />
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
          {item.wordCount && (
            <span className="text-xs text-gray-400">
              ~{item.wordCount} words
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

interface InternalLinksPreviewProps {
  links: InternalLinkSuggestion[];
  maxVisible?: number;
}

export function InternalLinksPreview({ links, maxVisible = 5 }: InternalLinksPreviewProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleLinks = showAll ? links : links.slice(0, maxVisible);

  return (
    <div className="space-y-2">
      {visibleLinks.map((link, index) => (
        <div 
          key={index}
          className="flex items-start gap-3 p-2 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50"
        >
          <Link2 className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {link.title}
            </p>
            <p className="text-xs text-blue-600 truncate">
              {link.url}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">
                Anchor: "<span className="text-gray-700">{link.anchorText}</span>"
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className={cn(
                'text-xs',
                link.relevanceScore >= 80 && 'text-green-600',
                link.relevanceScore >= 60 && link.relevanceScore < 80 && 'text-yellow-600',
                link.relevanceScore < 60 && 'text-gray-500',
              )}>
                {link.relevanceScore}% relevant
              </span>
            </div>
          </div>
        </div>
      ))}
      
      {links.length > maxVisible && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {showAll ? 'Show less' : `Show ${links.length - maxVisible} more`}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT: ContentBriefCard
// =============================================================================

interface ContentBriefCardProps {
  brief: ContentBrief;
  variant?: 'default' | 'compact' | 'expanded';
  canEdit?: boolean;
  canApprove?: boolean;
  onEdit?: (briefId: string) => void;
  onApprove?: (briefId: string) => void;
  onGenerateContent?: (briefId: string) => void;
  onExport?: (briefId: string) => void;
  className?: string;
}

export function ContentBriefCard({
  brief,
  variant = 'default',
  canEdit = false,
  canApprove = false,
  onEdit,
  onApprove,
  onGenerateContent,
  onExport,
  className,
}: ContentBriefCardProps) {
  const [isExpanded, setIsExpanded] = useState(variant === 'expanded');
  const intentConfig = SEARCH_INTENT_CONFIG[brief.searchIntent];
  const opportunityConfig = OPPORTUNITY_CONFIG[brief.opportunity];
  const typeConfig = CONTENT_TYPE_CONFIG[brief.contentType];
  const TypeIcon = typeConfig.icon;

  const canProceed = brief.cannibalizationStatus !== 'blocked';

  if (variant === 'compact') {
    return (
      <div className={cn(
        'flex items-center gap-4 p-4 rounded-lg border hover:bg-gray-50 transition-colors',
        className
      )}>
        <div className={cn('p-2 rounded-lg bg-gray-100')}>
          <TypeIcon className="h-5 w-5 text-gray-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">
              {brief.primaryKeyword}
            </span>
            <ContentModeBadge mode={brief.contentMode} size="sm" />
            <BriefStatusBadge status={brief.status} size="sm" />
          </div>
          <p className="text-sm text-gray-500 truncate mt-0.5">
            {brief.suggestedTitle}
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{formatCompact(brief.searchVolume)} vol</span>
          <span className="text-gray-300">•</span>
          <span className={opportunityConfig.color}>{opportunityConfig.label}</span>
        </div>

        <CannibalizationBadge status={brief.cannibalizationStatus} />
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-lg border bg-white overflow-hidden',
      brief.cannibalizationStatus === 'blocked' && 'border-red-200',
      className
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={cn('p-2.5 rounded-lg', typeConfig.suitableIntents.includes(brief.searchIntent) ? 'bg-green-50' : 'bg-red-50')}>
              <TypeIcon className={cn(
                'h-6 w-6',
                typeConfig.suitableIntents.includes(brief.searchIntent) ? 'text-green-600' : 'text-red-600'
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900">
                  {brief.primaryKeyword}
                </h3>
                <ContentModeBadge mode={brief.contentMode} />
                <BriefStatusBadge status={brief.status} />
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {brief.suggestedTitle}
              </p>
            </div>
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

        {/* Quick stats */}
        <div className="flex items-center gap-4 mt-3 text-sm">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">{formatCompact(brief.searchVolume)} vol</span>
          </div>
          <div className={cn('flex items-center gap-1.5', intentConfig.color)}>
            <span className={cn('w-2 h-2 rounded-full', intentConfig.bgColor)} />
            {intentConfig.label}
          </div>
          <div className={cn('flex items-center gap-1.5', opportunityConfig.color)}>
            {opportunityConfig.label}
          </div>
          <CannibalizationBadge 
            status={brief.cannibalizationStatus} 
            details={brief.cannibalizationDetails}
            showDetails
          />
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Intent Validation */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Intent Alignment</h4>
            <IntentMatchIndicator intent={brief.searchIntent} contentType={brief.contentType} />
          </div>

          {/* AI Reasoning */}
          <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-800 mb-1">
              <Sparkles className="h-4 w-4" />
              AI Strategy
            </div>
            <p className="text-sm text-gray-700">{brief.aiReasoning}</p>
            <div className="mt-2 text-xs text-gray-500">
              Confidence: {brief.confidenceScore}%
            </div>
          </div>

          {/* Keywords */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Keywords</h4>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2.5 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium">
                <Target className="h-3.5 w-3.5 mr-1" />
                {brief.primaryKeyword}
              </span>
              {brief.secondaryKeywords.map((kw, i) => (
                <span 
                  key={i}
                  className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>

          {/* Suggested Meta */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Meta Tags</h4>
            <div className="p-3 bg-gray-50 rounded-lg space-y-2">
              <div>
                <p className="text-xs text-gray-500 uppercase">Title ({brief.suggestedTitle.length} chars)</p>
                <p className="text-sm text-gray-900">{brief.suggestedTitle}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Description ({brief.suggestedMetaDescription.length} chars)</p>
                <p className="text-sm text-gray-700">{brief.suggestedMetaDescription}</p>
              </div>
            </div>
          </div>

          {/* Outline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Suggested Outline</h4>
              <span className="text-xs text-gray-500">
                ~{formatNumber(brief.estimatedWordCount)} words
              </span>
            </div>
            <div className="border rounded-lg p-3">
              <OutlinePreview outline={brief.outline} showKeywords />
            </div>
          </div>

          {/* Internal Links */}
          {brief.internalLinks.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Suggested Internal Links ({brief.internalLinks.length})
              </h4>
              <InternalLinksPreview links={brief.internalLinks} />
            </div>
          )}

          {/* Constraints */}
          {(brief.brandConstraints?.length || brief.seoConstraints?.length) && (
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
              <div className="flex items-center gap-2 text-sm font-medium text-yellow-800 mb-2">
                <Shield className="h-4 w-4" />
                Constraints & Guidelines
              </div>
              {brief.brandConstraints && brief.brandConstraints.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-yellow-700 font-medium">Brand:</p>
                  <ul className="text-xs text-yellow-800 list-disc list-inside">
                    {brief.brandConstraints.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              {brief.seoConstraints && brief.seoConstraints.length > 0 && (
                <div>
                  <p className="text-xs text-yellow-700 font-medium">SEO:</p>
                  <ul className="text-xs text-yellow-800 list-disc list-inside">
                    {brief.seoConstraints.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              {brief.createdBy === 'ai' ? 'AI Generated' : 'Manual'} • {brief.createdAt}
            </div>

            <div className="flex items-center gap-2">
              {onExport && (
                <button
                  onClick={() => onExport(brief.id)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              )}
              
              {canEdit && onEdit && (
                <button
                  onClick={() => onEdit(brief.id)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
              )}

              {canApprove && onApprove && brief.status === 'validated' && (
                <button
                  onClick={() => onApprove(brief.id)}
                  disabled={!canProceed}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-lg flex items-center gap-1',
                    canProceed 
                      ? 'text-white bg-green-600 hover:bg-green-700' 
                      : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                  )}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </button>
              )}

              {onGenerateContent && brief.status === 'approved' && (
                <button
                  onClick={() => onGenerateContent(brief.id)}
                  className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Content
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if content type matches search intent
 */
export function validateIntentMatch(intent: SearchIntent, contentType: ContentType): boolean {
  return CONTENT_TYPE_CONFIG[contentType].suitableIntents.includes(intent);
}

/**
 * Get recommended content types for a search intent
 */
export function getRecommendedContentTypes(intent: SearchIntent): ContentType[] {
  return (Object.entries(CONTENT_TYPE_CONFIG) as [ContentType, ContentTypeConfig][])
    .filter(([_, config]) => config.suitableIntents.includes(intent))
    .map(([type, _]) => type);
}
