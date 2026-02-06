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

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn, formatNumber, formatCompact } from '@/lib/utils';
import type { SearchIntent } from '@/types/keyword.types';
import { SEARCH_INTENT_CONFIG, OPPORTUNITY_CONFIG } from '@/types/keyword.types';
import { useProject } from '@/context/ProjectContext';
import {
  ContentBriefDisplay,
  BriefGeneratorForm,
  generateContentBrief,
  AIContentWriter,
  AIImageGenerator,
  SocialMediaGenerator,
  type FullContentBrief,
  type BriefGenerationInput,
  type GeneratedContent,
} from '@/components/content';
import { saveGeneratedContent } from '@/services/content.service';
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
  Image as ImageIcon,
  Share2,
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
  const searchParams = useSearchParams();
  const { currentProject } = useProject();
  const [currentStep, setCurrentStep] = useState<Step>('select');
  const [selectedKeyword, setSelectedKeyword] = useState<BriefGenerationInput['keyword'] | null>(null);
  const [contentBrief, setContentBrief] = useState<FullContentBrief | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [intentFilter, setIntentFilter] = useState<SearchIntent | 'all'>('all');
  const [urlBriefSuggestion, setUrlBriefSuggestion] = useState<{
    suggestedTitle: string;
    suggestedMetaDescription: string;
    suggestedH1: string;
    suggestedOutline: string[];
    targetWordCount: number;
    relatedKeywordsToInclude: string[];
  } | null>(null);

  // Read URL params and auto-populate keyword from URL
  useEffect(() => {
    const keywordParam = searchParams.get('keyword');
    const briefParam = searchParams.get('brief');
    const relatedKeywordsParam = searchParams.get('relatedKeywords');

    if (keywordParam) {
      // Parse brief suggestion if available
      let briefSuggestion = null;
      if (briefParam) {
        try {
          briefSuggestion = JSON.parse(briefParam);
          setUrlBriefSuggestion(briefSuggestion);
        } catch (e) {
          console.error('Failed to parse brief param:', e);
        }
      }

      // Parse related keywords
      let relatedKeywords: string[] = [];
      if (relatedKeywordsParam) {
        try {
          relatedKeywords = JSON.parse(relatedKeywordsParam);
        } catch (e) {
          console.error('Failed to parse related keywords:', e);
        }
      }

      // Create keyword object from URL params
      const keywordFromUrl: BriefGenerationInput['keyword'] = {
        primary: keywordParam,
        secondary: briefSuggestion?.relatedKeywordsToInclude || relatedKeywords || [],
        searchVolume: 0, // Will be fetched from API if needed
        difficulty: 50,
        intent: 'informational' as const,
        opportunity: 'medium' as const,
        clusterId: `cluster_${keywordParam.replace(/\s+/g, '_')}`,
        clusterName: keywordParam,
      };

      // Auto-select keyword
      setSelectedKeyword(keywordFromUrl);
      
      // If we have brief suggestion from URL, auto-create brief and go directly to approve step
      if (briefSuggestion) {
        const targetWordCount = briefSuggestion.targetWordCount || 2000;
        const outlineItems = briefSuggestion.suggestedOutline || [];
        
        const autoBrief: FullContentBrief = {
          brief_id: `brief_${Date.now()}`,
          project_id: currentProject?.id || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          generated_by: 'ai',
          status: 'draft',
          
          overview: {
            objective: `Tạo nội dung toàn diện về "${keywordParam}" để ranking trên Google`,
            target_audience: 'Khách hàng tiềm năng quan tâm đến sản phẩm/dịch vụ ngân hàng',
            content_type: 'guide',
            content_mode: 'create',
          },
          
          seo_targeting: {
            primary_keyword: keywordParam,
            secondary_keywords: briefSuggestion.relatedKeywordsToInclude || relatedKeywords || [],
            related_entities: [],
            search_intent: 'informational',
            search_volume: 0,
            keyword_difficulty: 50,
            opportunity_score: 'medium',
            target_url: null,
            suggested_slug: keywordParam.toLowerCase().replace(/\s+/g, '-'),
          },
          
          competitive_context: {
            existing_internal_pages: [],
            cannibalization_risk: 'LOW',
            differentiation_angle: `Góc nhìn chuyên gia VIB về ${keywordParam}`,
          },
          
          recommended_structure: {
            suggested_h1: briefSuggestion.suggestedH1 || `${keywordParam} - Hướng dẫn chi tiết`,
            outline: outlineItems.map((heading: string, idx: number) => ({
              level: 2 as const,
              text: heading,
              keywords: [],
              wordCount: Math.floor(targetWordCount / Math.max(outlineItems.length, 1)),
            })),
            mandatory_sections: ['Giới thiệu', 'Kết luận'],
            optional_sections: ['FAQ', 'Tài liệu tham khảo'],
            faq_suggestions: [],
          },
          
          internal_linking: {
            required_links: [],
            anchor_text_guidance: `Sử dụng anchor text chứa từ khóa "${keywordParam}"`,
            links_to_avoid: [],
          },
          
          content_requirements: {
            word_count_range: { min: targetWordCount - 500, max: targetWordCount + 500 },
            reading_level: 'intermediate',
            tone: 'neutral_expert',
            formality: 'semi-formal',
            cta_style: 'soft',
          },
          
          seo_constraints: {
            meta_title_guidance: briefSuggestion.suggestedTitle || `${keywordParam} | VIB`,
            meta_description_guidance: briefSuggestion.suggestedMetaDescription || `Tìm hiểu về ${keywordParam}. Thông tin chi tiết và hướng dẫn từ VIB.`,
            structured_data_requirements: ['Article', 'BreadcrumbList'],
            seo_ready_signals: ['H1 chứa từ khóa chính', 'Meta title tối ưu', 'Internal links'],
          },
          
          risks: {
            brand_risk: 'LOW',
            compliance_risk: 'LOW',
            technical_risk: 'LOW',
            cannibalization_risk: 'LOW',
            warnings: [],
          },
          
          success_metrics: {
            primary_kpi: 'Organic traffic tăng 20%',
            secondary_kpis: ['Top 10 ranking cho từ khóa chính', 'CTR > 3%'],
            expected_time_to_impact: '3-6 tháng',
          },
          
          ai_reasoning: {
            explanation: `Brief được tạo tự động từ phân tích SEO cho từ khóa "${keywordParam}"`,
            confidence_score: 0.85,
            data_sources_used: ['GSC Data', 'Crawl Data', 'CWV Analysis'],
          },
        };
        
        setContentBrief(autoBrief);
        setCurrentStep('approve');
      } else {
        // No brief suggestion, go to brief generation step
        setCurrentStep('brief');
      }
    }
  }, [searchParams, currentProject]);

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
    
    // Auto-save generated content to localStorage
    if (contentBrief && selectedKeyword) {
      try {
        // Extract title from content (first H1 or use brief title)
        const titleMatch = content.content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : contentBrief.recommended_structure.suggested_h1;
        
        // Create slug from primary keyword
        const slug = selectedKeyword.primary
          .toLowerCase()
          .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
          .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
          .replace(/[ìíịỉĩ]/g, 'i')
          .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
          .replace(/[ùúụủũưừứựửữ]/g, 'u')
          .replace(/[ỳýỵỷỹ]/g, 'y')
          .replace(/đ/g, 'd')
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
        
        saveGeneratedContent({
          projectId: 'project-1', // Default project
          title,
          slug: slug || `content-${Date.now()}`,
          content: content.content,
          primaryKeyword: selectedKeyword.primary,
          secondaryKeywords: selectedKeyword.secondary,
          metaTitle: contentBrief.seo_constraints.meta_title_guidance,
          metaDescription: contentBrief.seo_constraints.meta_description_guidance,
          briefId: contentBrief.brief_id,
          createdBy: 'ai-content-writer',
          status: 'draft',
        });
        
        console.log('✅ Content saved successfully');
      } catch (error) {
        console.error('Failed to save content:', error);
      }
    }
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
              projectId={currentProject?.id || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'}
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

        {/* Step 4: Generate Content with Image & Social Media */}
        {currentStep === 'generate' && contentBrief && (
          <GenerateContentWithExtras
            contentBrief={contentBrief}
            generatedContent={generatedContent}
            onContentGenerated={handleContentGenerated}
            onStartNew={handleStartNew}
          />
        )}
      </main>
    </div>
  );
}

