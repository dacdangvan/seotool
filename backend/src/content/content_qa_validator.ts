/**
 * Content QA Validator Service
 * Section 16: Automated Content QA & SEO Validation
 * 
 * 5-Layer QA Validation Pipeline:
 * 1. Structural Validation
 * 2. SEO Validation
 * 3. Intent & Coverage Validation
 * 4. Brand & Compliance Validation
 * 5. Technical & Rendering Validation
 */

import {
  ContentBrief,
  GeneratedContent,
  ContentQAResult,
  QAIssue,
  QALayerResult,
  QAStatus,
  IssueSeverity,
  QAValidationRules,
} from './types';

// Default validation rules
const DEFAULT_RULES: QAValidationRules = {
  structure: {
    require_single_h1: true,
    max_heading_skip: 1, // h1 -> h3 is skip of 1 (skipping h2)
    min_word_count: 300,
    max_word_count: 5000,
    check_placeholder_text: true,
  },
  seo: {
    require_primary_keyword_in_h1: true,
    require_primary_keyword_in_first_paragraph: true,
    max_keyword_density: 3.0, // percentage
    require_meta_title: true,
    require_meta_description: true,
    meta_title_max_length: 60,
    meta_description_max_length: 160,
    require_internal_links: true,
    min_internal_links: 2,
  },
  intent: {
    allow_intent_drift: false,
    require_mandatory_sections: true,
    min_section_coverage: 80, // percentage
  },
  brand: {
    check_tone_compliance: true,
    check_forbidden_phrases: true,
    forbidden_phrases: [
      'cam kết lợi nhuận',
      'đảm bảo 100%',
      'không rủi ro',
      'chắc chắn thắng',
      'lãi suất cao nhất thị trường',
    ],
    check_competitor_mentions: true,
    competitors: [],
  },
  technical: {
    check_seo_ready_signals: true,
    warn_on_js_dependency: true,
    require_valid_markdown: true,
  },
};

// Placeholder patterns to detect
const PLACEHOLDER_PATTERNS = [
  /\[.*?\]/g, // [placeholder]
  /\{.*?\}/g, // {placeholder}
  /TODO/gi,
  /TBD/gi,
  /FIXME/gi,
  /Lorem ipsum/gi,
  /XXX/g,
];

// Promotional/hype patterns (for banking - avoid)
const PROMOTIONAL_PATTERNS = [
  /tốt nhất/gi,
  /số 1/gi,
  /hàng đầu/gi,
  /không đối thủ/gi,
  /siêu lợi nhuận/gi,
  /đầu tư an toàn tuyệt đối/gi,
];

export class ContentQAValidator {
  private rules: QAValidationRules;

  constructor(rules: Partial<QAValidationRules> = {}) {
    this.rules = this.mergeRules(DEFAULT_RULES, rules);
  }

  /**
   * Merge custom rules with defaults
   */
  private mergeRules(
    defaults: QAValidationRules,
    custom: Partial<QAValidationRules>
  ): QAValidationRules {
    return {
      structure: { ...defaults.structure, ...custom.structure },
      seo: { ...defaults.seo, ...custom.seo },
      intent: { ...defaults.intent, ...custom.intent },
      brand: { ...defaults.brand, ...custom.brand },
      technical: { ...defaults.technical, ...custom.technical },
    };
  }

