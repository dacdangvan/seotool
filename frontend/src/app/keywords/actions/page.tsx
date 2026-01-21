'use client';

/**
 * Keyword Actions Page
 * 
 * Display and manage AI-generated action suggestions:
 * - List actionable suggestions per keyword/cluster
 * - Show expected impact
 * - Allow approve / ignore (role-based)
 * - Track execution status
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Module 1 – Keyword Intelligence Agent
 */

import React, { useState, useMemo } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import {
  KeywordActionCard,
  KeywordActionList,
  ActionSummary,
  type KeywordAction,
  type ActionType,
  type ActionPriority,
  type ActionStatus,
} from '@/components/keywords/KeywordActionCard';
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Download,
  Settings,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Filter,
  Play,
  Pause,
} from 'lucide-react';
import Link from 'next/link';

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_ACTIONS: KeywordAction[] = [
  {
    id: '1',
    type: 'create_content',
    title: 'Create landing page for "thẻ tín dụng online"',
    description: 'High-volume transactional keyword without dedicated content. Creating optimized landing page could capture significant search traffic.',
    reasoning: 'This keyword has 15,000 monthly searches with transactional intent, but currently no dedicated page targets it. Competitors have dedicated pages ranking in top 5. Creating content with proper structure and CTAs could rank within 2-4 weeks.',
    priority: 'critical',
    status: 'pending',
    confidence: 'high',
    expectedImpact: {
      trafficChange: 25,
      rankingChange: 15,
      timeToImpact: '2-4 weeks',
      confidenceScore: 85,
    },
    keyword: 'thẻ tín dụng online',
    keywordId: 'kw-1',
    riskLevel: 'low',
    reversible: true,
    createdAt: '2025-01-18',
    updatedAt: '2025-01-18',
    createdBy: 'ai',
  },
  {
    id: '2',
    type: 'fix_cannibalization',
    title: 'Resolve cannibalization for "mở thẻ tín dụng"',
    description: '3 pages competing for the same keyword. Consolidate content and implement proper canonical strategy.',
    reasoning: 'Multiple pages are ranking for "mở thẻ tín dụng", causing ranking fluctuations. The main product page should be the canonical target. Other pages should either be 301 redirected or have distinct focus keywords.',
    priority: 'high',
    status: 'pending',
    confidence: 'high',
    expectedImpact: {
      trafficChange: 18,
      rankingChange: 8,
      timeToImpact: '1-2 weeks',
      confidenceScore: 90,
    },
    keyword: 'mở thẻ tín dụng',
    keywordId: 'kw-2',
    targetUrl: 'https://www.vib.com.vn/vn/the-tin-dung',
    riskLevel: 'medium',
    reversible: true,
    createdAt: '2025-01-17',
    updatedAt: '2025-01-17',
    createdBy: 'ai',
  },
  {
    id: '3',
    type: 'optimize_content',
    title: 'Optimize VIB IvyCard page for featured snippet',
    description: 'Page ranks #4 for "thẻ ivy card là gì". Restructure content to capture featured snippet.',
    reasoning: 'The current page has good content but lacks proper FAQ schema and question-answer format. Adding structured FAQ section and optimizing for voice search queries could capture the featured snippet position.',
    priority: 'high',
    status: 'approved',
    confidence: 'medium',
    expectedImpact: {
      trafficChange: 35,
      rankingChange: 3,
      timeToImpact: '2-3 weeks',
      confidenceScore: 72,
    },
    keyword: 'thẻ ivy card là gì',
    keywordId: 'kw-3',
    targetUrl: 'https://www.vib.com.vn/vn/the-tin-dung/vib-ivycard',
    riskLevel: 'safe',
    reversible: true,
    createdAt: '2025-01-16',
    updatedAt: '2025-01-18',
    createdBy: 'ai',
    approvedBy: 'admin@vib.com.vn',
  },
  {
    id: '4',
    type: 'add_internal_link',
    title: 'Add internal links to credit card comparison page',
    description: 'Build authority to comparison page by adding contextual internal links from high-traffic pages.',
    reasoning: 'The comparison page has only 3 internal links pointing to it. Adding links from product pages and blog posts with relevant anchor text will improve its authority score and rankings.',
    priority: 'medium',
    status: 'executing',
    confidence: 'high',
    expectedImpact: {
      trafficChange: 12,
      rankingChange: 5,
      timeToImpact: '3-4 weeks',
      confidenceScore: 82,
    },
    clusterName: 'Credit Card Comparison',
    clusterId: 'cluster-1',
    targetUrl: 'https://www.vib.com.vn/vn/the-tin-dung/so-sanh',
    riskLevel: 'safe',
    reversible: true,
    createdAt: '2025-01-15',
    updatedAt: '2025-01-19',
    createdBy: 'ai',
    approvedBy: 'editor@vib.com.vn',
  },
  {
    id: '5',
    type: 'update_meta',
    title: 'Update meta description for cashback page',
    description: 'Current meta description has low CTR. Rewrite with compelling value proposition.',
    reasoning: 'CTR is 2.1% vs 4.5% expected for position. The meta description lacks call-to-action and doesn\'t highlight key benefits. A/B testing suggests value-focused descriptions perform 60% better.',
    priority: 'medium',
    status: 'completed',
    confidence: 'high',
    expectedImpact: {
      trafficChange: 8,
      rankingChange: 0,
      timeToImpact: '1 week',
      confidenceScore: 88,
    },
    keyword: 'hoàn tiền thẻ tín dụng',
    keywordId: 'kw-5',
    targetUrl: 'https://www.vib.com.vn/vn/the-tin-dung/cashback',
    riskLevel: 'safe',
    reversible: true,
    createdAt: '2025-01-14',
    updatedAt: '2025-01-17',
    createdBy: 'ai',
    approvedBy: 'editor@vib.com.vn',
    executedAt: '2025-01-17',
  },
  {
    id: '6',
    type: 'expand_cluster',
    title: 'Expand "Credit Card Benefits" cluster',
    description: 'Add 8 related long-tail keywords to strengthen topical authority.',
    reasoning: 'Cluster currently covers 12 keywords. Semantic analysis found 8 additional keywords with combined 4,500 monthly searches that naturally fit the topic. Expanding coverage will improve overall cluster rankings.',
    priority: 'low',
    status: 'pending',
    confidence: 'medium',
    expectedImpact: {
      trafficChange: 15,
      rankingChange: 4,
      timeToImpact: '4-6 weeks',
      confidenceScore: 68,
    },
    clusterName: 'Credit Card Benefits',
    clusterId: 'cluster-2',
    riskLevel: 'safe',
    reversible: true,
    createdAt: '2025-01-18',
    updatedAt: '2025-01-18',
    createdBy: 'ai',
  },
  {
    id: '7',
    type: 'target_featured',
    title: 'Target featured snippet for "điều kiện mở thẻ tín dụng"',
    description: 'Keyword has featured snippet opportunity. Optimize content format.',
    reasoning: 'Current featured snippet shows a competitor list. Our page has better content but lacks proper list formatting. Adding a numbered list at the top of the page with clear requirements could capture position zero.',
    priority: 'medium',
    status: 'pending',
    confidence: 'medium',
    expectedImpact: {
      trafficChange: 40,
      rankingChange: 5,
      timeToImpact: '2-4 weeks',
      confidenceScore: 65,
    },
    keyword: 'điều kiện mở thẻ tín dụng',
    keywordId: 'kw-7',
    targetUrl: 'https://www.vib.com.vn/vn/the-tin-dung/dieu-kien',
    riskLevel: 'safe',
    reversible: true,
    createdAt: '2025-01-18',
    updatedAt: '2025-01-18',
    createdBy: 'ai',
  },
  {
    id: '8',
    type: 'improve_ranking',
    title: 'Improve ranking for "vib rewards unlimited"',
    description: 'Currently ranking #8. Optimize on-page factors to reach top 3.',
    reasoning: 'Page has good content but title tag is not optimized, H1 doesn\'t include full keyword, and internal link count is low. Addressing these factors could improve position by 4-5 spots.',
    priority: 'medium',
    status: 'failed',
    confidence: 'medium',
    expectedImpact: {
      trafficChange: 22,
      rankingChange: 5,
      timeToImpact: '2-3 weeks',
      confidenceScore: 70,
    },
    keyword: 'vib rewards unlimited',
    keywordId: 'kw-8',
    targetUrl: 'https://www.vib.com.vn/vn/the-tin-dung/vib-rewards-unlimited',
    riskLevel: 'low',
    reversible: true,
    createdAt: '2025-01-13',
    updatedAt: '2025-01-16',
    createdBy: 'ai',
    approvedBy: 'admin@vib.com.vn',
  },
  {
    id: '9',
    type: 'create_content',
    title: 'Create FAQ schema for product pages',
    description: 'Add structured FAQ data to improve SERP appearance and capture voice searches.',
    reasoning: 'None of the credit card product pages have FAQ schema. Adding FAQ markup with common questions could increase click-through rates by 10-15% and enable rich snippets.',
    priority: 'low',
    status: 'ignored',
    confidence: 'medium',
    expectedImpact: {
      trafficChange: 10,
      rankingChange: 0,
      timeToImpact: '1-2 weeks',
      confidenceScore: 75,
    },
    clusterName: 'Product Pages',
    clusterId: 'cluster-3',
    riskLevel: 'safe',
    reversible: true,
    createdAt: '2025-01-12',
    updatedAt: '2025-01-14',
    createdBy: 'ai',
  },
];

