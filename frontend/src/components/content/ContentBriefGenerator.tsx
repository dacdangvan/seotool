'use client';

/**
 * Auto Content Brief Generator
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Section 13 – Auto Content Brief Generation
 * 
 * The Content Brief is the SINGLE SOURCE OF TRUTH for AI content generation.
 * No content may be generated without an explicit Content Brief.
 * 
 * Required Inputs:
 * 1. Keyword Intelligence (primary, secondary, intent, volume)
 * 2. URL Inventory & Crawl Data (existing pages, JS dependency)
 * 3. Brand & Governance (tone, forbidden claims)
 * 4. Strategy Context (mode, audience, priority)
 * 
 * Required Output Sections:
 * A. Overview
 * B. SEO Targeting
 * C. Competitive Context
 * D. Recommended Structure
 * E. Internal Linking Plan
 * F. Content Requirements
 * G. SEO & Technical Constraints
 * H. Risks & Warnings
 * I. Success Metrics
 */

import React, { useState, useCallback, useMemo } from 'react';
import { cn, formatNumber, formatCompact } from '@/lib/utils';
import type { SearchIntent, OpportunityLevel, Keyword } from '@/types/keyword.types';
import { SEARCH_INTENT_CONFIG, OPPORTUNITY_CONFIG } from '@/types/keyword.types';
import type { 
  ContentBrief, 
  ContentType, 
  ContentMode, 
  CannibalizationStatus,
  OutlineItem,
  InternalLinkSuggestion,
} from './ContentBrief';
import {
  CONTENT_TYPE_CONFIG,
  CONTENT_MODE_CONFIG,
  CANNIBALIZATION_STATUS_CONFIG,
} from './ContentBrief';
import {
  FileText,
  Target,
  Sparkles,
  Link2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  Eye,
  ListTree,
  Hash,
  ExternalLink,
  Shield,
  TrendingUp,
  Clock,
  Info,
  Zap,
  Users,
  BarChart3,
  AlertCircle,
  Loader2,
  BookOpen,
  FileCheck,
  Layers,
  Settings,
  PenTool,
} from 'lucide-react';

// =============================================================================
// TYPES – Per Section 13.5 Brief Output Schema
// =============================================================================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ToneStyle = 'neutral_expert' | 'friendly_helpful' | 'authoritative' | 'conversational';
export type CTAStyle = 'soft' | 'neutral' | 'transactional';

/**
 * Full Content Brief Schema per Section 13.3
 */
export interface FullContentBrief {
  // Meta
  brief_id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  generated_by: 'ai' | 'user';
  status: 'draft' | 'validated' | 'approved' | 'rejected';

  // A. Overview
  overview: {
    objective: string;
    target_audience: string;
    content_type: ContentType;
    content_mode: ContentMode;
  };

  // B. SEO Targeting
  seo_targeting: {
    primary_keyword: string;
    secondary_keywords: string[];
    related_entities: string[];
    search_intent: SearchIntent;
    search_volume: number;
    keyword_difficulty: number;
    opportunity_score: OpportunityLevel;
    target_url: string | null;
    suggested_slug?: string;
  };

  // C. Competitive Context
  competitive_context: {
    existing_internal_pages: Array<{
      url: string;
      title: string;
      overlap_score: number;
    }>;
    cannibalization_risk: RiskLevel;
    differentiation_angle: string;
    serp_competitors?: Array<{
      url: string;
      domain: string;
      estimated_traffic: number;
    }>;
  };

  // D. Recommended Structure
  recommended_structure: {
    suggested_h1: string;
    outline: OutlineItem[];
    mandatory_sections: string[];
    optional_sections: string[];
    faq_suggestions: Array<{
      question: string;
      intent: 'informational' | 'transactional';
    }>;
  };

  // E. Internal Linking Plan
  internal_linking: {
    required_links: InternalLinkSuggestion[];
    anchor_text_guidance: string;
    links_to_avoid: Array<{
      url: string;
      reason: string;
    }>;
  };

  // F. Content Requirements
  content_requirements: {
    word_count_range: {
      min: number;
      max: number;
    };
    reading_level: 'basic' | 'intermediate' | 'advanced';
    tone: ToneStyle;
    formality: 'formal' | 'semi-formal' | 'casual';
    cta_style: CTAStyle;
  };

  // G. SEO & Technical Constraints
  seo_constraints: {
    meta_title_guidance: string;
    meta_description_guidance: string;
    structured_data_requirements: string[];
    seo_ready_signals: string[];
  };

  // H. Risks & Warnings
  risks: {
    brand_risk: RiskLevel;
    compliance_risk: RiskLevel;
    technical_risk: RiskLevel;
    cannibalization_risk: RiskLevel;
    warnings: string[];
  };

