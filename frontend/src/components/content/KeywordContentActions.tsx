'use client';

/**
 * Keyword Content Actions Component
 * 
 * Per-keyword action buttons for Content Engine integration:
 * - Create Content: Generate new content from keyword
 * - Optimize Existing: Update/enhance existing page
 * - Map to Section: Add keyword to existing content section
 * - Ignore: Mark keyword as not actionable
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Section 12.8 – Frontend Integration
 */

import React, { useState } from 'react';
import { cn, formatNumber, formatCompact } from '@/lib/utils';
import type { SearchIntent, OpportunityLevel, Keyword } from '@/types/keyword.types';
import { SEARCH_INTENT_CONFIG, OPPORTUNITY_CONFIG } from '@/types/keyword.types';
import type { ContentType, ContentMode, CannibalizationStatus } from './ContentBrief';
import { CONTENT_TYPE_CONFIG, CONTENT_MODE_CONFIG, CANNIBALIZATION_STATUS_CONFIG } from './ContentBrief';
import {
  FileText,
  FilePlus2,
  FileEdit,
  FileX,
  Target,
  Sparkles,
  Link2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  Search,
  ExternalLink,
  Eye,
  MoreHorizontal,
  Zap,
  TrendingUp,
  Tag,
  X,
  Loader2,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type KeywordMappingAction = 
  | 'create_new'        // Create new content
  | 'optimize_existing' // Optimize existing page
  | 'add_to_section'    // Add to existing content section
  | 'ignore';           // Mark as not actionable

export interface MappingSuggestion {
  url: string;
  title: string;
  currentRanking?: number;
  matchScore: number;
  reason: string;
  cannibalizationRisk: CannibalizationStatus;
}

export interface KeywordWithMapping extends Keyword {
  mappingSuggestions?: MappingSuggestion[];
  selectedAction?: KeywordMappingAction;
  selectedUrl?: string;
  briefs?: string[]; // Brief IDs linked to this keyword
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface ActionButtonProps {
  action: KeywordMappingAction;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

const ACTION_CONFIG: Record<KeywordMappingAction, {
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  hoverBg: string;
}> = {
  create_new: {
    label: 'Create New Content',
    shortLabel: 'Create',
    description: 'Generate new page targeting this keyword',
    icon: FilePlus2,
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    hoverBg: 'hover:bg-green-200',
  },
  optimize_existing: {
    label: 'Optimize Existing',
    shortLabel: 'Optimize',
    description: 'Improve existing content for this keyword',
    icon: FileEdit,
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    hoverBg: 'hover:bg-blue-200',
  },
  add_to_section: {
    label: 'Add to Section',
    shortLabel: 'Section',
    description: 'Add keyword coverage to existing section',
    icon: FileText,
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    hoverBg: 'hover:bg-purple-200',
  },
  ignore: {
    label: 'Ignore',
    shortLabel: 'Ignore',
    description: 'Mark as not actionable',
    icon: FileX,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    hoverBg: 'hover:bg-gray-200',
  },
};

function ActionButton({ action, isSelected, onClick, disabled, className }: ActionButtonProps) {
  const config = ACTION_CONFIG[action];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
        isSelected ? cn(config.bgColor, config.color, 'ring-2 ring-offset-1', config.color.replace('text', 'ring')) : 'bg-gray-50 text-gray-600',
        !disabled && config.hoverBg,
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Icon className="h-4 w-4" />
      {config.shortLabel}
    </button>
  );
}

interface MappingSuggestionCardProps {
  suggestion: MappingSuggestion;
  isSelected: boolean;
  onSelect: () => void;
}

function MappingSuggestionCard({ suggestion, isSelected, onSelect }: MappingSuggestionCardProps) {
  const riskConfig = CANNIBALIZATION_STATUS_CONFIG[suggestion.cannibalizationRisk];
  const RiskIcon = riskConfig.icon;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-all',
        isSelected 
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate text-sm">
            {suggestion.title}
          </p>
          <p className="text-xs text-blue-600 truncate mt-0.5">
            {suggestion.url}
          </p>
        </div>
        <div className={cn(
          'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
          riskConfig.bgColor,
          riskConfig.color
        )}>
          <RiskIcon className="h-3 w-3" />
          {riskConfig.label}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2 text-xs">
        <span className={cn(
          'font-medium',
          suggestion.matchScore >= 80 && 'text-green-600',
          suggestion.matchScore >= 60 && suggestion.matchScore < 80 && 'text-yellow-600',
          suggestion.matchScore < 60 && 'text-gray-500',
        )}>
          {suggestion.matchScore}% match
        </span>
        {suggestion.currentRanking && (
          <>
            <span className="text-gray-300">•</span>
            <span className="text-gray-500">
              Rank #{suggestion.currentRanking}
            </span>
          </>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-2 line-clamp-2">
        {suggestion.reason}
      </p>
    </button>
  );
}

// =============================================================================
// MAIN COMPONENTS
// =============================================================================

interface KeywordContentActionsProps {
  keyword: KeywordWithMapping;
  compact?: boolean;
  onActionSelect: (keywordId: string, action: KeywordMappingAction, url?: string) => void;
  onGenerateBrief: (keywordId: string, contentType?: ContentType) => void;
  onViewBrief?: (briefId: string) => void;
  isGenerating?: boolean;
  className?: string;
}

export function KeywordContentActions({
  keyword,
  compact = false,
  onActionSelect,
  onGenerateBrief,
  onViewBrief,
  isGenerating = false,
  className,
}: KeywordContentActionsProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(keyword.selectedUrl || null);
  const intentConfig = SEARCH_INTENT_CONFIG[keyword.intent];
  const opportunityConfig = OPPORTUNITY_CONFIG[keyword.opportunity || 'low'];

  const handleActionSelect = (action: KeywordMappingAction) => {
    if (action === 'optimize_existing' || action === 'add_to_section') {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setSelectedUrl(null);
      onActionSelect(keyword.id, action);
    }
  };

  const handleUrlSelect = (url: string) => {
    setSelectedUrl(url);
    if (keyword.selectedAction) {
      onActionSelect(keyword.id, keyword.selectedAction, url);
    }
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {keyword.selectedAction ? (
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
            ACTION_CONFIG[keyword.selectedAction].bgColor,
            ACTION_CONFIG[keyword.selectedAction].color
          )}>
            {React.createElement(ACTION_CONFIG[keyword.selectedAction].icon, { className: 'h-3 w-3' })}
            {ACTION_CONFIG[keyword.selectedAction].shortLabel}
          </span>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onActionSelect(keyword.id, 'create_new')}
              className="p-1.5 rounded hover:bg-green-100 text-green-600"
              title="Create Content"
            >
              <FilePlus2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleActionSelect('optimize_existing')}
              className="p-1.5 rounded hover:bg-blue-100 text-blue-600"
              title="Optimize Existing"
            >
              <FileEdit className="h-4 w-4" />
            </button>
          </div>
        )}
        
        {keyword.briefs && keyword.briefs.length > 0 && onViewBrief && (
          <button
            onClick={() => onViewBrief(keyword.briefs![0])}
            className="p-1.5 rounded hover:bg-purple-100 text-purple-600"
            title="View Brief"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Keyword Info Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{keyword.keyword}</h3>
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
              intentConfig.bgColor,
              intentConfig.color
            )}>
              {intentConfig.label}
            </span>
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
              opportunityConfig.bgColor,
              opportunityConfig.color
            )}>
              {opportunityConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span>{formatCompact(keyword.searchVolume)} vol</span>
            <span>•</span>
            <span>KD: {keyword.difficulty}</span>
            {keyword.mappedUrl && (
              <>
                <span>•</span>
                <a 
                  href={keyword.mappedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Mapped
                </a>
              </>
            )}
          </div>
        </div>

        {keyword.briefs && keyword.briefs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {keyword.briefs.length} brief{keyword.briefs.length > 1 ? 's' : ''}
            </span>
            {onViewBrief && (
              <button
                onClick={() => onViewBrief(keyword.briefs![0])}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium uppercase">Content Action</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ACTION_CONFIG) as KeywordMappingAction[]).map((action) => (
            <ActionButton
              key={action}
              action={action}
              isSelected={keyword.selectedAction === action}
              onClick={() => handleActionSelect(action)}
              disabled={isGenerating}
            />
          ))}
        </div>
      </div>

      {/* URL Suggestions for Optimize/Section modes */}
      {showSuggestions && keyword.mappingSuggestions && keyword.mappingSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase">
            Select Target Page
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {keyword.mappingSuggestions.map((suggestion, index) => (
              <MappingSuggestionCard
                key={index}
                suggestion={suggestion}
                isSelected={selectedUrl === suggestion.url}
                onSelect={() => handleUrlSelect(suggestion.url)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Generate Brief Button */}
      {keyword.selectedAction && keyword.selectedAction !== 'ignore' && (
        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={() => onGenerateBrief(keyword.id)}
            disabled={isGenerating || (
              (keyword.selectedAction === 'optimize_existing' || keyword.selectedAction === 'add_to_section') && !selectedUrl
            )}
            className={cn(
              'flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg font-medium transition-all',
              isGenerating || ((keyword.selectedAction === 'optimize_existing' || keyword.selectedAction === 'add_to_section') && !selectedUrl)
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
            )}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? 'Generating...' : 'Generate Content Brief'}
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// BULK ACTION COMPONENT
// =============================================================================

interface KeywordBulkActionsProps {
  selectedKeywords: KeywordWithMapping[];
  onBulkAction: (keywordIds: string[], action: KeywordMappingAction) => void;
  onBulkGenerateBriefs: (keywordIds: string[]) => void;
  isBulkGenerating?: boolean;
  className?: string;
}

export function KeywordBulkActions({
  selectedKeywords,
  onBulkAction,
  onBulkGenerateBriefs,
  isBulkGenerating = false,
  className,
}: KeywordBulkActionsProps) {
  const keywordIds = selectedKeywords.map(k => k.id);
  const hasActionsSelected = selectedKeywords.some(k => k.selectedAction && k.selectedAction !== 'ignore');

  return (
    <div className={cn(
      'flex items-center justify-between gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200',
      className
    )}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Tag className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <p className="font-medium text-blue-900">
            {selectedKeywords.length} keyword{selectedKeywords.length > 1 ? 's' : ''} selected
          </p>
          <p className="text-sm text-blue-700">
            Total volume: {formatCompact(selectedKeywords.reduce((sum, k) => sum + k.searchVolume, 0))}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 mr-2">
          {(Object.keys(ACTION_CONFIG) as KeywordMappingAction[]).map((action) => (
            <button
              key={action}
              onClick={() => onBulkAction(keywordIds, action)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                ACTION_CONFIG[action].hoverBg,
                ACTION_CONFIG[action].color
              )}
              title={ACTION_CONFIG[action].label}
            >
              {React.createElement(ACTION_CONFIG[action].icon, { className: 'h-4 w-4' })}
            </button>
          ))}
        </div>

        <button
          onClick={() => onBulkGenerateBriefs(keywordIds)}
          disabled={!hasActionsSelected || isBulkGenerating}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
            hasActionsSelected && !isBulkGenerating
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          )}
        >
          {isBulkGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate Briefs
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// INLINE ACTION DROPDOWN
// =============================================================================

interface KeywordActionDropdownProps {
  keyword: KeywordWithMapping;
  onActionSelect: (keywordId: string, action: KeywordMappingAction) => void;
  onGenerateBrief: (keywordId: string) => void;
  trigger?: React.ReactNode;
  className?: string;
}

export function KeywordActionDropdown({
  keyword,
  onActionSelect,
  onGenerateBrief,
  trigger,
  className,
}: KeywordActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
      >
        {trigger || <MoreHorizontal className="h-4 w-4" />}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500 font-medium uppercase">Content Actions</p>
            </div>
            
            {(Object.keys(ACTION_CONFIG) as KeywordMappingAction[]).map((action) => {
              const config = ACTION_CONFIG[action];
              const Icon = config.icon;
              const isSelected = keyword.selectedAction === action;
              
              return (
                <button
                  key={action}
                  onClick={() => {
                    onActionSelect(keyword.id, action);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50',
                    isSelected && 'bg-gray-50'
                  )}
                >
                  <Icon className={cn('h-4 w-4', config.color)} />
                  <div className="flex-1">
                    <span className="text-gray-900">{config.label}</span>
                    {isSelected && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 inline ml-2" />
                    )}
                  </div>
                </button>
              );
            })}

            {keyword.selectedAction && keyword.selectedAction !== 'ignore' && (
              <>
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={() => {
                      onGenerateBrief(keyword.id);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate Brief
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
