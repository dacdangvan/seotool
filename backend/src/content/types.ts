/**
 * Content Management Types
 * Sections 0.1, 13, 14, 15, 16, 17 of AI_SEO_TOOL_PROMPT_BOOK.md
 * Version: 3.0 - Crawl-Centric Data Architecture
 */

// ============================================================================
// SECTION 17: FULL PAGE CONTENT CAPTURE & NORMALIZATION
// ============================================================================

export interface NormalizedHeading {
  level: number; // 1-6
  text: string;
  id?: string;
}

export interface NormalizedSection {
  section_id: string;
  heading: string;
  heading_level: number;
  text: string;
  word_count: number;
}

export interface NormalizedImage {
  src: string;
  alt: string;
  title?: string;
  surrounding_context?: string;
  width?: number;
  height?: number;
}

export interface NormalizedLink {
  url: string;
  anchor_text: string;
  rel?: string;
  section_context?: string;
  is_nofollow: boolean;
}

export interface NormalizedContent {
  url: string;
  language: string;
  render_mode: 'html_only' | 'js_rendered';
  content: {
    title: string;
    headings: NormalizedHeading[];
    sections: NormalizedSection[];
    paragraphs: string[];
    lists: string[][];
    tables: string[][][]; // rows of cells
  };
  media: {
    images: NormalizedImage[];
    embedded_media: Array<{
      type: string;
      src: string;
      title?: string;
    }>;
  };
  links: {
    internal: NormalizedLink[];
    external: NormalizedLink[];
  };
  structured_data: {
    json_ld: object[];
    schema_types: string[];
  };
  metrics: {
    word_count: number;
    reading_time_minutes: number;
  };
}

export interface CrawledContent {
  id: string;
  project_id: string;
  crawl_job_id: string;
  url: string;
  render_mode: 'html_only' | 'js_rendered';
  language?: string;
  raw_rendered_html?: string;
  normalized_content: NormalizedContent;
  crawled_at: Date;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// SECTION 13: CONTENT BRIEF
// ============================================================================

export type ContentMode = 'CREATE' | 'OPTIMIZE' | 'ASSIST';
export type BriefStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export type SearchIntent = 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RecommendedStructure {
  suggested_h1: string;
  h2_outline: string[];
  h3_outline?: Record<string, string[]>; // h2 -> h3s
  mandatory_sections: string[];
  optional_sections?: string[];
  faq_suggestions?: string[];
}

export interface InternalLinkPlan {
  url: string;
  anchor_guidance: string;
  context?: string;
  is_required: boolean;
}

export interface SEOConstraints {
  meta_title_guidance: string;
  meta_description_guidance: string;
  structured_data_requirements?: string[];
  forbidden_claims?: string[];
}

export interface ContentRisks {
  cannibalization: RiskLevel;
  brand: RiskLevel;
  compliance: RiskLevel;
  technical: RiskLevel;
}

export interface SuccessMetrics {
  primary_kpi: string;
  secondary_kpis: string[];
  expected_time_to_impact?: string;
}

export interface ContentBrief {
  id: string;
  project_id: string;
  
  // Content mode
  content_mode: ContentMode;
  status: BriefStatus;
  
  // Overview
  objective: string;
  target_audience?: string;
  content_type: string; // article, landing_page, product_page, faq
  
  // SEO Targeting
  primary_keyword: string;
  secondary_keywords: string[];
  related_entities: string[];
  search_intent: SearchIntent;
  target_url?: string;
  
  // Competitive Context
  cannibalization_risk: RiskLevel;
  differentiation_angle?: string;
  
  // Recommended Structure
  recommended_structure: RecommendedStructure;
  
  // Internal Linking Plan
  internal_links_plan: InternalLinkPlan[];
  
  // Content Requirements
  word_count_min: number;
  word_count_max: number;
  reading_level?: string;
  tone: string;
  formality: string;
  cta_style: string;
  
  // SEO Constraints
  seo_constraints: SEOConstraints;
  
  // Risks
  risks: ContentRisks;
  
  // Success Metrics
  success_metrics: SuccessMetrics;
  
  // Approval
  approved_by?: string;
  approved_at?: Date;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// Input for creating a brief
export interface CreateContentBriefInput {
  project_id: string;
  content_mode: ContentMode;
  objective: string;
  target_audience?: string;
  content_type: string;
  primary_keyword: string;
  secondary_keywords?: string[];
  related_entities?: string[];
  search_intent: SearchIntent;
  target_url?: string;
  word_count_min?: number;
  word_count_max?: number;
  tone?: string;
  formality?: string;
  cta_style?: string;
}

// ============================================================================
// SECTION 14: GENERATED CONTENT
// ============================================================================

export type ContentStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';

export interface GeneratedContent {
  id: string;
  project_id: string;
  brief_id: string;
  
  // Content
  title: string;
  content_markdown: string;
  content_html?: string;
  
  // SEO metadata
  meta_title?: string;
  meta_description?: string;
  
  // Status
  status: ContentStatus;
  version: number;
  
  // Generation metadata
  generated_by: 'ai' | 'human' | 'hybrid';
  model_used?: string;
  generation_params?: Record<string, any>;
  