  // I. Success Metrics
  success_metrics: {
    primary_kpi: string;
    secondary_kpis: string[];
    expected_time_to_impact: string;
    target_ranking?: number;
    target_traffic_increase?: number;
  };

  // AI Reasoning
  ai_reasoning: {
    explanation: string;
    confidence_score: number;
    data_sources_used: string[];
  };
}

/**
 * Inputs for Brief Generation
 */
export interface BriefGenerationInput {
  // Keyword Intelligence
  keyword: {
    primary: string;
    secondary: string[];
    searchVolume: number;
    difficulty: number;
    intent: SearchIntent;
    opportunity: OpportunityLevel;
    clusterId?: string;
    clusterName?: string;
  };

  // URL Inventory (optional)
  urlInventory?: {
    existingPages: Array<{
      url: string;
      title: string;
      keywords: string[];
      jsRisk?: RiskLevel;
    }>;
    crawlCoverage: number;
  };

  // Brand Profile (optional)
  brandProfile?: {
    tone: ToneStyle;
    forbiddenClaims: string[];
    avoidedTerms: string[];
    complianceRules: string[];
  };

  // Strategy Context
  strategy: {
    contentMode: ContentMode;
    targetAudience?: string;
    businessPriority: 'high' | 'medium' | 'low';
    targetUrl?: string;
  };

  // Project context
  projectId: string;
}

// =============================================================================
// BRIEF GENERATION LOGIC
// =============================================================================

/**
 * Determine best content type based on search intent
 */
function determineContentType(intent: SearchIntent): ContentType {
  switch (intent) {
    case 'transactional':
      return 'landing_page';
    case 'commercial':
      return 'comparison';
    case 'informational':
      return 'blog_article';
    case 'navigational':
      return 'product_page';
    default:
      return 'blog_article';
  }
}

/**
 * Generate word count range based on intent and content type
 */
function determineWordCount(intent: SearchIntent, contentType: ContentType): { min: number; max: number } {
  const ranges: Record<ContentType, { min: number; max: number }> = {
    blog_article: { min: 1500, max: 2500 },
    landing_page: { min: 800, max: 1500 },
    product_page: { min: 1000, max: 1800 },
    faq_support: { min: 600, max: 1200 },
    comparison: { min: 1800, max: 3000 },
    guide: { min: 2000, max: 4000 },
  };
  return ranges[contentType];
}

/**
 * Determine tone based on brand profile and intent
 */
function determineTone(intent: SearchIntent, brandTone?: ToneStyle): ToneStyle {
  if (brandTone) return brandTone;
  switch (intent) {
    case 'transactional':
      return 'authoritative';
    case 'commercial':
      return 'neutral_expert';
    case 'informational':
      return 'friendly_helpful';
    default:
      return 'neutral_expert';
  }
}

/**
 * Check cannibalization risk against existing pages
 */
function checkCannibalization(
  primaryKeyword: string,
  existingPages?: BriefGenerationInput['urlInventory']
): { risk: RiskLevel; overlappingPages: Array<{ url: string; title: string; overlap_score: number }> } {
  if (!existingPages || existingPages.existingPages.length === 0) {
    return { risk: 'LOW', overlappingPages: [] };
  }

  const primaryLower = primaryKeyword.toLowerCase();
  const overlapping = existingPages.existingPages
    .map(page => {
      const titleMatch = page.title.toLowerCase().includes(primaryLower) ? 50 : 0;
      const keywordMatch = page.keywords.some(k => 
        k.toLowerCase().includes(primaryLower) || primaryLower.includes(k.toLowerCase())
      ) ? 50 : 0;
      return {
        url: page.url,
        title: page.title,
        overlap_score: titleMatch + keywordMatch,
      };
    })
    .filter(p => p.overlap_score > 0)
    .sort((a, b) => b.overlap_score - a.overlap_score);

  const maxOverlap = overlapping.length > 0 ? overlapping[0].overlap_score : 0;
  const risk: RiskLevel = maxOverlap >= 80 ? 'HIGH' : maxOverlap >= 40 ? 'MEDIUM' : 'LOW';

  return { risk, overlappingPages: overlapping };
}

/**
 * Generate outline based on keyword and intent
 */
