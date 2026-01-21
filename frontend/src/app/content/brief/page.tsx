'use client';

/**
 * Content Brief Generator Page
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Section 13 – Auto Content Brief Generation
 * 
 * Flow:
 * 1. Select a keyword to generate brief for
 * 2. Configure content mode, target audience, priority
 * 3. Generate AI-powered Content Brief with all 9 sections (A-I)
 * 4. Review, approve or reject the brief
 * 5. Only approved briefs can proceed to content creation
 */

import React, { useState, useMemo } from 'react';
import { cn, formatNumber, formatCompact } from '@/lib/utils';
import type { SearchIntent, OpportunityLevel, Keyword } from '@/types/keyword.types';
import { SEARCH_INTENT_CONFIG, OPPORTUNITY_CONFIG } from '@/types/keyword.types';
import {
  ContentBriefDisplay,
  BriefGeneratorForm,
  generateContentBrief,
  type FullContentBrief,
  type BriefGenerationInput,
} from '@/components/content';
import {
  Sparkles,
  Target,
  FileText,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Search,
  Filter,
  TrendingUp,
  Zap,
  Clock,
  AlertTriangle,
  Layers,
  Download,
  Copy,
  Eye,
} from 'lucide-react';

// =============================================================================
// MOCK DATA – Demo keywords
// =============================================================================

const MOCK_KEYWORDS: BriefGenerationInput['keyword'][] = [
  {
    primary: 'vay mua nhà lãi suất thấp',
    secondary: ['lãi suất vay mua nhà', 'vay ngân hàng mua nhà', 'lãi suất ưu đãi'],
    searchVolume: 8100,
    difficulty: 42,
    intent: 'transactional',
    opportunity: 'high',
    clusterId: 'cluster_home_loan',
    clusterName: 'Home Loan Products',
  },
  {
    primary: 'thẻ tín dụng nào tốt nhất',
    secondary: ['so sánh thẻ tín dụng', 'review thẻ tín dụng', 'top thẻ tín dụng'],
    searchVolume: 6500,
    difficulty: 55,
    intent: 'commercial',
    opportunity: 'high',
    clusterId: 'cluster_credit_card',
    clusterName: 'Credit Card Comparison',
  },
  {
    primary: 'cách mở tài khoản ngân hàng online',
    secondary: ['đăng ký tài khoản ngân hàng', 'mở tài khoản không cần ra chi nhánh'],
    searchVolume: 12400,
    difficulty: 28,
    intent: 'informational',
    opportunity: 'high',
    clusterId: 'cluster_account_opening',
    clusterName: 'Account Opening Guide',
  },
  {
    primary: 'lãi suất tiết kiệm ngân hàng nào cao nhất',
    secondary: ['gửi tiết kiệm lãi cao', 'so sánh lãi suất tiết kiệm'],
    searchVolume: 4800,
    difficulty: 38,
    intent: 'commercial',
    opportunity: 'medium',
    clusterId: 'cluster_savings',
    clusterName: 'Savings Products',
  },
  {
    primary: 'điều kiện vay tín chấp',
    secondary: ['vay tín chấp không cần tài sản', 'hồ sơ vay tín chấp'],
    searchVolume: 3200,
    difficulty: 35,
    intent: 'informational',
    opportunity: 'medium',
    clusterId: 'cluster_unsecured_loan',
    clusterName: 'Unsecured Loans',
  },
];

const MOCK_URL_INVENTORY: BriefGenerationInput['urlInventory'] = {
  existingPages: [
    { url: '/vay-mua-nha', title: 'Vay Mua Nhà - Lãi Suất Ưu Đãi', keywords: ['vay mua nhà', 'lãi suất vay'] },
    { url: '/the-tin-dung', title: 'Thẻ Tín Dụng VIB', keywords: ['thẻ tín dụng'] },
    { url: '/tai-khoan-thanh-toan', title: 'Tài Khoản Thanh Toán', keywords: ['mở tài khoản', 'tài khoản ngân hàng'] },
    { url: '/tiet-kiem', title: 'Gửi Tiết Kiệm Online', keywords: ['tiết kiệm', 'lãi suất tiết kiệm'] },
  ],
  crawlCoverage: 85,
};