  // Metrics
  word_count: number;
  reading_time_minutes: number;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

export interface GenerateContentInput {
  brief_id: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

// ============================================================================
// SECTION 16: CONTENT QA & VALIDATION
// ============================================================================

export type QAStatus = 'PENDING' | 'PASS' | 'WARN' | 'FAIL';
export type IssueSeverity = 'BLOCKING' | 'WARNING' | 'INFO';

export interface QAIssue {
  type: 'STRUCTURE' | 'SEO' | 'INTENT' | 'BRAND' | 'TECHNICAL';
  severity: IssueSeverity;
  code: string;
  message: string;
  location?: {
    line?: number;
    column?: number;
    section?: string;
    element?: string;
  };
  suggestion?: string;
}

export interface QALayerResult {
  status: QAStatus;
  score: number; // 0-100
  issues: QAIssue[];
}

export interface ContentQAResult {
  id: string;
  project_id: string;
  content_id: string;
  brief_id: string;
  
  // Overall
  qa_status: QAStatus;
  overall_score: number;
  
  // 5 Layers (Section 16.2)
  structure: QALayerResult;
  seo: QALayerResult;
  intent: QALayerResult;
  brand: QALayerResult;
  technical: QALayerResult;
  
  // Combined
  all_issues: QAIssue[];
  blocking_issues_count: number;
  warning_issues_count: number;
  info_issues_count: number;
  
  // Timestamps
  validated_at: Date;
  created_at: Date;
}

// QA Validation Rules Configuration
export interface QAValidationRules {
  structure: {
    require_single_h1: boolean;
    max_heading_skip: number; // e.g., h1 -> h3 is skip of 1
    min_word_count: number;
    max_word_count: number;
    check_placeholder_text: boolean;
  };
  seo: {
    require_primary_keyword_in_h1: boolean;
    require_primary_keyword_in_first_paragraph: boolean;
    max_keyword_density: number;
    require_meta_title: boolean;
    require_meta_description: boolean;
    meta_title_max_length: number;
    meta_description_max_length: number;
    require_internal_links: boolean;
    min_internal_links: number;
  };
  intent: {
    allow_intent_drift: boolean;
    require_mandatory_sections: boolean;
    min_section_coverage: number; // percentage
  };
  brand: {
    check_tone_compliance: boolean;
    check_forbidden_phrases: boolean;
    forbidden_phrases: string[];
    check_competitor_mentions: boolean;
    competitors: string[];
  };
  technical: {
    check_seo_ready_signals: boolean;
    warn_on_js_dependency: boolean;
    require_valid_markdown: boolean;
  };
}

// ============================================================================
// SECTION 15: CMS EXPORT
// ============================================================================

export type CMSType = 'wordpress' | 'strapi' | 'contentful' | 'sanity' | 'custom';
export type ExportStatus = 'PENDING' | 'VALIDATING' | 'EXPORTING' | 'SUCCESS' | 'FAILED' | 'BLOCKED';

export interface CMSConfig {
  cms_type: CMSType;
  api_url: string;
  api_key?: string;
  auth_token?: string;
  custom_headers?: Record<string, string>;
  content_type_id?: string; // for Contentful/Strapi
  post_type?: string; // for WordPress
}

export interface ExportPackage {
  // Metadata
  export_id: string;
  exported_at: string;
  version: string;
  
  // Brief context
  brief: {
    brief_id: string;
    primary_keyword: string;
    secondary_keywords: string[];
    search_intent: SearchIntent;
    content_type: string;
    target_url: string;
  };
  
  // Content
  content: {
    title: string;
    body_markdown: string;
    body_html: string;
    word_count: number;
  };
  
  // SEO
  seo: {
    meta_title: string;
    meta_description: string;
    focus_keyword: string;
    canonical_url?: string;
    robots?: string;
  };
  
  // Structure
  structure: {
    headings: Array<{ level: number; text: string }>;
    internal_links: Array<{ url: string; anchor: string }>;
    images: Array<{ src: string; alt: string }>;
  };
  
  // Schema
  schema?: {
    type: string;
    json_ld: object;
  };
  
  // QA Summary
  qa_summary: {
    qa_status: QAStatus;
    overall_score: number;
    issues_count: {
      blocking: number;
      warning: number;
      info: number;
    };
  };
  
  // Traceability
  traceability: {
    project_id: string;
    content_id: string;
    brief_id: string;
    qa_result_id: string;
    crawl_job_id?: string;
  };
}

export interface CMSExport {
  id: string;
  project_id: string;
  content_id: string;
  brief_id: string;
  qa_result_id: string;
  
  // Config
  cms_type: CMSType;
  cms_config: CMSConfig;
  
  // Status
  status: ExportStatus;
  
  // Package
  export_package: ExportPackage;
  
  // CMS Response
  cms_response?: Record<string, any>;
  cms_content_id?: string;
  cms_url?: string;
  
  // Error handling
  error_message?: string;
  retry_count: number;
  
  // Timestamps
  exported_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ExportContentInput {
  content_id: string;
  cms_config: CMSConfig;
}

// ============================================================================
// EXPORT GATE CONDITIONS (Section 15.2)
// ============================================================================

export interface ExportGateCheck {
  gate: 'BRIEF_APPROVED' | 'CONTENT_APPROVED' | 'QA_PASSED';
  status: 'PASS' | 'FAIL';
  message: string;
  details?: Record<string, any>;
}

export interface ExportGateResult {
  can_export: boolean;
  checks: ExportGateCheck[];
  blocking_gates: string[];
}