function generateOutline(
  keyword: string,
  intent: SearchIntent,
  contentType: ContentType
): OutlineItem[] {
  const keywordCapitalized = keyword.charAt(0).toUpperCase() + keyword.slice(1);
  
  const baseOutlines: Record<SearchIntent, OutlineItem[]> = {
    informational: [
      { level: 1, text: `${keywordCapitalized} – Hướng dẫn chi tiết`, wordCount: 100 },
      { level: 2, text: `${keywordCapitalized} là gì?`, keywords: [keyword], wordCount: 300 },
      { level: 2, text: 'Lợi ích và ưu điểm', wordCount: 400 },
      { level: 3, text: 'Ưu điểm chính', wordCount: 200 },
      { level: 3, text: 'Lưu ý quan trọng', wordCount: 200 },
      { level: 2, text: 'Cách thực hiện từng bước', wordCount: 500 },
      { level: 2, text: 'Câu hỏi thường gặp', wordCount: 300 },
    ],
    commercial: [
      { level: 1, text: `So sánh ${keywordCapitalized} – Đánh giá chi tiết`, wordCount: 100 },
      { level: 2, text: 'Tổng quan thị trường', keywords: [keyword], wordCount: 250 },
      { level: 2, text: 'Top lựa chọn hàng đầu', wordCount: 400 },
      { level: 3, text: 'Tiêu chí đánh giá', wordCount: 200 },
      { level: 3, text: 'Bảng so sánh chi tiết', wordCount: 300 },
      { level: 2, text: 'Phù hợp với ai?', wordCount: 300 },
      { level: 2, text: 'Kết luận & khuyến nghị', wordCount: 200 },
    ],
    transactional: [
      { level: 1, text: `${keywordCapitalized} – Đăng ký ngay`, wordCount: 80 },
      { level: 2, text: 'Quyền lợi & ưu đãi', keywords: [keyword], wordCount: 350 },
      { level: 3, text: 'Ưu đãi đặc biệt', wordCount: 200 },
      { level: 3, text: 'Quyền lợi thành viên', wordCount: 200 },
      { level: 2, text: 'Điều kiện & thủ tục', wordCount: 300 },
      { level: 2, text: 'Biểu phí & chi phí', wordCount: 250 },
      { level: 2, text: 'Cách đăng ký', wordCount: 200 },
      { level: 2, text: 'Câu hỏi thường gặp', wordCount: 200 },
    ],
    navigational: [
      { level: 1, text: keywordCapitalized, wordCount: 50 },
      { level: 2, text: 'Thông tin chi tiết', keywords: [keyword], wordCount: 300 },
      { level: 2, text: 'Tính năng nổi bật', wordCount: 400 },
      { level: 2, text: 'Hướng dẫn sử dụng', wordCount: 300 },
      { level: 2, text: 'Liên hệ & hỗ trợ', wordCount: 150 },
    ],
  };

  return baseOutlines[intent] || baseOutlines.informational;
}

/**
 * Generate FAQ suggestions based on keyword
 */
function generateFAQs(keyword: string, intent: SearchIntent): Array<{ question: string; intent: 'informational' | 'transactional' }> {
  const keywordLower = keyword.toLowerCase();
  
  return [
    { question: `${keyword} là gì?`, intent: 'informational' },
    { question: `Làm thế nào để đăng ký ${keywordLower}?`, intent: 'transactional' },
    { question: `Chi phí ${keywordLower} như thế nào?`, intent: 'informational' },
    { question: `${keyword} có ưu đãi gì đặc biệt?`, intent: 'transactional' },
    { question: `Điều kiện để sử dụng ${keywordLower}?`, intent: 'informational' },
  ];
}

/**
 * Main Brief Generator Function
 */