// =============================================================================
// GENERATE CONTENT WITH IMAGE & SOCIAL MEDIA TABS
// =============================================================================

type GenerateTab = 'content' | 'image' | 'social';

interface GenerateContentWithExtrasProps {
  contentBrief: FullContentBrief;
  generatedContent: GeneratedContent | null;
  onContentGenerated: (content: GeneratedContent) => void;
  onStartNew: () => void;
}

function GenerateContentWithExtras({
  contentBrief,
  generatedContent,
  onContentGenerated,
  onStartNew,
}: GenerateContentWithExtrasProps) {
  const [activeTab, setActiveTab] = useState<GenerateTab>('content');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<Array<{
    id: string;
    imageUrl: string;
    prompt: string;
    style: string;
    width: number;
    height: number;
  }>>([]);
  const [autoSwitched, setAutoSwitched] = useState(false); // Track if we've auto-switched

  // Auto-switch to Image tab when content is generated
  useEffect(() => {
    if (generatedContent && !autoSwitched) {
      // Small delay to show success message first
      const timer = setTimeout(() => {
        setActiveTab('image');
        setAutoSwitched(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [generatedContent, autoSwitched]);

  // Extract article info for social media
  const articleTitle = generatedContent 
    ? (generatedContent.content.split('\n')[0]?.replace(/^#\s*/, '') || contentBrief.seo_targeting.primary_keyword)
    : contentBrief.seo_targeting.primary_keyword;
  
  const articleContent = generatedContent?.content || '';
  const keyword = contentBrief.seo_targeting.primary_keyword;

  const tabs = [
    { id: 'content' as GenerateTab, name: 'Nội dung', icon: PenTool, color: 'purple' },
    { id: 'image' as GenerateTab, name: 'Hình ảnh', icon: ImageIcon, color: 'pink' },
    { id: 'social' as GenerateTab, name: 'Social Media', icon: Share2, color: 'blue' },
  ];

  return (
    <div className="space-y-6">
      {/* Success Banner with auto-switch notification */}
      {generatedContent && (
        <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">Content Generated Successfully!</p>
              <p className="text-sm text-gray-600">
                {generatedContent.wordCount} words • Generated in {(generatedContent.generationTimeMs / 1000).toFixed(1)}s
                {activeTab === 'image' && !autoSwitched && (
                  <span className="ml-2 text-blue-600">→ Đang chuyển sang tạo ảnh...</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onStartNew}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Create Another
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const colorMap = {
            purple: isActive ? 'bg-purple-600 text-white' : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50',
            pink: isActive ? 'bg-pink-600 text-white' : 'text-gray-600 hover:text-pink-600 hover:bg-pink-50',
            blue: isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50',
          };
          
          // Show lock indicator for tabs that need content first
          const needsContent = (tab.id === 'image' || tab.id === 'social') && !generatedContent;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              disabled={needsContent}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all',
                colorMap[tab.color as keyof typeof colorMap],
                needsContent && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.name}</span>
              {needsContent && <span className="text-xs">(tạo nội dung trước)</span>}
            </button>
          );
        })}
      </div>

      {/* Workflow Progress */}
      <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border">
        <Sparkles className="w-4 h-4 text-purple-600" />
        <div className="flex items-center gap-1 text-sm">
          <span className={cn('font-medium', generatedContent ? 'text-green-600' : 'text-gray-500')}>
            1. Bài viết {generatedContent && '✓'}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className={cn('font-medium', generatedImageUrl ? 'text-green-600' : 'text-gray-500')}>
            2. Hình ảnh {generatedImageUrl && '✓'}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-500">
            3. Social Media
          </span>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'content' && (
          <AIContentWriter
            brief={contentBrief}
            initialContent={generatedContent}
            onContentGenerated={onContentGenerated}
          />
        )}

        {activeTab === 'image' && (
          <>
            {generatedContent ? (
              <div className="space-y-4">
                {/* Context from article */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Tự động tạo prompt từ nội dung bài viết
                  </h4>
                  <p className="text-sm text-blue-700">
                    Prompt đã được điền sẵn dựa trên nội dung bài "<strong>{articleTitle}</strong>". 
                    Bạn có thể chỉnh sửa hoặc tạo ngay!
                  </p>
                </div>
                
                <AIImageGenerator
                  projectId={contentBrief.project_id}
                  keyword={keyword}
                  articleTitle={articleTitle}
                  articleContent={articleContent}
                  initialImages={generatedImages}
                  onImageGenerated={(url, allImages) => {
                    setGeneratedImageUrl(url);
                    setGeneratedImages(allImages);
                    // Auto-switch to Social tab after image generated
                    setTimeout(() => setActiveTab('social'), 1500);
                  }}
                />
              </div>
            ) : (
              <div className="bg-white rounded-xl border p-8 text-center">
                <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Cần tạo nội dung trước
                </h3>
                <p className="text-gray-500 max-w-md mx-auto mb-4">
                  Vui lòng tạo bài viết ở tab "Nội dung" trước khi tạo hình ảnh minh họa.
                </p>
                <button
                  onClick={() => setActiveTab('content')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                >
                  Tạo nội dung
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'social' && (
          <>
            {generatedContent ? (
              <div className="space-y-4">
                {/* Context summary */}
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h4 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Tạo nội dung Social Media từ bài viết
                  </h4>
                  <div className="text-sm text-purple-700 space-y-1">
                    <p>📝 Bài viết: <strong>{articleTitle}</strong></p>
                    {generatedImageUrl && <p>🖼️ Đã có ảnh minh họa sẵn sàng</p>}
                    <p>🔑 Keyword: {keyword}</p>
                  </div>
                </div>

                <SocialMediaGenerator
                  projectId={contentBrief.project_id}
                  articleTitle={articleTitle}
                  articleContent={articleContent}
                  keyword={keyword}
                  articleUrl={`https://vib.com.vn/${keyword.toLowerCase().replace(/\s+/g, '-')}`}
                  articleImage={generatedImageUrl || undefined}
                />
              </div>
            ) : (
              <div className="bg-white rounded-xl border p-8 text-center">
                <Share2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Cần tạo nội dung trước
                </h3>
                <p className="text-gray-500 max-w-md mx-auto mb-4">
                  Vui lòng tạo bài viết ở tab "Nội dung" trước khi tạo nội dung Social Media.
                </p>
                <button
                  onClick={() => setActiveTab('content')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                >
                  Tạo nội dung
                </button>
              </div>
            )}
          </>
        )}
      </div>
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