  /**
   * Main validation entry point
   */
  validate(content: GeneratedContent, brief: ContentBrief): ContentQAResult {
    const structureResult = this.validateStructure(content, brief);
    const seoResult = this.validateSEO(content, brief);
    const intentResult = this.validateIntent(content, brief);
    const brandResult = this.validateBrand(content, brief);
    const technicalResult = this.validateTechnical(content, brief);

    // Combine all issues
    const allIssues = [
      ...structureResult.issues,
      ...seoResult.issues,
      ...intentResult.issues,
      ...brandResult.issues,
      ...technicalResult.issues,
    ];

    // Count issues by severity
    const blockingCount = allIssues.filter((i) => i.severity === 'BLOCKING').length;
    const warningCount = allIssues.filter((i) => i.severity === 'WARNING').length;
    const infoCount = allIssues.filter((i) => i.severity === 'INFO').length;

    // Calculate overall status
    const layerStatuses = [
      structureResult.status,
      seoResult.status,
      intentResult.status,
      brandResult.status,
      technicalResult.status,
    ];

    let qaStatus: QAStatus = 'PASS';
    if (layerStatuses.includes('FAIL') || blockingCount > 0) {
      qaStatus = 'FAIL';
    } else if (layerStatuses.includes('WARN') || warningCount > 0) {
      qaStatus = 'WARN';
    }

    // Calculate overall score
    const overallScore =
      (structureResult.score +
        seoResult.score +
        intentResult.score +
        brandResult.score +
        technicalResult.score) /
      5;

    return {
      id: '', // Will be set by repository
      project_id: content.project_id,
      content_id: content.id,
      brief_id: content.brief_id,
      qa_status: qaStatus,
      overall_score: Math.round(overallScore * 100) / 100,
      structure: structureResult,
      seo: seoResult,
      intent: intentResult,
      brand: brandResult,
      technical: technicalResult,
      all_issues: allIssues,
      blocking_issues_count: blockingCount,
      warning_issues_count: warningCount,
      info_issues_count: infoCount,
      validated_at: new Date(),
      created_at: new Date(),
    };
  }