// =============================================================================
// QUICK STATS COMPONENT
// =============================================================================

interface QuickStatProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

function QuickStat({ label, value, icon, color, bgColor }: QuickStatProps) {
  return (
    <div className={cn('rounded-lg border p-4', bgColor)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className={cn('mt-1 text-2xl font-bold', color)}>{value}</p>
        </div>
        <div className={cn('p-2 rounded-lg', bgColor)}>{icon}</div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function KeywordActionsPage() {
  // State
  const [actions, setActions] = useState<KeywordAction[]>(MOCK_ACTIONS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoExecuteEnabled, setAutoExecuteEnabled] = useState(false);

  // Mock user role (in real app, get from auth context)
  const userRole = 'admin' as 'viewer' | 'editor' | 'admin';
  const canApprove = userRole === 'editor' || userRole === 'admin';
  const canExecute = userRole === 'admin';

  // Calculate stats
  const stats = useMemo(() => {
    const pending = actions.filter(a => a.status === 'pending');
    const criticalHigh = pending.filter(a => a.priority === 'critical' || a.priority === 'high');
    const totalExpectedImpact = pending.reduce((sum, a) => sum + a.expectedImpact.trafficChange, 0);
    const approved = actions.filter(a => a.status === 'approved').length;
    const executing = actions.filter(a => a.status === 'executing').length;
    const completed = actions.filter(a => a.status === 'completed').length;

    return {
      pending: pending.length,
      criticalHigh: criticalHigh.length,
      totalExpectedImpact,
      approved,
      executing,
      completed,
      total: actions.length,
    };
  }, [actions]);

  // Handlers
  const handleApprove = async (actionId: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setActions(prev => prev.map(a => 
      a.id === actionId 
        ? { ...a, status: 'approved' as ActionStatus, approvedBy: 'current-user@vib.com.vn' }
        : a
    ));
  };

  const handleIgnore = async (actionId: string) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    setActions(prev => prev.map(a =>
      a.id === actionId ? { ...a, status: 'ignored' as ActionStatus } : a
    ));
  };

  const handleExecute = async (actionId: string) => {
    setActions(prev => prev.map(a =>
      a.id === actionId ? { ...a, status: 'executing' as ActionStatus } : a
    ));
    
    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setActions(prev => prev.map(a =>
      a.id === actionId 
        ? { ...a, status: 'completed' as ActionStatus, executedAt: new Date().toISOString() }
        : a
    ));
  };

  const handleRetry = async (actionId: string) => {
    setActions(prev => prev.map(a =>
      a.id === actionId ? { ...a, status: 'approved' as ActionStatus } : a
    ));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };

  const handleBulkApprove = async () => {
    const safeActions = actions.filter(
      a => a.status === 'pending' && 
           (a.riskLevel === 'safe' || a.riskLevel === 'low') &&
           a.expectedImpact.confidenceScore >= 80
    );

    for (const action of safeActions) {
      await handleApprove(action.id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/keywords"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-500" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-blue-600" />
                  AI Action Suggestions
                </h1>
                <p className="text-sm text-gray-500">
                  Review and approve AI-generated SEO recommendations
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Auto-execute toggle */}
              {canExecute && (
                <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoExecuteEnabled}
                    onChange={(e) => setAutoExecuteEnabled(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Auto-execute safe</span>
                </label>
              )}

              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium',
                  'text-gray-700 bg-white border border-gray-300 rounded-lg',
                  'hover:bg-gray-50 disabled:opacity-50'
                )}
              >
                <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                Refresh
              </button>

              {canApprove && stats.pending > 0 && (
                <button
                  onClick={handleBulkApprove}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium',
                    'text-white bg-green-600 hover:bg-green-700 rounded-lg'
                  )}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Bulk Approve Safe
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <QuickStat
            label="Pending Review"
            value={stats.pending}
            icon={<Clock className="h-5 w-5 text-yellow-600" />}
            color="text-yellow-700"
            bgColor="bg-yellow-50 border-yellow-200"
          />
          <QuickStat
            label="Critical/High"
            value={stats.criticalHigh}
            icon={<AlertTriangle className="h-5 w-5 text-orange-600" />}
            color="text-orange-700"
            bgColor="bg-orange-50 border-orange-200"
          />
          <QuickStat
            label="Expected Impact"
            value={`+${stats.totalExpectedImpact}%`}
            icon={<Sparkles className="h-5 w-5 text-green-600" />}
            color="text-green-700"
            bgColor="bg-green-50 border-green-200"
          />
          <QuickStat
            label="In Progress"
            value={stats.approved + stats.executing}
            icon={<Play className="h-5 w-5 text-blue-600" />}
            color="text-blue-700"
            bgColor="bg-blue-50 border-blue-200"
          />
          <QuickStat
            label="Completed"
            value={stats.completed}
            icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
            color="text-green-700"
            bgColor="bg-green-50 border-green-200"
          />
        </div>

        {/* AI Summary */}
        <ActionSummary actions={actions} className="mb-6" />

        {/* Role-based info banner */}
        {!canApprove && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">View Only Mode</h3>
              <p className="mt-1 text-sm text-blue-700">
                You can view action suggestions but need Editor or Admin role to approve or ignore them.
              </p>
            </div>
          </div>
        )}

        {/* Action List */}
        <KeywordActionList
          actions={actions}
          canApprove={canApprove}
          canExecute={canExecute}
          onApprove={handleApprove}
          onIgnore={handleIgnore}
          onExecute={handleExecute}
          onRetry={handleRetry}
          showFilters
        />
      </main>
    </div>
  );
}