const MOCK_BRAND_PROFILE: BriefGenerationInput['brandProfile'] = {
  tone: 'neutral_expert',
  forbiddenClaims: ['cam kết lãi suất', 'đảm bảo được duyệt', 'không cần kiểm tra'],
  avoidedTerms: ['rẻ nhất', 'tốt nhất thị trường'],
  complianceRules: ['Tuân thủ quy định NHNN', 'Không quảng cáo sai sự thật'],
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

type ViewState = 'select' | 'configure' | 'review';

export default function ContentBriefPage() {
  const [viewState, setViewState] = useState<ViewState>('select');
  const [selectedKeyword, setSelectedKeyword] = useState<BriefGenerationInput['keyword'] | null>(null);
  const [generatedBrief, setGeneratedBrief] = useState<FullContentBrief | null>(null);
  const [approvedBriefs, setApprovedBriefs] = useState<FullContentBrief[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [intentFilter, setIntentFilter] = useState<SearchIntent | 'all'>('all');

  // Filter keywords
  const filteredKeywords = useMemo(() => {
    return MOCK_KEYWORDS.filter(kw => {
      const matchesSearch = kw.primary.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesIntent = intentFilter === 'all' || kw.intent === intentFilter;
      return matchesSearch && matchesIntent;
    });
  }, [searchQuery, intentFilter]);

  // Handle keyword selection
  const handleSelectKeyword = (keyword: BriefGenerationInput['keyword']) => {
    setSelectedKeyword(keyword);
    setViewState('configure');
  };

  // Handle brief generation
  const handleGenerateBrief = (brief: FullContentBrief) => {
    setGeneratedBrief(brief);
    setViewState('review');
  };

  // Handle brief approval
  const handleApproveBrief = (briefId: string) => {
    if (generatedBrief && generatedBrief.brief_id === briefId) {
      const approvedBrief = { ...generatedBrief, status: 'approved' as const };
      setApprovedBriefs(prev => [...prev, approvedBrief]);
      setGeneratedBrief(approvedBrief);
    }
  };

  // Handle brief rejection
  const handleRejectBrief = (briefId: string) => {
    if (generatedBrief && generatedBrief.brief_id === briefId) {
      setGeneratedBrief({ ...generatedBrief, status: 'rejected' as const });
    }
  };

  // Go back
  const handleBack = () => {
    if (viewState === 'review') {
      setViewState('configure');
    } else if (viewState === 'configure') {
      setViewState('select');
      setSelectedKeyword(null);
    }
  };

  // Reset to start
  const handleStartNew = () => {
    setViewState('select');
    setSelectedKeyword(null);
    setGeneratedBrief(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {viewState !== 'select' && (
                <button
                  onClick={handleBack}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-purple-600" />
                  Auto Content Brief Generator
                </h1>
                <p className="text-sm text-gray-500">
                  Section 13 – Single Source of Truth for AI Content Generation
                </p>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-2">
              <StepIndicator 
                number={1} 
                label="Select Keyword" 
                isActive={viewState === 'select'}
                isComplete={viewState !== 'select'}
              />
              <ChevronRight className="h-4 w-4 text-gray-300" />
              <StepIndicator 
                number={2} 
                label="Configure" 
                isActive={viewState === 'configure'}
                isComplete={viewState === 'review'}
              />
              <ChevronRight className="h-4 w-4 text-gray-300" />
              <StepIndicator 
                number={3} 
                label="Review Brief" 
                isActive={viewState === 'review'}
                isComplete={generatedBrief?.status === 'approved'}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Step 1: Select Keyword */}
        {viewState === 'select' && (
          <div className="space-y-6">
            {/* Info Banner */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">
                    No content may be generated without an explicit Content Brief
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Select a keyword to generate a comprehensive brief with all 9 required sections (A-I).
                    The brief ensures deterministic, brand-compliant content output.
                  </p>
                </div>
              </div>
            </div>

            {/* Search & Filter */}
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search keywords..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={intentFilter}
                onChange={(e) => setIntentFilter(e.target.value as SearchIntent | 'all')}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Intents</option>
                <option value="informational">Informational</option>
                <option value="commercial">Commercial</option>
                <option value="transactional">Transactional</option>
                <option value="navigational">Navigational</option>
              </select>
            </div>

            {/* Keywords Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredKeywords.map((keyword, index) => (
                <KeywordCard
                  key={index}
                  keyword={keyword}
                  onSelect={() => handleSelectKeyword(keyword)}
                />
              ))}
            </div>

            {filteredKeywords.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No keywords found matching your criteria
              </div>
            )}

            {/* Approved Briefs Summary */}
            {approvedBriefs.length > 0 && (
              <div className="mt-8 p-4 bg-green-50 rounded-xl border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-800">
                    {approvedBriefs.length} Approved Brief{approvedBriefs.length > 1 ? 's' : ''}
                  </h3>
                </div>
                <div className="space-y-2">
                  {approvedBriefs.map(brief => (
                    <div 
                      key={brief.brief_id}
                      className="flex items-center justify-between p-2 bg-white rounded border border-green-100"
                    >
                      <span className="font-medium text-gray-900">
                        {brief.seo_targeting.primary_keyword}
                      </span>
                      <span className="text-xs text-green-600">Ready for content creation</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Configure Brief Generation */}
        {viewState === 'configure' && selectedKeyword && (
          <div className="max-w-2xl mx-auto">
            <BriefGeneratorForm
              keyword={selectedKeyword}
              projectId="project_demo_001"
              urlInventory={MOCK_URL_INVENTORY}
              brandProfile={MOCK_BRAND_PROFILE}
              onGenerate={handleGenerateBrief}
              onCancel={() => setViewState('select')}
            />
          </div>
        )}

        {/* Step 3: Review Generated Brief */}
        {viewState === 'review' && generatedBrief && (
          <div className="space-y-6">
            {/* Action Bar */}
            {generatedBrief.status === 'approved' && (
              <div className="p-4 bg-green-50 rounded-xl border border-green-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800">Brief Approved!</p>
                    <p className="text-sm text-green-600">This brief can now proceed to content creation.</p>
                  </div>
                </div>
                <button
                  onClick={handleStartNew}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                >
                  Generate Another Brief
                </button>
              </div>
            )}

            {generatedBrief.status === 'rejected' && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <XCircle className="h-6 w-6 text-red-600" />
                  <div>
                    <p className="font-semibold text-red-800">Brief Rejected</p>
                    <p className="text-sm text-red-600">This brief will not proceed to content creation.</p>
                  </div>
                </div>
                <button
                  onClick={handleStartNew}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                >
                  Start Over
                </button>
              </div>
            )}

            {/* Brief Display */}
            <ContentBriefDisplay
              brief={generatedBrief}
              onApprove={handleApproveBrief}
              onReject={handleRejectBrief}
              onExport={(id) => console.log('Export brief:', id)}
            />
          </div>
        )}
      </main>
    </div>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface StepIndicatorProps {
  number: number;
  label: string;
  isActive: boolean;
  isComplete: boolean;
}

function StepIndicator({ number, label, isActive, isComplete }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium',
        isComplete
          ? 'bg-green-100 text-green-700'
          : isActive
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-400'
      )}>
        {isComplete ? <CheckCircle2 className="h-4 w-4" /> : number}
      </div>
      <span className={cn(
        'text-sm font-medium',
        isActive ? 'text-gray-900' : 'text-gray-400'
      )}>
        {label}
      </span>
    </div>
  );
}

interface KeywordCardProps {
  keyword: BriefGenerationInput['keyword'];
  onSelect: () => void;
}

function KeywordCard({ keyword, onSelect }: KeywordCardProps) {
  const intentConfig = SEARCH_INTENT_CONFIG[keyword.intent];
  const opportunityConfig = OPPORTUNITY_CONFIG[keyword.opportunity];

  return (
    <button
      onClick={onSelect}
      className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {keyword.primary}
          </p>
          {keyword.clusterName && (
            <p className="text-xs text-gray-500 mt-0.5">
              Cluster: {keyword.clusterName}
            </p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
      </div>

      <div className="flex items-center gap-3 mt-3">
        <span className={cn(
          'px-2 py-0.5 rounded-full text-xs font-medium',
          intentConfig.bgColor, intentConfig.color
        )}>
          {intentConfig.label}
        </span>
        <span className={cn(
          'px-2 py-0.5 rounded-full text-xs font-medium',
          opportunityConfig.bgColor, opportunityConfig.color
        )}>
          {opportunityConfig.label}
        </span>
      </div>

      <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
        <span className="flex items-center gap-1">
          <TrendingUp className="h-4 w-4 text-gray-400" />
          {formatCompact(keyword.searchVolume)}
        </span>
        <span className="flex items-center gap-1">
          <Target className="h-4 w-4 text-gray-400" />
          KD: {keyword.difficulty}
        </span>
      </div>

      {keyword.secondary.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {keyword.secondary.slice(0, 3).map((kw, i) => (
            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
              {kw}
            </span>
          ))}
          {keyword.secondary.length > 3 && (
            <span className="text-xs text-gray-400">
              +{keyword.secondary.length - 3} more
            </span>
          )}
        </div>
      )}
    </button>
  );
}