  /**
   * Layer 1: Structural Validation (Section 16.3)
   */
  private validateStructure(content: GeneratedContent, brief: ContentBrief): QALayerResult {
    const issues: QAIssue[] = [];
    let score = 100;

    const markdown = content.content_markdown;

    // Check for valid markdown format
    if (!markdown || markdown.trim().length === 0) {
      issues.push({
        type: 'STRUCTURE',
        severity: 'BLOCKING',
        code: 'EMPTY_CONTENT',
        message: 'Content is empty',
      });
      return { status: 'FAIL', score: 0, issues };
    }

    // Extract headings from markdown
    const h1Matches = markdown.match(/^#\s+.+$/gm) || [];
    const h2Matches = markdown.match(/^##\s+.+$/gm) || [];
    const h3Matches = markdown.match(/^###\s+.+$/gm) || [];

    // Check for exactly one H1
    if (this.rules.structure.require_single_h1) {
      if (h1Matches.length === 0) {
        issues.push({
          type: 'STRUCTURE',
          severity: 'BLOCKING',
          code: 'NO_H1',
          message: 'Content must have exactly one H1 heading',
          suggestion: 'Add a main H1 heading at the beginning of the content',
        });
        score -= 30;
      } else if (h1Matches.length > 1) {
        issues.push({
          type: 'STRUCTURE',
          severity: 'WARNING',
          code: 'MULTIPLE_H1',
          message: `Content has ${h1Matches.length} H1 headings (should be 1)`,
          suggestion: 'Keep only one H1 heading and convert others to H2',
        });
        score -= 15;
      }
    }

    // Check heading hierarchy (no skipping)
    if (this.rules.structure.max_heading_skip >= 0) {
      // If we have H3 but no H2, that's a skip
      if (h3Matches.length > 0 && h2Matches.length === 0) {
        issues.push({
          type: 'STRUCTURE',
          severity: 'WARNING',
          code: 'HEADING_SKIP',
          message: 'Heading hierarchy is not sequential (H3 without H2)',
          suggestion: 'Use H2 headings before H3 to maintain proper hierarchy',
        });
        score -= 10;
      }
    }

    // Check word count
    const words = this.countWords(markdown);
    if (words < this.rules.structure.min_word_count) {
      issues.push({
        type: 'STRUCTURE',
        severity: 'BLOCKING',
        code: 'WORD_COUNT_LOW',
        message: `Content has ${words} words (minimum: ${this.rules.structure.min_word_count})`,
        suggestion: 'Expand the content to meet the minimum word count requirement',
      });
      score -= 25;
    } else if (words > this.rules.structure.max_word_count) {
      issues.push({
        type: 'STRUCTURE',
        severity: 'WARNING',
        code: 'WORD_COUNT_HIGH',
        message: `Content has ${words} words (maximum: ${this.rules.structure.max_word_count})`,
        suggestion: 'Consider condensing the content for better readability',
      });
      score -= 10;
    }

    // Check brief word count range
    if (brief.word_count_min && words < brief.word_count_min) {
      issues.push({
        type: 'STRUCTURE',
        severity: 'WARNING',
        code: 'BELOW_BRIEF_MIN',
        message: `Content has ${words} words (brief minimum: ${brief.word_count_min})`,
      });
      score -= 10;
    }
    if (brief.word_count_max && words > brief.word_count_max) {
      issues.push({
        type: 'STRUCTURE',
        severity: 'WARNING',
        code: 'ABOVE_BRIEF_MAX',
        message: `Content has ${words} words (brief maximum: ${brief.word_count_max})`,
      });
      score -= 10;
    }

    // Check for placeholder text
    if (this.rules.structure.check_placeholder_text) {
      for (const pattern of PLACEHOLDER_PATTERNS) {
        const matches = markdown.match(pattern);
        if (matches && matches.length > 0) {
          issues.push({
            type: 'STRUCTURE',
            severity: 'BLOCKING',
            code: 'PLACEHOLDER_TEXT',
            message: `Found placeholder text: ${matches.slice(0, 3).join(', ')}`,
            suggestion: 'Replace all placeholder text with actual content',
          });
          score -= 20;
          break;
        }
      }
    }

    // Determine status
    let status: QAStatus = 'PASS';
    if (issues.some((i) => i.severity === 'BLOCKING')) {
      status = 'FAIL';
    } else if (issues.some((i) => i.severity === 'WARNING')) {
      status = 'WARN';
    }

    return { status, score: Math.max(0, score), issues };
  }

  /**
   * Layer 2: SEO Validation (Section 16.4)
   */
  private validateSEO(content: GeneratedContent, brief: ContentBrief): QALayerResult {
    const issues: QAIssue[] = [];
    let score = 100;

    const markdown = content.content_markdown.toLowerCase();
    const primaryKeyword = brief.primary_keyword.toLowerCase();

    // Check primary keyword in H1
    if (this.rules.seo.require_primary_keyword_in_h1) {
      const h1Match = content.content_markdown.match(/^#\s+(.+)$/m);
      if (h1Match) {
        const h1Text = h1Match[1].toLowerCase();
        if (!h1Text.includes(primaryKeyword)) {
          issues.push({
            type: 'SEO',
            severity: 'WARNING',
            code: 'KEYWORD_NOT_IN_H1',
            message: `Primary keyword "${brief.primary_keyword}" not found in H1`,
            suggestion: 'Include the primary keyword naturally in the H1 heading',
          });
          score -= 15;
        }
      }
    }

    // Check primary keyword in first paragraph
    if (this.rules.seo.require_primary_keyword_in_first_paragraph) {
      // Get first paragraph (text after H1 before next heading)
      const afterH1 = content.content_markdown.split(/^#\s+.+$/m)[1] || '';
      const firstParagraph = afterH1.split(/^##/m)[0].slice(0, 500).toLowerCase();

      if (!firstParagraph.includes(primaryKeyword)) {
        issues.push({
          type: 'SEO',
          severity: 'WARNING',
          code: 'KEYWORD_NOT_IN_INTRO',
          message: `Primary keyword "${brief.primary_keyword}" not found in opening paragraph`,
          suggestion: 'Include the primary keyword in the first 1-2 paragraphs',
        });
        score -= 10;
      }
    }

    // Check keyword density
    const keywordCount = (markdown.match(new RegExp(primaryKeyword, 'gi')) || []).length;
    const totalWords = this.countWords(markdown);
    const keywordDensity = (keywordCount / totalWords) * 100;

    if (keywordDensity > this.rules.seo.max_keyword_density) {
      issues.push({
        type: 'SEO',
        severity: 'WARNING',
        code: 'KEYWORD_STUFFING',
        message: `Keyword density is ${keywordDensity.toFixed(1)}% (max: ${this.rules.seo.max_keyword_density}%)`,
        suggestion: 'Reduce keyword frequency to avoid over-optimization',
      });
      score -= 15;
    }

    // Check meta title
    if (this.rules.seo.require_meta_title) {
      if (!content.meta_title) {
        issues.push({
          type: 'SEO',
          severity: 'WARNING',
          code: 'MISSING_META_TITLE',
          message: 'Meta title is missing',
          suggestion: 'Add a meta title for better SEO',
        });
        score -= 10;
      } else if (content.meta_title.length > this.rules.seo.meta_title_max_length) {
        issues.push({
          type: 'SEO',
          severity: 'INFO',
          code: 'META_TITLE_TOO_LONG',
          message: `Meta title is ${content.meta_title.length} characters (max: ${this.rules.seo.meta_title_max_length})`,
          suggestion: 'Shorten meta title to prevent truncation in SERPs',
        });
        score -= 5;
      }
    }

    // Check meta description
    if (this.rules.seo.require_meta_description) {
      if (!content.meta_description) {
        issues.push({
          type: 'SEO',
          severity: 'WARNING',
          code: 'MISSING_META_DESC',
          message: 'Meta description is missing',
          suggestion: 'Add a meta description for better CTR',
        });
        score -= 10;
      } else if (content.meta_description.length > this.rules.seo.meta_description_max_length) {
        issues.push({
          type: 'SEO',
          severity: 'INFO',
          code: 'META_DESC_TOO_LONG',
          message: `Meta description is ${content.meta_description.length} characters (max: ${this.rules.seo.meta_description_max_length})`,
          suggestion: 'Shorten meta description to prevent truncation',
        });
        score -= 5;
      }
    }

    // Check internal links (in markdown)
    if (this.rules.seo.require_internal_links) {
      const linkMatches = markdown.match(/\[.+?\]\(.+?\)/g) || [];
      if (linkMatches.length < this.rules.seo.min_internal_links) {
        issues.push({
          type: 'SEO',
          severity: 'WARNING',
          code: 'FEW_INTERNAL_LINKS',
          message: `Found ${linkMatches.length} links (minimum: ${this.rules.seo.min_internal_links})`,
          suggestion: 'Add more internal links to improve site structure',
        });
        score -= 10;
      }
    }

    // Determine status
    let status: QAStatus = 'PASS';
    if (issues.some((i) => i.severity === 'BLOCKING')) {
      status = 'FAIL';
    } else if (issues.some((i) => i.severity === 'WARNING')) {
      status = 'WARN';
    }

    return { status, score: Math.max(0, score), issues };
  }

  /**
   * Layer 3: Intent & Coverage Validation (Section 16.5)
   */
  private validateIntent(content: GeneratedContent, brief: ContentBrief): QALayerResult {
    const issues: QAIssue[] = [];
    let score = 100;

    const markdown = content.content_markdown.toLowerCase();

    // Check search intent alignment
    const intentKeywords: Record<string, string[]> = {
      Informational: ['hướng dẫn', 'cách', 'là gì', 'tại sao', 'như thế nào'],
      Commercial: ['so sánh', 'đánh giá', 'tốt nhất', 'top', 'review'],
      Transactional: ['mua', 'đăng ký', 'đặt hàng', 'giá', 'ưu đãi'],
      Navigational: ['trang chủ', 'liên hệ', 'đăng nhập'],
    };

    // Check for promotional language in non-transactional content
    if (brief.search_intent !== 'Transactional') {
      for (const pattern of PROMOTIONAL_PATTERNS) {
        const matches = markdown.match(pattern);
        if (matches && matches.length > 2) {
          issues.push({
            type: 'INTENT',
            severity: 'WARNING',
            code: 'INTENT_DRIFT',
            message: `Content uses promotional language for ${brief.search_intent} intent`,
            suggestion: 'Reduce promotional language for non-transactional content',
          });
          score -= 15;
          break;
        }
      }
    }

    // Check mandatory sections from brief
    if (this.rules.intent.require_mandatory_sections && brief.recommended_structure) {
      const mandatorySections = brief.recommended_structure.mandatory_sections || [];
      const h2Headings = (content.content_markdown.match(/^##\s+(.+)$/gm) || [])
        .map((h) => h.replace(/^##\s+/, '').toLowerCase());

      let coveredSections = 0;
      for (const section of mandatorySections) {
        const sectionLower = section.toLowerCase();
        // Check if any heading contains the section keyword
        const covered = h2Headings.some(
          (h) => h.includes(sectionLower) || sectionLower.includes(h)
        );
        if (covered) {
          coveredSections++;
        }
      }

      if (mandatorySections.length > 0) {
        const coverage = (coveredSections / mandatorySections.length) * 100;
        if (coverage < this.rules.intent.min_section_coverage) {
          issues.push({
            type: 'INTENT',
            severity: 'WARNING',
            code: 'LOW_SECTION_COVERAGE',
            message: `Only ${coverage.toFixed(0)}% of mandatory sections covered (minimum: ${this.rules.intent.min_section_coverage}%)`,
            suggestion: `Missing sections: ${mandatorySections.slice(coveredSections).join(', ')}`,
          });
          score -= 20;
        }
      }
    }

    // Determine status
    let status: QAStatus = 'PASS';
    if (issues.some((i) => i.severity === 'BLOCKING')) {
      status = 'FAIL';
    } else if (issues.some((i) => i.severity === 'WARNING')) {
      status = 'WARN';
    }

    return { status, score: Math.max(0, score), issues };
  }

  /**
   * Layer 4: Brand & Compliance Validation (Section 16.6)
   */
  private validateBrand(content: GeneratedContent, brief: ContentBrief): QALayerResult {
    const issues: QAIssue[] = [];
    let score = 100;

    const markdown = content.content_markdown.toLowerCase();

    // Check forbidden phrases (banking compliance)
    if (this.rules.brand.check_forbidden_phrases) {
      const allForbidden = [
        ...this.rules.brand.forbidden_phrases,
        ...(brief.seo_constraints?.forbidden_claims || []),
      ];

      for (const phrase of allForbidden) {
        if (markdown.includes(phrase.toLowerCase())) {
          issues.push({
            type: 'BRAND',
            severity: 'BLOCKING',
            code: 'FORBIDDEN_PHRASE',
            message: `Content contains forbidden phrase: "${phrase}"`,
            suggestion: 'Remove or rephrase to comply with brand guidelines',
          });
          score -= 25;
        }
      }
    }

    // Check competitor mentions
    if (this.rules.brand.check_competitor_mentions && this.rules.brand.competitors.length > 0) {
      for (const competitor of this.rules.brand.competitors) {
        if (markdown.includes(competitor.toLowerCase())) {
          issues.push({
            type: 'BRAND',
            severity: 'WARNING',
            code: 'COMPETITOR_MENTION',
            message: `Content mentions competitor: "${competitor}"`,
            suggestion: 'Consider removing direct competitor mentions',
          });
          score -= 10;
        }
      }
    }

    // Check tone compliance (basic check)
    if (this.rules.brand.check_tone_compliance && brief.tone) {
      // Check for casual language in professional tone
      if (brief.tone === 'professional' || brief.tone === 'neutral_expert') {
        const casualPatterns = [/bạn ơi/gi, /ngầu/gi, /cool/gi, /siêu/gi, /quá trời/gi];
        for (const pattern of casualPatterns) {
          if (pattern.test(markdown)) {
            issues.push({
              type: 'BRAND',
              severity: 'INFO',
              code: 'TONE_MISMATCH',
              message: `Casual language detected for "${brief.tone}" tone`,
              suggestion: 'Use more formal language',
            });
            score -= 5;
            break;
          }
        }
      }
    }

    // Determine status
    let status: QAStatus = 'PASS';
    if (issues.some((i) => i.severity === 'BLOCKING')) {
      status = 'FAIL';
    } else if (issues.some((i) => i.severity === 'WARNING')) {
      status = 'WARN';
    }

    return { status, score: Math.max(0, score), issues };
  }

  /**
   * Layer 5: Technical & Rendering Validation (Section 16.7)
   */
  private validateTechnical(content: GeneratedContent, brief: ContentBrief): QALayerResult {
    const issues: QAIssue[] = [];
    let score = 100;

    const markdown = content.content_markdown;

    // Check valid markdown structure
    if (this.rules.technical.require_valid_markdown) {
      // Check for broken links syntax
      const brokenLinks = markdown.match(/\[([^\]]*)\]\s+\(/g);
      if (brokenLinks) {
        issues.push({
          type: 'TECHNICAL',
          severity: 'WARNING',
          code: 'BROKEN_MARKDOWN_LINK',
          message: `Found ${brokenLinks.length} potentially broken markdown links`,
          suggestion: 'Fix link syntax: [text](url) without space between ] and (',
        });
        score -= 10;
      }

      // Check for unclosed formatting
      const unclosedBold = (markdown.match(/\*\*/g) || []).length % 2 !== 0;
      const unclosedItalic = (markdown.match(/(?<!\*)\*(?!\*)/g) || []).length % 2 !== 0;

      if (unclosedBold || unclosedItalic) {
        issues.push({
          type: 'TECHNICAL',
          severity: 'WARNING',
          code: 'UNCLOSED_FORMATTING',
          message: 'Found unclosed bold or italic formatting',
          suggestion: 'Ensure all ** and * markers are properly paired',
        });
        score -= 5;
      }
    }

    // Check SEO-ready signals
    if (this.rules.technical.check_seo_ready_signals) {
      // Title should exist
      if (!content.title || content.title.length < 10) {
        issues.push({
          type: 'TECHNICAL',
          severity: 'WARNING',
          code: 'TITLE_TOO_SHORT',
          message: 'Content title is too short or missing',
          suggestion: 'Provide a descriptive title of at least 10 characters',
        });
        score -= 10;
      }
    }

    // Warn about potential JS dependency (if HTML content exists)
    if (this.rules.technical.warn_on_js_dependency && content.content_html) {
      // Check for dynamic placeholders in HTML
      const dynamicPatterns = [
        /\{\{.+?\}\}/g, // Angular/Vue templates
        /data-react/gi, // React markers
        /<script[^>]*>/gi, // Inline scripts
      ];

      for (const pattern of dynamicPatterns) {
        if (pattern.test(content.content_html)) {
          issues.push({
            type: 'TECHNICAL',
            severity: 'INFO',
            code: 'JS_DEPENDENCY_DETECTED',
            message: 'Content may depend on JavaScript rendering',
            suggestion: 'Ensure SEO-critical content is available without JS',
          });
          score -= 5;
          break;
        }
      }
    }

    // Determine status
    let status: QAStatus = 'PASS';
    if (issues.some((i) => i.severity === 'BLOCKING')) {
      status = 'FAIL';
    } else if (issues.some((i) => i.severity === 'WARNING')) {
      status = 'WARN';
    }

    return { status, score: Math.max(0, score), issues };
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    // Remove markdown syntax
    const cleanText = text
      .replace(/```[\s\S]*?```/g, '') // code blocks
      .replace(/`[^`]+`/g, '') // inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links -> just text
      .replace(/[#*_~`]/g, '') // formatting chars
      .replace(/\n+/g, ' '); // newlines

    return cleanText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  }

  /**
   * Check if content can be exported (all gates pass)
   */
  canExport(qaResult: ContentQAResult): boolean {
    return qaResult.qa_status !== 'FAIL' && qaResult.blocking_issues_count === 0;
  }
}

// Factory function
export function createContentQAValidator(rules?: Partial<QAValidationRules>): ContentQAValidator {
  return new ContentQAValidator(rules);
}

// Singleton with default rules
export const contentQAValidator = new ContentQAValidator();
