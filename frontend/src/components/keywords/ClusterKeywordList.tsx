'use client';

/**
 * Cluster Keyword List Component
 * 
 * Displays keywords within a cluster with key metrics
 */

import React from 'react';
import { cn, formatCompact } from '@/lib/utils';
import type { Keyword, SearchIntent } from '@/types/keyword.types';
import { SEARCH_INTENT_CONFIG } from '@/types/keyword.types';
import { OpportunityBadge } from './OpportunityBadge';
import { 
  ArrowUp, 
  ArrowDown, 
  Minus, 
  ExternalLink,
  Link2Off,
} from 'lucide-react';

interface ClusterKeywordListProps {
  keywords: Keyword[];
  maxDisplay?: number;
  showAll?: boolean;
  onShowMore?: () => void;
}

function IntentDot({ intent }: { intent: SearchIntent }) {
  const config = SEARCH_INTENT_CONFIG[intent];
  return (
    <span 
      className={cn('inline-block w-2 h-2 rounded-full', config.bgColor)}
      title={config.label}
    />
  );
}

function DifficultyBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={cn(
            'h-full rounded-full',
            score <= 30 && 'bg-green-500',
            score > 30 && score <= 60 && 'bg-yellow-500',
            score > 60 && score <= 80 && 'bg-orange-500',
            score > 80 && 'bg-red-500',
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-6">{score}</span>
    </div>
  );
}

function RankIndicator({ rank, change }: { rank: number | null; change: number | null }) {
  if (rank === null) return <span className="text-gray-300 text-xs">—</span>;
  
  return (
    <div className="flex items-center gap-0.5">
      <span className="text-xs font-medium text-gray-600">#{rank}</span>
      {change !== null && change !== 0 && (
        <span className={cn(
          'text-xs',
          change > 0 ? 'text-green-600' : 'text-red-600'
        )}>
          {change > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        </span>
      )}
    </div>
  );
}

export function ClusterKeywordList({ 
  keywords, 
  maxDisplay = 10,
  showAll = false,
  onShowMore,
}: ClusterKeywordListProps) {
  const displayedKeywords = showAll ? keywords : keywords.slice(0, maxDisplay);
  const hasMore = !showAll && keywords.length > maxDisplay;

  if (keywords.length === 0) {
    return (
      <div className="py-4 text-center text-gray-400 text-sm">
        No keywords in this cluster
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {displayedKeywords.map((kw) => (
        <div 
          key={kw.id}
          className="flex items-center gap-3 py-2.5 px-4 hover:bg-gray-50 transition-colors"
        >
          {/* Intent indicator */}
          <IntentDot intent={kw.intent} />
          
          {/* Keyword */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-900 truncate">{kw.keyword}</span>
              {kw.opportunity === 'high' && (
                <OpportunityBadge 
                  opportunity={kw.opportunity} 
                  size="xs" 
                  variant="compact"
                  showTooltip={false}
                />
              )}
            </div>
          </div>
          
          {/* Volume */}
          <div className="w-16 text-right">
            <span className="text-sm font-medium text-gray-700">
              {formatCompact(kw.searchVolume)}
            </span>
          </div>
          
          {/* Difficulty */}
          <div className="w-20">
            <DifficultyBar score={kw.difficulty} />
          </div>
          
          {/* Rank */}
          <div className="w-12 text-center">
            <RankIndicator rank={kw.currentRank} change={kw.rankChange} />
          </div>
          
          {/* Mapping status */}
          <div className="w-6">
            {kw.mappedUrl ? (
              <a
                href={kw.mappedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700"
                title={kw.mappedUrl}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span className="text-amber-400" title="Unmapped">
                <Link2Off className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>
      ))}
      
      {/* Show more button */}
      {hasMore && onShowMore && (
        <button
          onClick={onShowMore}
          className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
        >
          Show {keywords.length - maxDisplay} more keywords
        </button>
      )}
    </div>
  );
}

export default ClusterKeywordList;
