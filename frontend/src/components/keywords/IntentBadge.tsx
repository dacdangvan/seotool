'use client';

/**
 * Intent Badge Component
 * 
 * Displays search intent with explanatory tooltip:
 * - Transactional: Ready to buy
 * - Commercial: Considering/comparing
 * - Informational: Learning/researching
 * - Navigational: Brand/site search
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import type { SearchIntent } from '@/types/keyword.types';
import { SEARCH_INTENT_CONFIG } from '@/types/keyword.types';
import { 
  ShoppingCart, 
  Search, 
  BookOpen, 
  Navigation,
  HelpCircle,
  X,
} from 'lucide-react';

// Intent icons mapping
const INTENT_ICONS: Record<SearchIntent, React.ElementType> = {
  transactional: ShoppingCart,
  commercial: Search,
  informational: BookOpen,
  navigational: Navigation,
};

// Extended intent descriptions for tooltip
const INTENT_DETAILS: Record<SearchIntent, {
  vietnameseLabel: string;
  examples: string[];
  seoTip: string;
}> = {
  transactional: {
    vietnameseLabel: 'Mua hàng',
    examples: ['mua thẻ tín dụng online', 'đăng ký vay tiêu dùng', 'mở tài khoản VIB'],
    seoTip: 'Tối ưu trang landing với CTA rõ ràng, form đăng ký, và thông tin sản phẩm chi tiết.',
  },
  commercial: {
    vietnameseLabel: 'So sánh',
    examples: ['so sánh thẻ tín dụng', 'đánh giá lãi suất vay', 'review VIB vs Techcombank'],
    seoTip: 'Tạo content so sánh, bảng giá, và highlight USPs của sản phẩm.',
  },
  informational: {
    vietnameseLabel: 'Tìm hiểu',
    examples: ['thẻ tín dụng là gì', 'cách tính lãi suất vay', 'quy trình mở tài khoản'],
    seoTip: 'Viết bài hướng dẫn chi tiết, FAQ, và content educational để build trust.',
  },
  navigational: {
    vietnameseLabel: 'Điều hướng',
    examples: ['VIB online', 'VIB hotline', 'chi nhánh VIB quận 1'],
    seoTip: 'Đảm bảo brand keywords dẫn đúng trang, optimize Google Business Profile.',
  },
};

interface IntentBadgeProps {
  intent: SearchIntent;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showTooltip?: boolean;
  className?: string;
}

interface IntentTooltipProps {
  intent: SearchIntent;
  onClose: () => void;
}

function IntentTooltip({ intent, onClose }: IntentTooltipProps) {
  const config = SEARCH_INTENT_CONFIG[intent];
  const details = INTENT_DETAILS[intent];
  const Icon = INTENT_ICONS[intent];

  return (
    <div className="absolute z-50 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-4 left-0 top-full mt-2">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg', config.bgColor)}>
            <Icon className={cn('w-5 h-5', config.color)} />
          </div>
          <div>
            <div className={cn('font-semibold', config.color)}>{config.label}</div>
            <div className="text-xs text-gray-500">{details.vietnameseLabel}</div>
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

      {/* Examples */}
      <div className="mb-3">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
          Ví dụ từ khóa
        </div>
        <div className="flex flex-wrap gap-1.5">
          {details.examples.map((example, i) => (
            <span 
              key={i}
              className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700"
            >
              {example}
            </span>
          ))}
        </div>
      </div>

      {/* SEO Tip */}
      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
        <div className="text-xs font-medium text-blue-800 mb-1">💡 SEO Tip</div>
        <p className="text-xs text-blue-700">{details.seoTip}</p>
      </div>
    </div>
  );
}

export function IntentBadge({ 
  intent, 
  size = 'md', 
  showIcon = true,
  showTooltip = true,
  className,
}: IntentBadgeProps) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const config = SEARCH_INTENT_CONFIG[intent];
  const details = INTENT_DETAILS[intent];
  const Icon = INTENT_ICONS[intent];

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs gap-1',
    md: 'px-2 py-1 text-sm gap-1.5',
    lg: 'px-3 py-1.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => showTooltip && setIsTooltipOpen(!isTooltipOpen)}
        onMouseEnter={() => showTooltip && setIsTooltipOpen(true)}
        onMouseLeave={() => showTooltip && setIsTooltipOpen(false)}
        className={cn(
          'inline-flex items-center rounded-full font-medium transition-all',
          config.bgColor,
          config.color,
          sizeClasses[size],
          showTooltip && 'cursor-help hover:ring-2 hover:ring-offset-1',
          showTooltip && intent === 'transactional' && 'hover:ring-green-300',
          showTooltip && intent === 'commercial' && 'hover:ring-blue-300',
          showTooltip && intent === 'informational' && 'hover:ring-purple-300',
          showTooltip && intent === 'navigational' && 'hover:ring-gray-300',
          className
        )}
      >
        {showIcon && <Icon className={iconSizes[size]} />}
        <span>{details.vietnameseLabel}</span>
        {showTooltip && <HelpCircle className={cn('opacity-50', iconSizes[size])} />}
      </button>

      {isTooltipOpen && showTooltip && (
        <IntentTooltip intent={intent} onClose={() => setIsTooltipOpen(false)} />
      )}
    </div>
  );
}

/**
 * Intent Legend Component
 * Shows all intent types with explanations
 */
export function IntentLegend({ className }: { className?: string }) {
  const [expandedIntent, setExpandedIntent] = useState<SearchIntent | null>(null);

  const intents: SearchIntent[] = ['transactional', 'commercial', 'informational', 'navigational'];

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="w-5 h-5 text-gray-400" />
        <h3 className="font-medium text-gray-900">Search Intent Guide</h3>
      </div>
      
      <div className="space-y-2">
        {intents.map(intent => {
          const config = SEARCH_INTENT_CONFIG[intent];
          const details = INTENT_DETAILS[intent];
          const Icon = INTENT_ICONS[intent];
          const isExpanded = expandedIntent === intent;

          return (
            <div 
              key={intent}
              className={cn(
                'rounded-lg border transition-all cursor-pointer',
                isExpanded ? 'border-gray-300 bg-gray-50' : 'border-transparent hover:bg-gray-50'
              )}
            >
              <button
                type="button"
                onClick={() => setExpandedIntent(isExpanded ? null : intent)}
                className="w-full flex items-center gap-3 p-2"
              >
                <div className={cn('p-1.5 rounded-lg', config.bgColor)}>
                  <Icon className={cn('w-4 h-4', config.color)} />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-medium text-sm', config.color)}>
                      {config.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({details.vietnameseLabel})
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
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {details.examples.map((ex, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white border rounded text-xs">
                        {ex}
                      </span>
                    ))}
                  </div>
                  <div className="bg-blue-50 rounded p-2 text-xs text-blue-700">
                    💡 {details.seoTip}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default IntentBadge;