export function generateContentBrief(input: BriefGenerationInput): FullContentBrief {
  const {
    keyword,
    urlInventory,
    brandProfile,
    strategy,
    projectId,
  } = input;

  const contentType = determineContentType(keyword.intent);
  const wordCountRange = determineWordCount(keyword.intent, contentType);
  const tone = determineTone(keyword.intent, brandProfile?.tone);
  const cannibalization = checkCannibalization(keyword.primary, urlInventory);
  const outline = generateOutline(keyword.primary, keyword.intent, contentType);
  const faqs = generateFAQs(keyword.primary, keyword.intent);

  const now = new Date().toISOString();
  const briefId = `brief_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Determine target URL
  const targetUrl = strategy.contentMode === 'optimize' 
    ? strategy.targetUrl || null
    : null;
  
  const suggestedSlug = strategy.contentMode === 'create'
    ? `/${keyword.primary.toLowerCase().replace(/\s+/g, '-')}`
    : undefined;

  // Calculate risks
  const brandRisk: RiskLevel = brandProfile?.forbiddenClaims?.length ? 'MEDIUM' : 'LOW';
  const technicalRisk: RiskLevel = urlInventory?.existingPages.some(p => p.jsRisk === 'HIGH') ? 'MEDIUM' : 'LOW';

  const brief: FullContentBrief = {
    brief_id: briefId,
    project_id: projectId,
    created_at: now,
    updated_at: now,
    generated_by: 'ai',
    status: 'draft',

    // A. Overview
    overview: {
      objective: `Rank for ${keyword.intent} keyword: "${keyword.primary}"`,
      target_audience: strategy.targetAudience || 'General audience interested in this topic',
      content_type: contentType,
      content_mode: strategy.contentMode,
    },

    // B. SEO Targeting
    seo_targeting: {
      primary_keyword: keyword.primary,
      secondary_keywords: keyword.secondary,
      related_entities: [keyword.clusterName || keyword.primary].filter(Boolean),
      search_intent: keyword.intent,
      search_volume: keyword.searchVolume,
      keyword_difficulty: keyword.difficulty,
      opportunity_score: keyword.opportunity,
      target_url: targetUrl,
      suggested_slug: suggestedSlug,
    },

    // C. Competitive Context
    competitive_context: {
      existing_internal_pages: cannibalization.overlappingPages,
      cannibalization_risk: cannibalization.risk,
      differentiation_angle: cannibalization.risk !== 'LOW'
        ? 'Focus on unique angle or consolidate with existing content'
        : 'No direct competition – opportunity for fresh content',
    },

    // D. Recommended Structure
    recommended_structure: {
      suggested_h1: outline[0]?.text || keyword.primary,
      outline,
      mandatory_sections: outline.filter(o => o.level <= 2).map(o => o.text),
      optional_sections: outline.filter(o => o.level === 3).map(o => o.text),
      faq_suggestions: faqs,
    },

    // E. Internal Linking Plan
    internal_linking: {
      required_links: urlInventory?.existingPages
        .filter(p => {
          // Check overlap based on keyword matching
          const primaryLower = keyword.primary.toLowerCase();
          const hasOverlap = p.keywords.some(k => 
            k.toLowerCase().includes(primaryLower) || primaryLower.includes(k.toLowerCase())
          );
          return !hasOverlap; // Only include non-overlapping pages
        })
        .slice(0, 3)
        .map(p => ({
          url: p.url,
          title: p.title,
          anchorText: p.title.split(' ').slice(0, 4).join(' '),
          relevanceScore: 80,
          reason: 'Related topic for internal linking',
        })) || [],
      anchor_text_guidance: 'Use natural, descriptive anchor text. Avoid exact-match keyword stuffing.',
      links_to_avoid: cannibalization.overlappingPages
        .filter(p => p.overlap_score >= 50)
        .map(p => ({
          url: p.url,
          reason: 'High keyword overlap – risk of cannibalization',
        })),
    },

    // F. Content Requirements
    content_requirements: {
      word_count_range: wordCountRange,
      reading_level: keyword.difficulty > 60 ? 'advanced' : keyword.difficulty > 30 ? 'intermediate' : 'basic',
      tone,
      formality: keyword.intent === 'transactional' ? 'semi-formal' : 'formal',
      cta_style: keyword.intent === 'transactional' ? 'transactional' : keyword.intent === 'commercial' ? 'neutral' : 'soft',
    },

    // G. SEO & Technical Constraints
    seo_constraints: {
      meta_title_guidance: `Include "${keyword.primary}" near start. Max 60 chars. Add compelling modifier.`,
      meta_description_guidance: `Include "${keyword.primary}" naturally. 150-160 chars. Include CTA for ${keyword.intent} intent.`,
      structured_data_requirements: keyword.intent === 'informational' 
        ? ['FAQPage', 'Article', 'BreadcrumbList']
        : ['Product', 'BreadcrumbList', 'Organization'],
      seo_ready_signals: [
        'Title must be non-placeholder',
        'H1 must match target keyword intent',
        'Meta description must be unique',
        'Canonical URL must be set',
      ],
    },

    // H. Risks & Warnings
    risks: {
      brand_risk: brandRisk,
      compliance_risk: brandProfile?.complianceRules?.length ? 'MEDIUM' : 'LOW',
      technical_risk: technicalRisk,
      cannibalization_risk: cannibalization.risk,
      warnings: [
        ...(cannibalization.risk !== 'LOW' ? [`Cannibalization risk: ${cannibalization.overlappingPages.length} overlapping pages`] : []),
        ...(brandProfile?.forbiddenClaims?.length ? ['Brand compliance: Forbidden claims must be avoided'] : []),
        ...(keyword.difficulty > 70 ? ['High keyword difficulty – may require authority building'] : []),
      ],
    },

    // I. Success Metrics
    success_metrics: {
      primary_kpi: keyword.intent === 'transactional' ? 'Conversion rate' : 'Organic traffic',
      secondary_kpis: [
        'Keyword ranking position',
        'Time on page',
        'Bounce rate',
        ...(keyword.intent === 'transactional' ? ['Lead generation'] : []),
      ],
      expected_time_to_impact: keyword.difficulty > 60 ? '90-180 days' : keyword.difficulty > 30 ? '60-90 days' : '30-60 days',
      target_ranking: 10,
      target_traffic_increase: Math.round(keyword.searchVolume * 0.1),
    },

    // AI Reasoning
    ai_reasoning: {
      explanation: `Generated ${contentType} brief for ${keyword.intent} intent keyword "${keyword.primary}". ` +
        `Content mode: ${strategy.contentMode}. ` +
        `Opportunity: ${keyword.opportunity}. ` +
        `Cannibalization risk: ${cannibalization.risk}.`,
      confidence_score: cannibalization.risk === 'HIGH' ? 65 : cannibalization.risk === 'MEDIUM' ? 78 : 88,
      data_sources_used: [
        'Keyword Intelligence',
        ...(urlInventory ? ['URL Inventory'] : []),
        ...(brandProfile ? ['Brand Profile'] : []),
        'Intent Classification Model',
      ],
    },
  };

  return brief;
}

// =============================================================================
// UI COMPONENTS
// =============================================================================

interface RiskBadgeProps {
  level: RiskLevel;
  label?: string;
  size?: 'sm' | 'md';
}

export function RiskBadge({ level, label, size = 'sm' }: RiskBadgeProps) {
  const config = {
    LOW: { color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle2 },
    MEDIUM: { color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: AlertTriangle },
    HIGH: { color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
  };
  const { color, bgColor, icon: Icon } = config[level];

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-medium',
      bgColor, color,
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
    )}>
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {label || level}
    </span>
  );
}

interface SectionHeaderProps {
  letter: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

function SectionHeader({ letter, title, icon: Icon }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
        {letter}
      </div>
      <Icon className="h-5 w-5 text-gray-500" />
      <h3 className="font-semibold text-gray-900">{title}</h3>
    </div>
  );
}

// =============================================================================
// MAIN DISPLAY COMPONENT
// =============================================================================

interface ContentBriefDisplayProps {
  brief: FullContentBrief;
  onApprove?: (briefId: string) => void;
  onReject?: (briefId: string) => void;
  onEdit?: (briefId: string) => void;
  onExport?: (briefId: string) => void;
  className?: string;
}

export function ContentBriefDisplay({
  brief,
  onApprove,
  onReject,
  onEdit,
  onExport,
  className,
}: ContentBriefDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'seo', 'structure'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const intentConfig = SEARCH_INTENT_CONFIG[brief.seo_targeting.search_intent];
  const opportunityConfig = OPPORTUNITY_CONFIG[brief.seo_targeting.opportunity_score];
  const contentTypeConfig = CONTENT_TYPE_CONFIG[brief.overview.content_type];
  const modeConfig = CONTENT_MODE_CONFIG[brief.overview.content_mode];

  const hasHighRisk = brief.risks.cannibalization_risk === 'HIGH' ||
    brief.risks.brand_risk === 'HIGH' ||
    brief.risks.compliance_risk === 'HIGH';

  return (
    <div className={cn('bg-white rounded-xl border overflow-hidden', className)}>
      {/* Header */}
      <div className={cn(
        'p-6 border-b',
        hasHighRisk ? 'bg-red-50 border-red-200' : 'bg-gradient-to-r from-blue-50 to-purple-50'
      )}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={cn(
                'px-2 py-1 rounded-full text-xs font-medium',
                modeConfig.bgColor, modeConfig.color
              )}>
                {modeConfig.label}
              </span>
              <span className={cn(
                'px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700'
              )}>
                {contentTypeConfig.label}
              </span>
              <span className={cn(
                'px-2 py-1 rounded-full text-xs font-medium',
                brief.status === 'approved' ? 'bg-green-100 text-green-700' :
                brief.status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-600'
              )}>
                {brief.status.toUpperCase()}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {brief.seo_targeting.primary_keyword}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {brief.overview.objective}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onExport && (
              <button
                onClick={() => onExport(brief.brief_id)}
                className="p-2 hover:bg-white/50 rounded-lg text-gray-500"
                title="Export Brief"
              >
                <Download className="h-5 w-5" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(brief.brief_id)}
                className="p-2 hover:bg-white/50 rounded-lg text-gray-500"
                title="Edit Brief"
              >
                <Edit3 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            <span>{formatCompact(brief.seo_targeting.search_volume)} vol</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Target className="h-4 w-4 text-gray-400" />
            <span>KD: {brief.seo_targeting.keyword_difficulty}</span>
          </div>
          <div className={cn('flex items-center gap-1.5', intentConfig.color)}>
            <span className={cn('w-2 h-2 rounded-full', intentConfig.bgColor)} />
            {intentConfig.label}
          </div>
          <div className={cn('flex items-center gap-1.5', opportunityConfig.color)}>
            {opportunityConfig.label}
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span>{brief.ai_reasoning.confidence_score}% confidence</span>
          </div>
        </div>
      </div>

      {/* Risks Alert */}
      {brief.risks.warnings.length > 0 && (
        <div className="p-4 bg-yellow-50 border-b border-yellow-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Warnings</p>
              <ul className="text-sm text-yellow-700 mt-1 space-y-0.5">
                {brief.risks.warnings.map((warning, i) => (
                  <li key={i}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Content Sections */}
      <div className="divide-y divide-gray-100">
        {/* A. Overview */}
        <CollapsibleSection
          id="overview"
          letter="A"
          title="Overview"
          icon={FileText}
          isExpanded={expandedSections.has('overview')}
          onToggle={() => toggleSection('overview')}
        >
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="Objective" value={brief.overview.objective} />
            <InfoItem label="Target Audience" value={brief.overview.target_audience} />
            <InfoItem label="Content Type" value={contentTypeConfig.label} />
            <InfoItem label="Content Mode" value={modeConfig.label} />
          </div>
        </CollapsibleSection>

        {/* B. SEO Targeting */}
        <CollapsibleSection
          id="seo"
          letter="B"
          title="SEO Targeting"
          icon={Target}
          isExpanded={expandedSections.has('seo')}
          onToggle={() => toggleSection('seo')}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoItem label="Primary Keyword" value={brief.seo_targeting.primary_keyword} highlight />
              <InfoItem label="Search Intent" value={intentConfig.label} />
              <InfoItem label="Search Volume" value={formatNumber(brief.seo_targeting.search_volume)} />
              <InfoItem label="Keyword Difficulty" value={`${brief.seo_targeting.keyword_difficulty}/100`} />
            </div>
            
            {brief.seo_targeting.secondary_keywords.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Secondary Keywords</p>
                <div className="flex flex-wrap gap-2">
                  {brief.seo_targeting.secondary_keywords.map((kw, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {brief.seo_targeting.target_url && (
              <InfoItem 
                label="Target URL" 
                value={brief.seo_targeting.target_url}
                link 
              />
            )}
            {brief.seo_targeting.suggested_slug && (
              <InfoItem label="Suggested Slug" value={brief.seo_targeting.suggested_slug} />
            )}
          </div>
        </CollapsibleSection>

        {/* C. Competitive Context */}
        <CollapsibleSection
          id="competitive"
          letter="C"
          title="Competitive Context"
          icon={BarChart3}
          isExpanded={expandedSections.has('competitive')}
          onToggle={() => toggleSection('competitive')}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Cannibalization Risk:</span>
              <RiskBadge level={brief.competitive_context.cannibalization_risk} />
            </div>
            
            <InfoItem 
              label="Differentiation Angle" 
              value={brief.competitive_context.differentiation_angle} 
            />

            {brief.competitive_context.existing_internal_pages.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Existing Internal Pages</p>
                <div className="space-y-2">
                  {brief.competitive_context.existing_internal_pages.map((page, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-700 truncate">{page.title}</span>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded',
                        page.overlap_score >= 80 ? 'bg-red-100 text-red-700' :
                        page.overlap_score >= 40 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      )}>
                        {page.overlap_score}% overlap
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* D. Recommended Structure */}
        <CollapsibleSection
          id="structure"
          letter="D"
          title="Recommended Structure"
          icon={ListTree}
          isExpanded={expandedSections.has('structure')}
          onToggle={() => toggleSection('structure')}
        >
          <div className="space-y-4">
            <InfoItem label="Suggested H1" value={brief.recommended_structure.suggested_h1} highlight />
            
            <div>
              <p className="text-xs text-gray-500 mb-2">Content Outline</p>
              <div className="space-y-1 border rounded-lg p-3">
                {brief.recommended_structure.outline.map((item, i) => (
                  <div 
                    key={i}
                    className={cn(
                      'flex items-center gap-2 py-1',
                      item.level === 2 && 'pl-4',
                      item.level === 3 && 'pl-8',
                    )}
                  >
                    <span className={cn(
                      'text-xs font-mono px-1.5 py-0.5 rounded',
                      item.level === 1 ? 'bg-blue-100 text-blue-700' :
                      item.level === 2 ? 'bg-gray-100 text-gray-600' :
                      'bg-gray-50 text-gray-500'
                    )}>
                      H{item.level}
                    </span>
                    <span className={cn(
                      'text-sm',
                      item.level === 1 ? 'font-semibold' : ''
                    )}>
                      {item.text}
                    </span>
                    {item.wordCount && (
                      <span className="text-xs text-gray-400 ml-auto">
                        ~{item.wordCount} words
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {brief.recommended_structure.faq_suggestions.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">FAQ Suggestions</p>
                <ul className="space-y-1.5">
                  {brief.recommended_structure.faq_suggestions.map((faq, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-gray-400">Q:</span>
                      <span className="text-gray-700">{faq.question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* E. Internal Linking Plan */}
        <CollapsibleSection
          id="linking"
          letter="E"
          title="Internal Linking Plan"
          icon={Link2}
          isExpanded={expandedSections.has('linking')}
          onToggle={() => toggleSection('linking')}
        >
          <div className="space-y-4">
            <InfoItem 
              label="Anchor Text Guidance" 
              value={brief.internal_linking.anchor_text_guidance} 
            />

            {brief.internal_linking.required_links.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Required Internal Links</p>
                <div className="space-y-2">
                  {brief.internal_linking.required_links.map((link, i) => (
                    <div key={i} className="p-2 bg-green-50 rounded border border-green-100">
                      <p className="text-sm font-medium text-gray-900">{link.title}</p>
                      <p className="text-xs text-blue-600">{link.url}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Anchor: "{link.anchorText}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {brief.internal_linking.links_to_avoid.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Links to Avoid</p>
                <div className="space-y-2">
                  {brief.internal_linking.links_to_avoid.map((link, i) => (
                    <div key={i} className="p-2 bg-red-50 rounded border border-red-100">
                      <p className="text-xs text-red-700">{link.url}</p>
                      <p className="text-xs text-red-600 mt-0.5">{link.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* F. Content Requirements */}
        <CollapsibleSection
          id="requirements"
          letter="F"
          title="Content Requirements"
          icon={PenTool}
          isExpanded={expandedSections.has('requirements')}
          onToggle={() => toggleSection('requirements')}
        >
          <div className="grid grid-cols-2 gap-4">
            <InfoItem 
              label="Word Count" 
              value={`${formatNumber(brief.content_requirements.word_count_range.min)} – ${formatNumber(brief.content_requirements.word_count_range.max)}`} 
            />
            <InfoItem label="Reading Level" value={brief.content_requirements.reading_level} />
            <InfoItem label="Tone" value={brief.content_requirements.tone.replace('_', ' ')} />
            <InfoItem label="Formality" value={brief.content_requirements.formality} />
            <InfoItem label="CTA Style" value={brief.content_requirements.cta_style} />
          </div>
        </CollapsibleSection>

        {/* G. SEO & Technical Constraints */}
        <CollapsibleSection
          id="seo-constraints"
          letter="G"
          title="SEO & Technical Constraints"
          icon={Settings}
          isExpanded={expandedSections.has('seo-constraints')}
          onToggle={() => toggleSection('seo-constraints')}
        >
          <div className="space-y-4">
            <InfoItem label="Meta Title Guidance" value={brief.seo_constraints.meta_title_guidance} />
            <InfoItem label="Meta Description Guidance" value={brief.seo_constraints.meta_description_guidance} />
            
            <div>
              <p className="text-xs text-gray-500 mb-2">Structured Data Requirements</p>
              <div className="flex flex-wrap gap-2">
                {brief.seo_constraints.structured_data_requirements.map((schema, i) => (
                  <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                    {schema}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">SEO-Ready Signals</p>
              <ul className="space-y-1">
                {brief.seo_constraints.seo_ready_signals.map((signal, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-gray-700">{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CollapsibleSection>

        {/* H. Risks & Warnings */}
        <CollapsibleSection
          id="risks"
          letter="H"
          title="Risks & Warnings"
          icon={Shield}
          isExpanded={expandedSections.has('risks')}
          onToggle={() => toggleSection('risks')}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Brand Risk</span>
              <RiskBadge level={brief.risks.brand_risk} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Compliance Risk</span>
              <RiskBadge level={brief.risks.compliance_risk} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Technical Risk</span>
              <RiskBadge level={brief.risks.technical_risk} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Cannibalization Risk</span>
              <RiskBadge level={brief.risks.cannibalization_risk} />
            </div>
          </div>
        </CollapsibleSection>

        {/* I. Success Metrics */}
        <CollapsibleSection
          id="metrics"
          letter="I"
          title="Success Metrics"
          icon={TrendingUp}
          isExpanded={expandedSections.has('metrics')}
          onToggle={() => toggleSection('metrics')}
        >
          <div className="space-y-4">
            <InfoItem label="Primary KPI" value={brief.success_metrics.primary_kpi} highlight />
            
            <div>
              <p className="text-xs text-gray-500 mb-2">Secondary KPIs</p>
              <div className="flex flex-wrap gap-2">
                {brief.success_metrics.secondary_kpis.map((kpi, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                    {kpi}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InfoItem label="Time to Impact" value={brief.success_metrics.expected_time_to_impact} />
              {brief.success_metrics.target_ranking && (
                <InfoItem label="Target Ranking" value={`Top ${brief.success_metrics.target_ranking}`} />
              )}
              {brief.success_metrics.target_traffic_increase && (
                <InfoItem 
                  label="Target Traffic Increase" 
                  value={`+${formatNumber(brief.success_metrics.target_traffic_increase)}/month`} 
                />
              )}
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* AI Reasoning Footer */}
      <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-t">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-purple-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-purple-800">AI Reasoning</p>
            <p className="text-sm text-gray-700 mt-1">{brief.ai_reasoning.explanation}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>Confidence: {brief.ai_reasoning.confidence_score}%</span>
              <span>•</span>
              <span>Sources: {brief.ai_reasoning.data_sources_used.join(', ')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Footer */}
      {(onApprove || onReject) && brief.status === 'draft' && (
        <div className="p-4 border-t bg-gray-50 flex items-center justify-end gap-3">
          {onReject && (
            <button
              onClick={() => onReject(brief.brief_id)}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
            >
              Reject
            </button>
          )}
          {onApprove && (
            <button
              onClick={() => onApprove(brief.brief_id)}
              disabled={hasHighRisk}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2',
                hasHighRisk
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve Brief
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface CollapsibleSectionProps {
  id: string;
  letter: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  id,
  letter,
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
            {letter}
          </div>
          <Icon className="h-4 w-4 text-gray-400" />
          <span className="font-medium text-gray-900">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pl-16">
          {children}
        </div>
      )}
    </div>
  );
}

interface InfoItemProps {
  label: string;
  value: string;
  highlight?: boolean;
  link?: boolean;
}

function InfoItem({ label, value, highlight, link }: InfoItemProps) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      {link ? (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          {value}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <p className={cn(
          'text-sm',
          highlight ? 'font-semibold text-gray-900' : 'text-gray-700'
        )}>
          {value}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// BRIEF GENERATOR FORM COMPONENT
// =============================================================================

interface BriefGeneratorFormProps {
  keyword: BriefGenerationInput['keyword'];
  projectId: string;
  urlInventory?: BriefGenerationInput['urlInventory'];
  brandProfile?: BriefGenerationInput['brandProfile'];
  onGenerate: (brief: FullContentBrief) => void;
  onCancel?: () => void;
  className?: string;
}

export function BriefGeneratorForm({
  keyword,
  projectId,
  urlInventory,
  brandProfile,
  onGenerate,
  onCancel,
  className,
}: BriefGeneratorFormProps) {
  const [contentMode, setContentMode] = useState<ContentMode>('create');
  const [targetUrl, setTargetUrl] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [businessPriority, setBusinessPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1500));

    const input: BriefGenerationInput = {
      keyword,
      urlInventory,
      brandProfile,
      strategy: {
        contentMode,
        targetUrl: targetUrl || undefined,
        targetAudience: targetAudience || undefined,
        businessPriority,
      },
      projectId,
    };

    const brief = generateContentBrief(input);
    setIsGenerating(false);
    onGenerate(brief);
  };

  const intentConfig = SEARCH_INTENT_CONFIG[keyword.intent];
  const opportunityConfig = OPPORTUNITY_CONFIG[keyword.opportunity];

  return (
    <div className={cn('bg-white rounded-xl border p-6', className)}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg">
          <Sparkles className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Generate Content Brief</h2>
          <p className="text-sm text-gray-500">Per Section 13 – Auto Content Brief Generation</p>
        </div>
      </div>

      {/* Keyword Summary */}
      <div className="p-4 bg-gray-50 rounded-lg mb-6">
        <p className="text-xs text-gray-500 uppercase mb-2">Target Keyword</p>
        <p className="text-lg font-semibold text-gray-900">{keyword.primary}</p>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span>{formatCompact(keyword.searchVolume)} vol</span>
          <span>KD: {keyword.difficulty}</span>
          <span className={intentConfig.color}>{intentConfig.label}</span>
          <span className={opportunityConfig.color}>{opportunityConfig.label}</span>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Content Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content Mode
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['create', 'optimize', 'assist'] as ContentMode[]).map(mode => {
              const config = CONTENT_MODE_CONFIG[mode];
              return (
                <button
                  key={mode}
                  onClick={() => setContentMode(mode)}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    contentMode === mode
                      ? cn('border-2', config.color.replace('text', 'border'), config.bgColor)
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <p className={cn('font-medium', contentMode === mode ? config.color : 'text-gray-900')}>
                    {config.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target URL (for Optimize mode) */}
        {contentMode === 'optimize' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target URL to Optimize
            </label>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="/path/to/existing-page"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Target Audience */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Target Audience (optional)
          </label>
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="e.g., Young professionals aged 25-35"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Business Priority */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Business Priority
          </label>
          <div className="flex gap-3">
            {(['high', 'medium', 'low'] as const).map(priority => (
              <button
                key={priority}
                onClick={() => setBusinessPriority(priority)}
                className={cn(
                  'flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all',
                  businessPriority === priority
                    ? priority === 'high' 
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : priority === 'medium'
                        ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                        : 'border-gray-500 bg-gray-50 text-gray-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || (contentMode === 'optimize' && !targetUrl)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2',
            isGenerating || (contentMode === 'optimize' && !targetUrl)
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
          )}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isGenerating ? 'Generating...' : 'Generate Brief'}
        </button>
      </div>
    </div>
  );
}
