/**
 * Content Brief Generator Service
 * Section 13: Auto Content Brief Generation
 * 
 * Generates Content Briefs based on:
 * - Keyword Intelligence (from database)
 * - URL Inventory (from crawl)
 * - Brand Guidelines (from project config)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ContentBrief,
  CreateContentBriefInput,
  ContentMode,
  SearchIntent,
  RiskLevel,
  RecommendedStructure,
  InternalLinkPlan,
  SEOConstraints,
  ContentRisks,
  SuccessMetrics,
  NormalizedContent,
} from './types';

// Types for brief generation input
export interface KeywordData {
  keyword: string;
  search_volume: number;
  difficulty: number;
  intent: SearchIntent;
  cpc?: number;
  trend?: 'up' | 'stable' | 'down';
}

export interface ProjectContext {
  project_id: string;
  domain: string;
  brand_tone?: string;
  brand_formality?: string;
  forbidden_claims?: string[];
  competitors?: string[];
  default_cta_style?: string;
}

export interface ExistingPageData {
  url: string;
  title: string;
  primary_keyword?: string;
  word_count: number;
  last_crawled: Date;
}

/**
 * Content Brief Generator
 * Creates briefs from keyword data and crawled content
 */
export class ContentBriefGenerator {
  /**
   * Generate a Content Brief from keyword data
   */
  generate(
    keywordData: KeywordData,
    projectContext: ProjectContext,
    existingPages: ExistingPageData[] = [],
    crawledContent?: NormalizedContent
  ): ContentBrief {
    const contentMode = this.determineContentMode(keywordData, existingPages, crawledContent);
    const cannibalizationRisk = this.assessCannibalizationRisk(keywordData, existingPages);
    const recommendedStructure = this.generateStructure(keywordData, crawledContent);
    const internalLinksPlan = this.planInternalLinks(keywordData, existingPages);

    const brief: ContentBrief = {
      id: uuidv4(),
      project_id: projectContext.project_id,

      // Content mode
      content_mode: contentMode,
      status: 'DRAFT',

      // Overview
      objective: this.generateObjective(keywordData, contentMode),
      target_audience: this.inferTargetAudience(keywordData),
      content_type: this.determineContentType(keywordData),

      // SEO Targeting
      primary_keyword: keywordData.keyword,
      secondary_keywords: this.generateSecondaryKeywords(keywordData),
      related_entities: this.extractEntities(keywordData),
      search_intent: keywordData.intent,
      target_url: this.generateTargetUrl(keywordData, projectContext, contentMode, existingPages),

      // Competitive Context
      cannibalization_risk: cannibalizationRisk,
      differentiation_angle: this.suggestDifferentiation(keywordData, existingPages),

      // Recommended Structure
      recommended_structure: recommendedStructure,

      // Internal Linking Plan
      internal_links_plan: internalLinksPlan,

      // Content Requirements
      word_count_min: this.calculateMinWordCount(keywordData),
      word_count_max: this.calculateMaxWordCount(keywordData),
      reading_level: 'intermediate',
      tone: projectContext.brand_tone || 'neutral_expert',
      formality: projectContext.brand_formality || 'professional',
      cta_style: projectContext.default_cta_style || 'soft',

      // SEO Constraints
      seo_constraints: this.generateSEOConstraints(keywordData, projectContext),

      // Risks
      risks: this.assessRisks(keywordData, cannibalizationRisk, projectContext),

      // Success Metrics
      success_metrics: this.defineSuccessMetrics(keywordData),

      // Timestamps
      created_at: new Date(),
      updated_at: new Date(),
    };

    return brief;
  }

  /**
   * Determine content mode based on existing pages
   */
  private determineContentMode(
    keywordData: KeywordData,
    existingPages: ExistingPageData[],
    crawledContent?: NormalizedContent
  ): ContentMode {
    // Check if there's an existing page targeting this keyword
    const existingPage = existingPages.find(
      (p) =>
        p.primary_keyword?.toLowerCase() === keywordData.keyword.toLowerCase() ||
        p.title.toLowerCase().includes(keywordData.keyword.toLowerCase())
    );

    if (existingPage) {
      // If page exists but is thin (< 500 words), optimize
      if (existingPage.word_count < 500) {
        return 'OPTIMIZE';
      }
      // If page exists and is substantial, assist
      return 'ASSIST';
    }

    // No existing page, create new
    return 'CREATE';
  }

