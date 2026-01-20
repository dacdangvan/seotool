'use client';

/**
 * Keyword Overview KPI Cards
 * 
 * Displays 4 key metrics for keyword research:
 * - Total Keywords
 * - High Opportunity Keywords
 * - Transactional Keywords
 * - Unmapped Keywords
 * 
 * Manager-friendly display without raw SEO jargon
 */

import React from 'react';
import { cn, formatNumber, formatPercent } from '@/lib/utils';
import type { KeywordKPIs } from '@/types/keyword.types';
import { 
  KeyRound, 
  TrendingUp, 
  ShoppingCart, 
  Unlink,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

interface KeywordOverviewCardsProps {
  kpis: KeywordKPIs;
  loading?: boolean;
}

interface KPICardProps {
  title: string;
  value: number;
  change: number;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
  onClick?: () => void;
}

function KPICard({ 
  title, 
  value, 
  change, 
  description, 
  icon, 
  colorClass,
  onClick 
}: KPICardProps) {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const isNeutral = change === 0;

  return (
    <div 
      className={cn(
        'bg-white rounded-xl border border-gray-200 p-6 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:border-gray-300'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className={cn('p-3 rounded-lg', colorClass)}>
          {icon}
        </div>
        <div className={cn(
          'flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full',
          isPositive && 'text-green-700 bg-green-50',
          isNegative && 'text-red-700 bg-red-50',
          isNeutral && 'text-gray-600 bg-gray-100'
        )}>
          {isPositive && <ArrowUp className="w-3 h-3" />}
          {isNegative && <ArrowDown className="w-3 h-3" />}
          {isNeutral && <Minus className="w-3 h-3" />}
          <span>{formatPercent(Math.abs(change))}</span>
        </div>
      </div>
      
      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="text-3xl font-bold text-gray-900 mt-1">
          {formatNumber(value)}
        </p>
        <p className="text-xs text-gray-400 mt-1">{description}</p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div 
          key={i}
          className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 bg-gray-200 rounded-lg" />
            <div className="w-16 h-6 bg-gray-200 rounded-full" />
          </div>
          <div className="mt-4">
            <div className="w-24 h-4 bg-gray-200 rounded" />
            <div className="w-16 h-8 bg-gray-200 rounded mt-2" />
            <div className="w-32 h-3 bg-gray-200 rounded mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function KeywordOverviewCards({ kpis, loading }: KeywordOverviewCardsProps) {
  if (loading) {
    return <LoadingSkeleton />;
  }

  const cards: KPICardProps[] = [
    {
      title: 'Tổng từ khóa',
      value: kpis.totalKeywords,
      change: kpis.totalKeywordsChange,
      description: 'Từ khóa đang theo dõi',
      icon: <KeyRound className="w-5 h-5 text-blue-600" />,
      colorClass: 'bg-blue-50',
    },
    {
      title: 'Cơ hội cao',
      value: kpis.highOpportunityKeywords,
      change: kpis.highOpportunityChange,
      description: 'Volume cao, độ khó thấp',
      icon: <TrendingUp className="w-5 h-5 text-emerald-600" />,
      colorClass: 'bg-emerald-50',
    },
    {
      title: 'Từ khóa giao dịch',
      value: kpis.transactionalKeywords,
      change: kpis.transactionalChange,
      description: 'Có ý định mua hàng',
      icon: <ShoppingCart className="w-5 h-5 text-violet-600" />,
      colorClass: 'bg-violet-50',
    },
    {
      title: 'Chưa ánh xạ',
      value: kpis.unmappedKeywords,
      change: kpis.unmappedChange,
      description: 'Cần liên kết trang đích',
      icon: <Unlink className="w-5 h-5 text-amber-600" />,
      colorClass: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <KPICard key={index} {...card} />
      ))}
    </div>
  );
}

export default KeywordOverviewCards;
