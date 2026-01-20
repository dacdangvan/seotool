'use client';

/**
 * Keyword Cluster Card Component
 * 
 * Expandable card displaying a keyword cluster with:
 * - Cluster topic name
 * - Key metrics (volume, difficulty, intent)
 * - Expandable keyword list
 * - Content planning selection
 */

import React, { useState } from 'react';
import { cn, formatCompact, formatNumber } from '@/lib/utils';
import type { KeywordClusterDetail, SearchIntent } from '@/types/keyword.types';
import { SEARCH_INTENT_CONFIG } from '@/types/keyword.types';
import { ClusterKeywordList } from './ClusterKeywordList';
import { 
  ChevronDown, 
  ChevronRight,
  Target,
  TrendingUp,
  FileText,
  Lightbulb,
  CheckCircle2,
  Circle,
  Link2,
  Link2Off,
} from 'lucide-react';

interface KeywordClusterCardProps {
  cluster: KeywordClusterDetail;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

function IntentBadge({ intent }: { intent: SearchIntent }) {
  const config = SEARCH_INTENT_CONFIG[intent];
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
      config.bgColor,
      config.color
    )}>
      {config.label}
    </span>
  );
}

function MetricItem({ 
  icon, 
  label, 
  value, 
  subValue,
  colorClass,
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
  subValue?: string;
  colorClass?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn('text-gray-400', colorClass)}>{icon}</div>
      <div>
        <div className="text-sm font-medium text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function DifficultyIndicator({ score }: { score: number }) {
  const getColor = () => {
    if (score <= 30) return 'text-green-600 bg-green-100';
    if (score <= 60) return 'text-yellow-600 bg-yellow-100';
    if (score <= 80) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getLabel = () => {
    if (score <= 30) return 'Easy';
    if (score <= 60) return 'Medium';
    if (score <= 80) return 'Hard';
    return 'Very Hard';
  };

  return (
    <div className="flex items-center gap-2">
      <Target className="w-4 h-4 text-gray-400" />
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-900">{score}</span>
          <span className={cn(
            'px-1.5 py-0.5 rounded text-xs font-medium',
            getColor()
          )}>
            {getLabel()}
          </span>
        </div>
        <div className="text-xs text-gray-500">Avg. Difficulty</div>
      </div>
    </div>
  );
}

export function KeywordClusterCard({
  cluster,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
}: KeywordClusterCardProps) {
  const [showAllKeywords, setShowAllKeywords] = useState(false);
  
  const mappedCount = cluster.keywords.filter(k => k.mappedUrl).length;
  const unmappedCount = cluster.keywords.length - mappedCount;
  const highOpportunityCount = cluster.keywords.filter(k => k.opportunity === 'high').length;

  return (
    <div className={cn(
      'bg-white rounded-xl border transition-all',
      isSelected 
        ? 'border-blue-500 ring-2 ring-blue-100' 
        : 'border-gray-200 hover:border-gray-300'
    )}>
      {/* Header - Always visible */}
      <div 
        className="p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start gap-4">
          {/* Expand/collapse icon */}
          <button className="mt-1 text-gray-400 hover:text-gray-600 transition-colors">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
          
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {cluster.name}
              </h3>
              <IntentBadge intent={cluster.primaryIntent} />
              <span className="text-sm text-gray-500">
                {cluster.keywords.length} keywords
              </span>
            </div>
            
            {/* Description */}
            {cluster.description && (
              <p className="text-sm text-gray-600 mb-3">
                {cluster.description}
              </p>
            )}
            
            {/* Metrics row */}
            <div className="flex flex-wrap items-center gap-6">
              <MetricItem
                icon={<TrendingUp className="w-4 h-4" />}
                label="Total Volume"
                value={formatCompact(cluster.totalSearchVolume)}
              />
              
              <DifficultyIndicator score={cluster.avgDifficulty} />
              
              {highOpportunityCount > 0 && (
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {highOpportunityCount}
                    </div>
                    <div className="text-xs text-gray-500">High Opp.</div>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                {mappedCount > 0 ? (
                  <Link2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Link2Off className="w-4 h-4 text-amber-500" />
                )}
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {mappedCount}/{cluster.keywords.length}
                  </div>
                  <div className="text-xs text-gray-500">Mapped</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Selection button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isSelected 
                ? 'bg-blue-100 text-blue-600' 
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            )}
            title={isSelected ? 'Selected for content planning' : 'Select for content planning'}
          >
            {isSelected ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Suggested topics */}
          {cluster.suggestedTopics && cluster.suggestedTopics.length > 0 && (
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  Suggested Content Topics
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {cluster.suggestedTopics.map((topic, i) => (
                  <span 
                    key={i}
                    className="px-2 py-1 bg-white border border-blue-200 rounded text-sm text-blue-800"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Content gaps */}
          {cluster.contentGaps && cluster.contentGaps.length > 0 && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-900">
                  Content Gaps
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {cluster.contentGaps.map((gap, i) => (
                  <span 
                    key={i}
                    className="px-2 py-1 bg-white border border-amber-200 rounded text-sm text-amber-800"
                  >
                    {gap}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Keywords list header */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Keywords
            </span>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="w-16 text-right">Volume</span>
              <span className="w-20">Difficulty</span>
              <span className="w-12 text-center">Rank</span>
              <span className="w-6">URL</span>
            </div>
          </div>
          
          {/* Keywords list */}
          <ClusterKeywordList 
            keywords={cluster.keywords}
            showAll={showAllKeywords}
            onShowMore={() => setShowAllKeywords(true)}
          />
        </div>
      )}
    </div>
  );
}

export default KeywordClusterCard;