  /**
   * Assess cannibalization risk
   */
  private assessCannibalizationRisk(
    keywordData: KeywordData,
    existingPages: ExistingPageData[]
  ): RiskLevel {
    const keyword = keywordData.keyword.toLowerCase();
    const keywordParts = keyword.split(' ');

    let highRiskCount = 0;
    let mediumRiskCount = 0;

    for (const page of existingPages) {
      const pageKeyword = page.primary_keyword?.toLowerCase() || '';
      const pageTitle = page.title.toLowerCase();

      // Exact match = HIGH risk
      if (pageKeyword === keyword || pageTitle.includes(keyword)) {
        highRiskCount++;
        continue;
      }

      // Partial match (50%+ words overlap) = MEDIUM risk
      const matchingParts = keywordParts.filter(
        (part) => pageKeyword.includes(part) || pageTitle.includes(part)
      );
      if (matchingParts.length >= keywordParts.length * 0.5) {
        mediumRiskCount++;
      }
    }

    if (highRiskCount > 0) return 'HIGH';
    if (mediumRiskCount > 1) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate recommended structure
   */
  private generateStructure(
    keywordData: KeywordData,
    crawledContent?: NormalizedContent
  ): RecommendedStructure {
    const intent = keywordData.intent;
    const keyword = keywordData.keyword;

    // Base structure by intent
    let h2Outline: string[] = [];
    let mandatorySections: string[] = [];
    let faqSuggestions: string[] = [];

    switch (intent) {
      case 'Informational':
        h2Outline = [
          `${keyword} là gì?`,
          'Tại sao quan trọng?',
          'Hướng dẫn chi tiết',
          'Lưu ý quan trọng',
          'Câu hỏi thường gặp',
        ];
        mandatorySections = ['Định nghĩa', 'Hướng dẫn'];
        faqSuggestions = [
          `${keyword} hoạt động như thế nào?`,
          `Ai nên quan tâm đến ${keyword}?`,
          `Làm thế nào để bắt đầu với ${keyword}?`,
        ];
        break;

      case 'Commercial':
        h2Outline = [
          `Đánh giá ${keyword}`,
          'So sánh các lựa chọn',
          'Ưu và nhược điểm',
          'Ai phù hợp với sản phẩm này?',
          'Kết luận',
        ];
        mandatorySections = ['Đánh giá', 'So sánh', 'Kết luận'];
        faqSuggestions = [
          `${keyword} có đáng không?`,
          `Nên chọn loại nào?`,
          'Giá cả như thế nào?',
        ];
        break;

      case 'Transactional':
        h2Outline = [
          `Tổng quan về ${keyword}`,
          'Quyền lợi & tính năng',
          'Điều kiện & yêu cầu',
          'Cách đăng ký/mua',
          'Hỗ trợ khách hàng',
        ];
        mandatorySections = ['Quyền lợi', 'Điều kiện', 'Cách đăng ký'];
        faqSuggestions = [
          'Phí là bao nhiêu?',
          'Thời gian xử lý?',
          'Cần chuẩn bị gì?',
        ];
        break;

      case 'Navigational':
        h2Outline = ['Giới thiệu', 'Thông tin liên hệ', 'Các dịch vụ'];
        mandatorySections = ['Giới thiệu'];
        break;
    }

    // If we have crawled content, enhance with existing structure
    if (crawledContent && crawledContent.content.headings.length > 0) {
      const existingH2s = crawledContent.content.headings
        .filter((h) => h.level === 2)
        .map((h) => h.text);

      // Merge, prioritizing existing structure
      h2Outline = [...new Set([...existingH2s, ...h2Outline])];
    }

    return {
      suggested_h1: this.generateH1(keyword, intent),
      h2_outline: h2Outline,
      mandatory_sections: mandatorySections,
      optional_sections: ['Video hướng dẫn', 'Tài liệu tham khảo'],
      faq_suggestions: faqSuggestions,
    };
  }

  /**
   * Generate H1 suggestion
   */
  private generateH1(keyword: string, intent: SearchIntent): string {
    switch (intent) {
      case 'Informational':
        return `${this.capitalize(keyword)} – Hướng dẫn chi tiết từ A-Z`;
      case 'Commercial':
        return `Đánh giá ${this.capitalize(keyword)} – So sánh & Review chi tiết`;
      case 'Transactional':
        return `${this.capitalize(keyword)} – Quyền lợi, Điều kiện & Cách đăng ký`;
      case 'Navigational':
        return this.capitalize(keyword);
      default:
        return this.capitalize(keyword);
    }
  }

  /**
   * Plan internal links
   */
  private planInternalLinks(
    keywordData: KeywordData,
    existingPages: ExistingPageData[]
  ): InternalLinkPlan[] {
    const plans: InternalLinkPlan[] = [];
    const keyword = keywordData.keyword.toLowerCase();

    // Find related pages to link to
    for (const page of existingPages) {
      // Skip exact match (that's potentially this page)
      if (page.primary_keyword?.toLowerCase() === keyword) continue;

      // Check for topical relevance
      const isRelated =
        page.title.toLowerCase().includes(keyword.split(' ')[0]) ||
        keyword.includes(page.primary_keyword?.toLowerCase().split(' ')[0] || '');

      if (isRelated) {
        plans.push({
          url: page.url,
          anchor_guidance: page.title.slice(0, 50),
          context: `Link trong phần liên quan đến ${page.primary_keyword || page.title}`,
          is_required: plans.length < 2, // First 2 links are required
        });
      }

      // Max 5 internal link suggestions
      if (plans.length >= 5) break;
    }

    return plans;
  }

  /**
   * Generate SEO constraints
   */
  private generateSEOConstraints(
    keywordData: KeywordData,
    projectContext: ProjectContext
  ): SEOConstraints {
    return {
      meta_title_guidance: `${this.capitalize(keywordData.keyword)} - [Brand/Action] | Tối đa 60 ký tự`,
      meta_description_guidance: `Mô tả ${keywordData.keyword} với call-to-action. Bao gồm lợi ích chính. Tối đa 155 ký tự.`,
      structured_data_requirements: this.getStructuredDataRequirements(keywordData.intent),
      forbidden_claims: projectContext.forbidden_claims || [],
    };
  }

  /**
   * Get structured data requirements based on intent
   */
  private getStructuredDataRequirements(intent: SearchIntent): string[] {
    switch (intent) {
      case 'Informational':
        return ['Article', 'FAQPage', 'HowTo'];
      case 'Commercial':
        return ['Article', 'Review', 'FAQPage'];
      case 'Transactional':
        return ['Product', 'Offer', 'FAQPage'];
      default:
        return ['WebPage'];
    }
  }

  /**
   * Assess overall risks
   */
  private assessRisks(
    keywordData: KeywordData,
    cannibalizationRisk: RiskLevel,
    projectContext: ProjectContext
  ): ContentRisks {
    // Brand risk based on keyword sensitivity
    const sensitivePhrases = ['vay', 'lãi suất', 'đầu tư', 'bảo hiểm'];
    const brandRisk: RiskLevel = sensitivePhrases.some((p) =>
      keywordData.keyword.toLowerCase().includes(p)
    )
      ? 'MEDIUM'
      : 'LOW';

    // Compliance risk for financial keywords
    const compliancePhrases = ['lãi suất', 'phí', 'cam kết', 'đảm bảo'];
    const complianceRisk: RiskLevel = compliancePhrases.some((p) =>
      keywordData.keyword.toLowerCase().includes(p)
    )
      ? 'HIGH'
      : 'LOW';

    return {
      cannibalization: cannibalizationRisk,
      brand: brandRisk,
      compliance: complianceRisk,
      technical: 'LOW', // Default, can be updated based on crawl data
    };
  }

  /**
   * Define success metrics
   */
  private defineSuccessMetrics(keywordData: KeywordData): SuccessMetrics {
    const difficulty = keywordData.difficulty;

    let primaryKpi = 'Top 10 ranking';
    let timeToImpact = '90 days';

    if (difficulty < 30) {
      primaryKpi = 'Top 5 ranking';
      timeToImpact = '30 days';
    } else if (difficulty < 60) {
      primaryKpi = 'Top 10 ranking';
      timeToImpact = '60 days';
    } else {
      primaryKpi = 'Page 1 ranking';
      timeToImpact = '90-180 days';
    }

    return {
      primary_kpi: primaryKpi,
      secondary_kpis: ['Organic traffic growth', 'Click-through rate improvement', 'Engagement metrics'],
      expected_time_to_impact: timeToImpact,
    };
  }

  /**
   * Generate objective text
   */
  private generateObjective(keywordData: KeywordData, contentMode: ContentMode): string {
    const action = contentMode === 'CREATE' ? 'Tạo mới' : contentMode === 'OPTIMIZE' ? 'Tối ưu' : 'Hỗ trợ cập nhật';
    
    return `${action} nội dung nhắm vào từ khóa "${keywordData.keyword}" với search intent ${keywordData.intent}. Mục tiêu: Cải thiện ranking và traffic organic.`;
  }

  /**
   * Infer target audience
   */
  private inferTargetAudience(keywordData: KeywordData): string {
    const keyword = keywordData.keyword.toLowerCase();

    if (keyword.includes('doanh nghiệp') || keyword.includes('business')) {
      return 'Doanh nghiệp, chủ kinh doanh';
    }
    if (keyword.includes('cá nhân') || keyword.includes('personal')) {
      return 'Khách hàng cá nhân';
    }
    if (keyword.includes('sinh viên') || keyword.includes('học sinh')) {
      return 'Sinh viên, học sinh';
    }

    return 'Khách hàng tiềm năng quan tâm đến sản phẩm/dịch vụ';
  }

  /**
   * Determine content type
   */
  private determineContentType(keywordData: KeywordData): string {
    switch (keywordData.intent) {
      case 'Informational':
        return 'article';
      case 'Commercial':
        return 'review';
      case 'Transactional':
        return 'landing_page';
      case 'Navigational':
        return 'page';
      default:
        return 'article';
    }
  }

  /**
   * Generate secondary keywords
   */
  private generateSecondaryKeywords(keywordData: KeywordData): string[] {
    const primary = keywordData.keyword;
    const words = primary.split(' ');

    // Generate variations
    const variations: string[] = [];

    // Add "cách", "hướng dẫn" for informational
    if (keywordData.intent === 'Informational') {
      variations.push(`cách ${primary}`);
      variations.push(`hướng dẫn ${primary}`);
    }

    // Add "tốt nhất", "uy tín" for commercial
    if (keywordData.intent === 'Commercial') {
      variations.push(`${primary} tốt nhất`);
      variations.push(`${primary} uy tín`);
    }

    // Add "giá", "phí" for transactional
    if (keywordData.intent === 'Transactional') {
      variations.push(`${primary} giá bao nhiêu`);
      variations.push(`phí ${primary}`);
    }

    return variations.slice(0, 5);
  }

  /**
   * Extract potential entities
   */
  private extractEntities(keywordData: KeywordData): string[] {
    // Basic entity extraction - in production, use NER
    const entities: string[] = [];
    const keyword = keywordData.keyword;

    // Check for brand patterns
    if (keyword.toLowerCase().includes('vib')) {
      entities.push('VIB', 'Vietnam International Bank');
    }

    // Check for product types
    const productTypes = ['thẻ tín dụng', 'tài khoản', 'vay', 'tiết kiệm', 'bảo hiểm'];
    for (const type of productTypes) {
      if (keyword.toLowerCase().includes(type)) {
        entities.push(type);
      }
    }

    return entities;
  }

  /**
   * Generate target URL
   */
  private generateTargetUrl(
    keywordData: KeywordData,
    projectContext: ProjectContext,
    contentMode: ContentMode,
    existingPages: ExistingPageData[]
  ): string {
    // If optimizing, use existing URL
    if (contentMode !== 'CREATE') {
      const existingPage = existingPages.find(
        (p) =>
          p.primary_keyword?.toLowerCase() === keywordData.keyword.toLowerCase() ||
          p.title.toLowerCase().includes(keywordData.keyword.toLowerCase())
      );
      if (existingPage) return existingPage.url;
    }

    // Generate new URL slug
    const slug = keywordData.keyword
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60);

    return `/${slug}`;
  }

