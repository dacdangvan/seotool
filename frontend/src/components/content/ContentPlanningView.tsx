'use client';

/**
 * Content Planning View Component
 * 
 * Integrated view showing:
 * - Keywords awaiting content action
 * - Content Briefs in various stages
 * - Keyword → Content mapping overview
 * - Cannibalization dashboard
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Section 12 – Keyword Research ↔ Content Engine Integration
 */

import React, { useState, useMemo, useCallback } from 'react';
import { cn, formatNumber, formatCompact, formatPercent } from '@/lib/utils';
import type { SearchIntent, OpportunityLevel, Keyword } from '@/types/keyword.types';
import { SEARCH_INTENT_CONFIG, OPPORTUNITY_CONFIG } from '@/types/keyword.types';
import type { 
  ContentBrief, 
  ContentType, 
  ContentMode, 
  BriefStatus,
  CannibalizationStatus 
} from './ContentBrief';
import {
  ContentBriefCard,
  ContentTypeBadge,
  ContentModeBadge,
  BriefStatusBadge,
  CannibalizationBadge,
  CONTENT_TYPE_CONFIG,
  CONTENT_MODE_CONFIG,
  BRIEF_STATUS_CONFIG,
  CANNIBALIZATION_STATUS_CONFIG,
} from './ContentBrief';
import type { KeywordWithMapping, KeywordMappingAction } from './KeywordContentActions';
import { KeywordContentActions, KeywordBulkActions } from './KeywordContentActions';
import {
  FileText,
  FilePlus2,
  FileEdit,
  FileCheck,
  FileX,
  Target,
  Sparkles,
  Link2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  LayoutGrid,
  List,
  TrendingUp,
  Clock,
  Eye,
  Layers,
  GitBranch,
  BarChart3,
  PieChart,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

// =============================================================================
// TYPES
// =============================================================================

export type PlanningViewTab = 
  | 'keywords'      // Keywords awaiting action
  | 'briefs'        // Content briefs
  | 'mapping'       // Keyword-content mapping
  | 'health';       // Cannibalization overview

export type KeywordFilterOption = 
  | 'all'
  | 'unmapped'
  | 'mapped'
  | 'high_opportunity'
  | 'needs_action';

export interface ContentPlanningStats {
  totalKeywords: number;
  unmappedKeywords: number;
  mappedKeywords: number;
  highOpportunityKeywords: number;
  totalBriefs: number;
  briefsByStatus: Record<BriefStatus, number>;
  cannibalizationIssues: number;
  potentialTraffic: number;
}

// =============================================================================
// MOCK DATA GENERATOR
// =============================================================================

const generateMockKeywords = (): KeywordWithMapping[] => [
  {
    id: 'kw-001',
    keyword: 'best seo tools 2024',
    searchVolume: 12500,
    difficulty: 68,
    difficultyLevel: 'hard',
    cpc: 4.5,
    intent: 'commercial',
    trend: 'up',
    opportunity: 'high',
    currentRank: null,
    previousRank: null,
    rankChange: null,
    clusterId: null,
    clusterName: null,
    mappedUrl: null,
    lastUpdated: '2024-01-15',
    selectedAction: undefined,
    mappingSuggestions: [
      {
        url: '/tools/seo-suite',
        title: 'SEO Tool Suite Overview',
        currentRanking: 23,
        matchScore: 78,
        reason: 'Related topic, could expand with 2024 comparison section',
        cannibalizationRisk: 'warning',
      },
      {
        url: '/blog/seo-guide',
        title: 'Complete SEO Guide',
        matchScore: 45,
        reason: 'General SEO content, low relevance for tool comparison',
        cannibalizationRisk: 'clear',
      },
    ],
  },
  {
    id: 'kw-002',
    keyword: 'how to improve website speed',
    searchVolume: 8200,
    difficulty: 45,
    difficultyLevel: 'medium',
    cpc: 2.8,
    intent: 'informational',
    trend: 'stable',
    opportunity: 'high',
    currentRank: 8,
    previousRank: 12,
    rankChange: 4,
    clusterId: null,
    clusterName: null,
    mappedUrl: '/blog/website-speed-optimization',
    lastUpdated: '2024-01-15',
    selectedAction: 'optimize_existing',
    briefs: ['brief-002'],
    mappingSuggestions: [
      {
        url: '/blog/website-speed-optimization',
        title: 'Website Speed Optimization Guide',
        currentRanking: 8,
        matchScore: 95,
        reason: 'Direct match, optimize for better ranking',
        cannibalizationRisk: 'clear',
      },
    ],
  },
  {
    id: 'kw-003',
    keyword: 'core web vitals checker',
    searchVolume: 6800,
    difficulty: 52,
    difficultyLevel: 'medium',
    cpc: 3.2,
    intent: 'transactional',
    trend: 'up',
    opportunity: 'medium',
    currentRank: null,
    previousRank: null,
    rankChange: null,
    clusterId: null,
    clusterName: null,
    mappedUrl: null,
    lastUpdated: '2024-01-15',
    selectedAction: 'create_new',
    briefs: ['brief-001'],
  },
  {
    id: 'kw-004',
    keyword: 'seo audit template',
    searchVolume: 4500,
    difficulty: 38,
    difficultyLevel: 'medium',
    cpc: 2.5,
    intent: 'commercial',
    trend: 'stable',
    opportunity: 'medium',
    currentRank: null,
    previousRank: null,
    rankChange: null,
    clusterId: null,
    clusterName: null,
    mappedUrl: null,
    lastUpdated: '2024-01-15',
    selectedAction: undefined,
    mappingSuggestions: [
      {
        url: '/resources/templates',
        title: 'Free SEO Templates',
        matchScore: 82,
        reason: 'Templates section, add new audit template',
        cannibalizationRisk: 'clear',
      },
    ],
  },
  {
    id: 'kw-005',
    keyword: 'what is domain authority',
    searchVolume: 22000,
    difficulty: 55,
    difficultyLevel: 'medium',
    cpc: 1.8,
    intent: 'informational',
    trend: 'stable',
    opportunity: 'low',
    currentRank: 15,
    previousRank: 15,
    rankChange: 0,
    clusterId: null,
    clusterName: null,
    mappedUrl: '/glossary/domain-authority',
    lastUpdated: '2024-01-15',
    selectedAction: 'ignore',
  },
];

const generateMockBriefs = (): ContentBrief[] => [
  {
    id: 'brief-001',
    keywordId: 'kw-003',
    primaryKeyword: 'core web vitals checker',
    secondaryKeywords: ['check core web vitals', 'cwv test', 'web vitals tool'],
    searchIntent: 'transactional',
    searchVolume: 6800,
    difficulty: 52,
    opportunity: 'medium',
    contentType: 'landing_page',
    contentMode: 'create',
    targetUrl: null,
    suggestedSlug: '/tools/core-web-vitals-checker',
    suggestedTitle: 'Free Core Web Vitals Checker - Test Your Site Performance',
    suggestedMetaDescription: 'Instantly check your Core Web Vitals scores with our free tool. Get actionable insights to improve LCP, FID, and CLS for better SEO rankings.',
    outline: [
      { level: 1, text: 'Core Web Vitals Checker Tool', wordCount: 50 },
      { level: 2, text: 'What are Core Web Vitals?', keywords: ['core web vitals'], wordCount: 200 },
      { level: 2, text: 'How to Use Our CWV Checker', wordCount: 150 },
      { level: 3, text: 'Interpreting Your Results', wordCount: 300 },
      { level: 2, text: 'Improve Your Scores', keywords: ['improve cwv'], wordCount: 400 },
    ],
    estimatedWordCount: 1100,
    internalLinks: [
      {
        url: '/blog/website-speed-optimization',
        title: 'Website Speed Optimization Guide',
        anchorText: 'speed optimization tips',
        relevanceScore: 92,
        reason: 'Directly related CWV improvement content',
      },
    ],
    cannibalizationStatus: 'clear',
    status: 'approved',
    createdAt: '2024-01-15',
    updatedAt: '2024-01-16',
    createdBy: 'ai',
    aiReasoning: 'Transactional intent indicates users want a tool. Creating a dedicated landing page with the checker tool will capture conversion-ready traffic.',
    confidenceScore: 88,
  },
  {
    id: 'brief-002',
    keywordId: 'kw-002',
    primaryKeyword: 'how to improve website speed',
    secondaryKeywords: ['website speed optimization', 'faster loading times', 'page speed tips'],
    searchIntent: 'informational',
    searchVolume: 8200,
    difficulty: 45,
    opportunity: 'high',
    contentType: 'guide',
    contentMode: 'optimize',
    targetUrl: '/blog/website-speed-optimization',
    suggestedTitle: 'How to Improve Website Speed: 15 Proven Optimization Tips',
    suggestedMetaDescription: 'Learn how to improve website speed with our comprehensive guide. 15 actionable tips to boost page load times and Core Web Vitals scores.',
    outline: [
      { level: 1, text: 'Complete Guide to Website Speed Optimization', wordCount: 100 },
      { level: 2, text: 'Why Website Speed Matters for SEO', wordCount: 250 },
      { level: 2, text: '15 Ways to Improve Page Load Speed', keywords: ['improve page speed'], wordCount: 1500 },
      { level: 3, text: 'Image Optimization', wordCount: 300 },
      { level: 3, text: 'Code Minification', wordCount: 200 },
      { level: 2, text: 'Measuring Your Results', wordCount: 200 },
    ],
    estimatedWordCount: 2550,
    internalLinks: [
      {
        url: '/tools/core-web-vitals-checker',
        title: 'Core Web Vitals Checker',
        anchorText: 'check your Core Web Vitals',
        relevanceScore: 95,
        reason: 'Link to tool for measuring speed improvements',
      },
    ],
    cannibalizationStatus: 'warning',
    cannibalizationDetails: {
      conflictingUrls: ['/blog/page-speed-tips'],
      conflictingKeywords: ['page speed tips'],
      recommendation: 'Consider consolidating with /blog/page-speed-tips or differentiating focus',
    },
    status: 'validated',
    createdAt: '2024-01-14',
    updatedAt: '2024-01-15',
    createdBy: 'ai',
    approvedBy: undefined,
    aiReasoning: 'Existing content ranks #8 but can reach top 5 with expanded sections. Informational intent matches guide format. Added 2024 focus to capture trending searches.',
    confidenceScore: 82,
  },
];

// =============================================================================
// STATS CALCULATION
// =============================================================================

function calculateStats(
  keywords: KeywordWithMapping[], 
  briefs: ContentBrief[]
): ContentPlanningStats {
  const unmappedKeywords = keywords.filter(k => !k.mappedUrl && k.selectedAction !== 'ignore').length;
  const highOpportunityKeywords = keywords.filter(k => k.opportunity === 'high').length;
  
  const briefsByStatus = briefs.reduce((acc, brief) => {
    acc[brief.status] = (acc[brief.status] || 0) + 1;
    return acc;
  }, {} as Record<BriefStatus, number>);
  
  const cannibalizationIssues = briefs.filter(
    b => b.cannibalizationStatus === 'warning' || b.cannibalizationStatus === 'blocked'
  ).length;

  const potentialTraffic = keywords
    .filter(k => k.opportunity === 'high' || k.opportunity === 'medium')
    .reduce((sum, k) => sum + Math.round(k.searchVolume * 0.15), 0);

  return {
    totalKeywords: keywords.length,
    unmappedKeywords,
    mappedKeywords: keywords.length - unmappedKeywords,
    highOpportunityKeywords,
    totalBriefs: briefs.length,
    briefsByStatus,
    cannibalizationIssues,
    potentialTraffic,
  };
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'stable';
  color?: string;
}

function StatsCard({ title, value, subtitle, icon: Icon, trend, color = 'text-blue-600' }: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className={cn('p-2 rounded-lg bg-gray-100', color.replace('text', 'bg').replace('600', '100'))}>
          <Icon className={cn('h-5 w-5', color)} />
        </div>
        {trend && (
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            trend === 'up' && 'bg-green-100 text-green-700',
            trend === 'down' && 'bg-red-100 text-red-700',
            trend === 'stable' && 'bg-gray-100 text-gray-600'
          )}>
            {trend === 'up' && '↑'}
            {trend === 'down' && '↓'}
            {trend === 'stable' && '→'}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-600 mt-0.5">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

interface StatusDistributionChartProps {
  data: Record<BriefStatus, number>;
  className?: string;
}

function StatusDistributionChart({ data, className }: StatusDistributionChartProps) {
  const chartData = (Object.entries(data) as [BriefStatus, number][])
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: BRIEF_STATUS_CONFIG[status].label,
      value: count,
      color: BRIEF_STATUS_CONFIG[status].color.replace('text', 'fill').replace('-600', '-500').replace('-700', '-600'),
      fill: status === 'draft' ? '#9ca3af' : 
            status === 'validated' ? '#3b82f6' :
            status === 'approved' ? '#22c55e' :
            status === 'in_progress' ? '#a855f7' : '#16a34a',
    }));

  if (chartData.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-32 text-gray-500 text-sm', className)}>
        No briefs created yet
      </div>
    );
  }

  return (
    <div className={cn('h-48', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RePieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={35}
            outerRadius={60}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value) => value !== undefined ? [value, 'Briefs'] : [0, 'Briefs']}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value) => <span className="text-xs">{value}</span>}
          />
        </RePieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface KeywordRowProps {
  keyword: KeywordWithMapping;
  isSelected: boolean;
  onSelect: () => void;
  onActionSelect: (action: KeywordMappingAction, url?: string) => void;
  onGenerateBrief: () => void;
  compact?: boolean;
}

