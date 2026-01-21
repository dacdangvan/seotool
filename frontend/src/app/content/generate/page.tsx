'use client';

/**
 * AI Content Generation Page
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md:
 * - Section 13: Auto Content Brief Generation
 * - Section 14: AI Content Generation – Brief-driven Prompt
 * 
 * Complete Flow:
 * 1. Select a keyword
 * 2. Generate Content Brief (Section 13)
 * 3. Approve Brief
 * 4. Generate Content from Brief (Section 14)
 * 
 * Key Principles:
 * - AI is a content EXECUTOR, NOT a strategist
 * - No content without an approved Content Brief
 * - All content follows the brief strictly
 */

import React, { useState, useMemo } from 'react';
import { cn, formatNumber, formatCompact } from '@/lib/utils';
import type { SearchIntent } from '@/types/keyword.types';
import { SEARCH_INTENT_CONFIG, OPPORTUNITY_CONFIG } from '@/types/keyword.types';
import {
  ContentBriefDisplay,
  BriefGeneratorForm,
  generateContentBrief,
  AIContentWriter,
  type FullContentBrief,
  type BriefGenerationInput,
  type GeneratedContent,
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
  TrendingUp,
  Zap,
  PenTool,
  Shield,
  Layers,
} from 'lucide-react';

// =============================================================================
// MOCK DATA
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

type Step = 'select' | 'brief' | 'approve' | 'generate';

export default function AIContentGenerationPage() {
  const [currentStep, setCurrentStep] = useState<Step>('select');
  const [selectedKeyword, setSelectedKeyword] = useState<BriefGenerationInput['keyword'] | null>(null);
  const [contentBrief, setContentBrief] = useState<FullContentBrief | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
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

  // Handlers
  const handleSelectKeyword = (keyword: BriefGenerationInput['keyword']) => {
    setSelectedKeyword(keyword);
    setCurrentStep('brief');
  };

  const handleBriefGenerated = (brief: FullContentBrief) => {
    setContentBrief(brief);
    setCurrentStep('approve');
  };

  const handleApproveBrief = () => {
    if (contentBrief) {
      setContentBrief({ ...contentBrief, status: 'approved' });
      setCurrentStep('generate');
    }
  };

  const handleRejectBrief = () => {
    if (contentBrief) {
      setContentBrief({ ...contentBrief, status: 'rejected' });
    }
  };

  const handleContentGenerated = (content: GeneratedContent) => {
    setGeneratedContent(content);
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'brief':
        setCurrentStep('select');
        setSelectedKeyword(null);
        break;
      case 'approve':
        setCurrentStep('brief');
        break;
      case 'generate':
        setCurrentStep('approve');
        break;
    }
  };

  const handleStartNew = () => {
    setCurrentStep('select');
    setSelectedKeyword(null);
    setContentBrief(null);
    setGeneratedContent(null);
  };

  // Get step number
  const getStepNumber = (step: Step): number => {
    const steps: Step[] = ['select', 'brief', 'approve', 'generate'];
    return steps.indexOf(step) + 1;
  };

  const isStepComplete = (step: Step): boolean => {
    const current = getStepNumber(currentStep);
    const target = getStepNumber(step);
    return target < current;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {currentStep !== 'select' && (
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
                  AI Content Generation
                </h1>
                <p className="text-sm text-gray-500">
                  Section 13 + 14 – Brief-driven Content Creation
                </p>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-2">
              <StepIndicator
                number={1}
                label="Select"
                icon={Target}
                isActive={currentStep === 'select'}
                isComplete={isStepComplete('select')}
              />
              <ChevronRight className="h-4 w-4 text-gray-300" />
              <StepIndicator
                number={2}
                label="Brief"
                icon={FileText}
                isActive={currentStep === 'brief'}
                isComplete={isStepComplete('brief')}
              />
              <ChevronRight className="h-4 w-4 text-gray-300" />
              <StepIndicator
                number={3}
                label="Approve"
                icon={Shield}
                isActive={currentStep === 'approve'}
                isComplete={isStepComplete('approve')}
              />
              <ChevronRight className="h-4 w-4 text-gray-300" />
              <StepIndicator
                number={4}
                label="Generate"
                icon={PenTool}
                isActive={currentStep === 'generate'}
                isComplete={generatedContent !== null}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Step 1: Select Keyword */}
        {currentStep === 'select' && (
          <div className="space-y-6">
            {/* Info Banner */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">
                    Brief-driven Content Generation
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Per Section 14: AI MUST generate content ONLY from an approved Content Brief.
                    Select a keyword to begin the structured content creation process.
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
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <select
                value={intentFilter}
                onChange={(e) => setIntentFilter(e.target.value as SearchIntent | 'all')}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
          </div>
        )}

        {/* Step 2: Generate Brief */}
        {currentStep === 'brief' && selectedKeyword && (
          <div className="max-w-2xl mx-auto">
            <BriefGeneratorForm
              keyword={selectedKeyword}
              projectId="project_demo_001"
              urlInventory={MOCK_URL_INVENTORY}
              brandProfile={MOCK_BRAND_PROFILE}
              onGenerate={handleBriefGenerated}
              onCancel={() => setCurrentStep('select')}
            />
          </div>
        )}

        {/* Step 3: Review & Approve Brief */}
        {currentStep === 'approve' && contentBrief && (
          <div className="space-y-6">
            {/* Status Banner */}
            {contentBrief.status === 'approved' && (
              <div className="p-4 bg-green-50 rounded-xl border border-green-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800">Brief Approved!</p>
                    <p className="text-sm text-green-600">You can now proceed to content generation.</p>
                  </div>
                </div>
                <button
                  onClick={() => setCurrentStep('generate')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center gap-2"
                >
                  <PenTool className="h-4 w-4" />
                  Generate Content
                </button>
              </div>
            )}

            {contentBrief.status === 'rejected' && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <XCircle className="h-6 w-6 text-red-600" />
                  <div>
                    <p className="font-semibold text-red-800">Brief Rejected</p>
                    <p className="text-sm text-red-600">This brief will not proceed to content generation.</p>
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
              brief={contentBrief}
              onApprove={handleApproveBrief}
              onReject={handleRejectBrief}
            />
          </div>
        )}

        {/* Step 4: Generate Content */}
        {currentStep === 'generate' && contentBrief && (
          <div className="space-y-6">
            {/* Success Banner */}
            {generatedContent && (
              <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800">Content Generated Successfully!</p>
                    <p className="text-sm text-gray-600">
                      {generatedContent.wordCount} words • Generated in {(generatedContent.generationTimeMs / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleStartNew}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Create Another
                </button>
              </div>
            )}

            {/* AI Content Writer */}
            <AIContentWriter
              brief={contentBrief}
              onContentGenerated={handleContentGenerated}
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
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  isComplete: boolean;
}

function StepIndicator({ number, label, icon: Icon, isActive, isComplete }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center',
        isComplete
          ? 'bg-green-100 text-green-700'
          : isActive
            ? 'bg-purple-600 text-white'
            : 'bg-gray-100 text-gray-400'
      )}>
        {isComplete ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>
      <span className={cn(
        'text-sm font-medium hidden sm:block',
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
      className="p-4 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all text-left group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
            {keyword.primary}
          </p>
          {keyword.clusterName && (
            <p className="text-xs text-gray-500 mt-0.5">
              Cluster: {keyword.clusterName}
            </p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
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