  /**
   * Calculate minimum word count
   */
  private calculateMinWordCount(keywordData: KeywordData): number {
    // Higher difficulty = need more comprehensive content
    if (keywordData.difficulty > 70) return 2000;
    if (keywordData.difficulty > 50) return 1500;
    if (keywordData.difficulty > 30) return 1000;
    return 800;
  }

  /**
   * Calculate maximum word count
   */
  private calculateMaxWordCount(keywordData: KeywordData): number {
    // Based on intent
    switch (keywordData.intent) {
      case 'Informational':
        return 3000;
      case 'Commercial':
        return 2500;
      case 'Transactional':
        return 2000;
      case 'Navigational':
        return 1000;
      default:
        return 2500;
    }
  }

  /**
   * Suggest differentiation angle
   */
  private suggestDifferentiation(
    keywordData: KeywordData,
    existingPages: ExistingPageData[]
  ): string {
    if (existingPages.length === 0) {
      return 'Nội dung hoàn toàn mới, tập trung vào chất lượng và độ chính xác.';
    }

    const avgWordCount = existingPages.reduce((sum, p) => sum + p.word_count, 0) / existingPages.length;

    if (avgWordCount < 1000) {
      return 'Tạo nội dung chi tiết và toàn diện hơn các trang hiện có.';
    }

    return 'Tập trung vào góc nhìn độc đáo và case studies cụ thể.';
  }

  /**
   * Helper: Capitalize first letter of each word
   */
  private capitalize(str: string): string {
    return str
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// Factory and singleton
export const contentBriefGenerator = new ContentBriefGenerator();

export function createContentBriefGenerator(): ContentBriefGenerator {
  return new ContentBriefGenerator();
}