function KeywordRow({
  keyword,
  isSelected,
  onSelect,
  onActionSelect,
  onGenerateBrief,
  compact = false,
}: KeywordRowProps) {
  const [expanded, setExpanded] = useState(false);
  const intentConfig = SEARCH_INTENT_CONFIG[keyword.intent];
  const opportunityConfig = OPPORTUNITY_CONFIG[keyword.opportunity || 'low'];

  return (
    <div className={cn(
      'border-b border-gray-100 last:border-0',
      expanded && 'bg-gray-50'
    )}>
      <div className="flex items-center gap-4 p-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="rounded border-gray-300"
        />
        
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-gray-200 rounded"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{keyword.keyword}</span>
            <span className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
              intentConfig.bgColor,
              intentConfig.color
            )}>
              {intentConfig.label}
            </span>
          </div>
          {!compact && (
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span>{formatCompact(keyword.searchVolume)} vol</span>
              <span>•</span>
              <span>KD: {keyword.difficulty}</span>
              {keyword.mappedUrl && (
                <>
                  <span>•</span>
                  <Link2 className="h-3 w-3" />
                  <span className="text-blue-600 truncate max-w-[150px]">{keyword.mappedUrl}</span>
                </>
              )}
            </div>
          )}
        </div>

        <span className={cn(
          'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
          opportunityConfig.bgColor,
          opportunityConfig.color
        )}>
          {opportunityConfig.label}
        </span>

        {keyword.selectedAction ? (
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
            keyword.selectedAction === 'create_new' && 'bg-green-100 text-green-700',
            keyword.selectedAction === 'optimize_existing' && 'bg-blue-100 text-blue-700',
            keyword.selectedAction === 'add_to_section' && 'bg-purple-100 text-purple-700',
            keyword.selectedAction === 'ignore' && 'bg-gray-100 text-gray-600',
          )}>
            {keyword.selectedAction === 'create_new' && <FilePlus2 className="h-3 w-3" />}
            {keyword.selectedAction === 'optimize_existing' && <FileEdit className="h-3 w-3" />}
            {keyword.selectedAction === 'add_to_section' && <FileText className="h-3 w-3" />}
            {keyword.selectedAction === 'ignore' && <FileX className="h-3 w-3" />}
            {keyword.selectedAction.replace('_', ' ')}
          </span>
        ) : (
          <span className="text-xs text-gray-400">No action</span>
        )}

        {keyword.briefs && keyword.briefs.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
            <FileCheck className="h-3 w-3" />
            {keyword.briefs.length}
          </span>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 pl-16">
          <KeywordContentActions
            keyword={keyword}
            onActionSelect={(_, action, url) => onActionSelect(action, url)}
            onGenerateBrief={onGenerateBrief}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface ContentPlanningViewProps {
  className?: string;
}

export function ContentPlanningView({ className }: ContentPlanningViewProps) {
  // State
  const [activeTab, setActiveTab] = useState<PlanningViewTab>('keywords');
  const [keywords, setKeywords] = useState<KeywordWithMapping[]>(generateMockKeywords);
  const [briefs, setBriefs] = useState<ContentBrief[]>(generateMockBriefs);
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<Set<string>>(new Set());
  const [keywordFilter, setKeywordFilter] = useState<KeywordFilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Computed
  const stats = useMemo(() => calculateStats(keywords, briefs), [keywords, briefs]);
  
  const filteredKeywords = useMemo(() => {
    let filtered = keywords;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(k => k.keyword.toLowerCase().includes(query));
    }
    
    // Type filter
    switch (keywordFilter) {
      case 'unmapped':
        filtered = filtered.filter(k => !k.mappedUrl);
        break;
      case 'mapped':
        filtered = filtered.filter(k => k.mappedUrl);
        break;
      case 'high_opportunity':
        filtered = filtered.filter(k => k.opportunity === 'high');
        break;
      case 'needs_action':
        filtered = filtered.filter(k => !k.selectedAction || k.selectedAction === undefined);
        break;
    }
    
    return filtered;
  }, [keywords, searchQuery, keywordFilter]);

  const selectedKeywords = useMemo(
    () => keywords.filter(k => selectedKeywordIds.has(k.id)),
    [keywords, selectedKeywordIds]
  );

  // Handlers
  const handleKeywordSelect = useCallback((keywordId: string) => {
    setSelectedKeywordIds(prev => {
      const next = new Set(prev);
      if (next.has(keywordId)) {
        next.delete(keywordId);
      } else {
        next.add(keywordId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedKeywordIds.size === filteredKeywords.length) {
      setSelectedKeywordIds(new Set());
    } else {
      setSelectedKeywordIds(new Set(filteredKeywords.map(k => k.id)));
    }
  }, [filteredKeywords, selectedKeywordIds.size]);

  const handleActionSelect = useCallback((keywordId: string, action: KeywordMappingAction, url?: string) => {
    setKeywords(prev => prev.map(k => 
      k.id === keywordId 
        ? { ...k, selectedAction: action, selectedUrl: url }
        : k
    ));
  }, []);

  const handleGenerateBrief = useCallback(async (keywordId: string) => {
    setIsGenerating(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const keyword = keywords.find(k => k.id === keywordId);
    if (keyword) {
      const newBriefId = `brief-${Date.now()}`;
      // Add brief reference to keyword
      setKeywords(prev => prev.map(k =>
        k.id === keywordId
          ? { ...k, briefs: [...(k.briefs || []), newBriefId] }
          : k
      ));
      // Would create actual brief here
    }
    
    setIsGenerating(false);
  }, [keywords]);

  const handleBulkAction = useCallback((keywordIds: string[], action: KeywordMappingAction) => {
    setKeywords(prev => prev.map(k =>
      keywordIds.includes(k.id)
        ? { ...k, selectedAction: action }
        : k
    ));
  }, []);

  const handleBulkGenerateBriefs = useCallback(async (keywordIds: string[]) => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Would generate briefs for all selected keywords
    setIsGenerating(false);
  }, []);

  // Tabs configuration
  const tabs = [
    { id: 'keywords' as PlanningViewTab, label: 'Keywords', icon: Target, count: stats.totalKeywords },
    { id: 'briefs' as PlanningViewTab, label: 'Briefs', icon: FileText, count: stats.totalBriefs },
    { id: 'mapping' as PlanningViewTab, label: 'Mapping', icon: GitBranch },
    { id: 'health' as PlanningViewTab, label: 'Health', icon: AlertTriangle, count: stats.cannibalizationIssues, alert: stats.cannibalizationIssues > 0 },
  ];

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Unmapped Keywords"
          value={stats.unmappedKeywords}
          subtitle="Need content action"
          icon={Target}
          color="text-orange-600"
        />
        <StatsCard
          title="High Opportunity"
          value={stats.highOpportunityKeywords}
          subtitle="Priority targets"
          icon={TrendingUp}
          color="text-green-600"
        />
        <StatsCard
          title="Content Briefs"
          value={stats.totalBriefs}
          subtitle={`${stats.briefsByStatus.approved || 0} approved`}
          icon={FileText}
          color="text-blue-600"
        />
        <StatsCard
          title="Potential Traffic"
          value={formatCompact(stats.potentialTraffic)}
          subtitle="Monthly visits"
          icon={BarChart3}
          color="text-purple-600"
        />
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-lg border">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-2 border-b border-gray-200 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={cn(
                    'px-1.5 py-0.5 rounded-full text-xs font-medium',
                    tab.alert
                      ? 'bg-red-100 text-red-700'
                      : activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {/* Keywords Tab */}
          {activeTab === 'keywords' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search keywords..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <select
                    value={keywordFilter}
                    onChange={(e) => setKeywordFilter(e.target.value as KeywordFilterOption)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Keywords</option>
                    <option value="unmapped">Unmapped Only</option>
                    <option value="mapped">Mapped Only</option>
                    <option value="high_opportunity">High Opportunity</option>
                    <option value="needs_action">Needs Action</option>
                  </select>
                </div>

                <div className="text-sm text-gray-500">
                  {filteredKeywords.length} of {keywords.length} keywords
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedKeywords.length > 0 && (
                <KeywordBulkActions
                  selectedKeywords={selectedKeywords}
                  onBulkAction={handleBulkAction}
                  onBulkGenerateBriefs={handleBulkGenerateBriefs}
                  isBulkGenerating={isGenerating}
                />
              )}

              {/* Keywords List */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-4 p-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
                  <input
                    type="checkbox"
                    checked={selectedKeywordIds.size === filteredKeywords.length && filteredKeywords.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                  <div className="w-6" />
                  <div className="flex-1">Keyword</div>
                  <div className="w-24 text-center">Opportunity</div>
                  <div className="w-28 text-center">Action</div>
                  <div className="w-16 text-center">Briefs</div>
                </div>

                {/* Rows */}
                <div className="max-h-[500px] overflow-y-auto">
                  {filteredKeywords.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No keywords match your filters
                    </div>
                  ) : (
                    filteredKeywords.map(keyword => (
                      <KeywordRow
                        key={keyword.id}
                        keyword={keyword}
                        isSelected={selectedKeywordIds.has(keyword.id)}
                        onSelect={() => handleKeywordSelect(keyword.id)}
                        onActionSelect={(action, url) => handleActionSelect(keyword.id, action, url)}
                        onGenerateBrief={() => handleGenerateBrief(keyword.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Briefs Tab */}
          {activeTab === 'briefs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="font-medium text-gray-900">Content Briefs</h3>
                  <StatusDistributionChart data={stats.briefsByStatus} className="w-48" />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  <Sparkles className="h-4 w-4" />
                  Generate New Brief
                </button>
              </div>

              <div className="space-y-4">
                {briefs.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
                    <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p>No content briefs yet</p>
                    <p className="text-sm mt-1">Select keywords and generate briefs to get started</p>
                  </div>
                ) : (
                  briefs.map(brief => (
                    <ContentBriefCard
                      key={brief.id}
                      brief={brief}
                      canEdit
                      canApprove
                      onEdit={(id) => console.log('Edit brief:', id)}
                      onApprove={(id) => console.log('Approve brief:', id)}
                      onGenerateContent={(id) => console.log('Generate content:', id)}
                      onExport={(id) => console.log('Export brief:', id)}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Mapping Tab */}
          {activeTab === 'mapping' && (
            <div className="space-y-4">
              <div className="p-6 text-center border border-dashed border-gray-300 rounded-lg">
                <GitBranch className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <h3 className="font-medium text-gray-900">Keyword → Content Mapping</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Visual mapping of keywords to content pages
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  (Full mapping visualization in next iteration)
                </p>
              </div>
            </div>
          )}

          {/* Health Tab */}
          {activeTab === 'health' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Cannibalization & Conflicts</h3>
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                  <RefreshCw className="h-4 w-4" />
                  Re-scan
                </button>
              </div>

              {stats.cannibalizationIssues === 0 ? (
                <div className="p-6 text-center border border-green-200 bg-green-50 rounded-lg">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
                  <h3 className="font-medium text-green-800">No Conflicts Detected</h3>
                  <p className="text-sm text-green-600 mt-1">
                    Your content structure looks healthy
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {briefs
                    .filter(b => b.cannibalizationStatus === 'warning' || b.cannibalizationStatus === 'blocked')
                    .map(brief => (
                      <div 
                        key={brief.id}
                        className={cn(
                          'p-4 rounded-lg border',
                          brief.cannibalizationStatus === 'blocked' 
                            ? 'border-red-200 bg-red-50' 
                            : 'border-yellow-200 bg-yellow-50'
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <CannibalizationBadge 
                                status={brief.cannibalizationStatus}
                                details={brief.cannibalizationDetails}
                                showDetails
                              />
                              <span className="font-medium text-gray-900">
                                {brief.primaryKeyword}
                              </span>
                            </div>
                            {brief.cannibalizationDetails?.recommendation && (
                              <p className="text-sm text-gray-600 mt-2">
                                {brief.cannibalizationDetails.recommendation}
                              </p>
                            )}
                          </div>
                          <button className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                            Resolve
                          </button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContentPlanningView;
