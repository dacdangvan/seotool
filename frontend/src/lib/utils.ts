/**
 * Utility Functions
 * 
 * v0.7 - Helpers for formatting and display
 */

import { clsx, type ClassValue } from 'clsx';

/**
 * Merge class names
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format number as compact (e.g., 47.5K)
 */
export function formatCompact(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Format percent with sign
 */
export function formatPercent(num: number, showSign = true): string {
  const sign = showSign && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}%`;
}

/**
 * Format change with arrow
 */
export function formatChange(num: number): { text: string; color: string; arrow: string } {
  if (num > 0) {
    return {
      text: `+${formatNumber(num)}`,
      color: 'text-green-600',
      arrow: '↑',
    };
  }
  if (num < 0) {
    return {
      text: formatNumber(num),
      color: 'text-red-600',
      arrow: '↓',
    };
  }
  return {
    text: '0',
    color: 'text-gray-500',
    arrow: '→',
  };
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }
  return 'Just now';
}

/**
 * Get status color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'warning':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical':
      return 'text-red-700 bg-red-100 border-red-300';
    case 'high':
      return 'text-orange-700 bg-orange-100 border-orange-300';
    case 'medium':
      return 'text-yellow-700 bg-yellow-100 border-yellow-300';
    case 'low':
      return 'text-blue-700 bg-blue-100 border-blue-300';
    default:
      return 'text-gray-700 bg-gray-100 border-gray-300';
  }
}

/**
 * Get impact/effort badge color
 */
export function getLevelColor(level: string): string {
  switch (level) {
    case 'high':
      return 'bg-red-100 text-red-700';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700';
    case 'low':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Get health score color
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Get trend icon and color
 */
export function getTrendDisplay(trend: string): { icon: string; color: string; label: string } {
  switch (trend) {
    case 'up':
    case 'increasing':
      return { icon: '↑', color: 'text-green-600', label: 'Increasing' };
    case 'down':
    case 'decreasing':
      return { icon: '↓', color: 'text-red-600', label: 'Decreasing' };
    default:
      return { icon: '→', color: 'text-gray-500', label: 'Stable' };
  }
}
