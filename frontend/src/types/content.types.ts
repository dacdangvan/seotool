/**
 * Content Types for Frontend
 * Sections 0.1, 13, 14, 15, 16, 17
 */

// ============================================================================
// CONTENT BRIEF (Section 13)
// ============================================================================

export type ContentMode = 'CREATE' | 'OPTIMIZE' | 'ASSIST';
export type BriefStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export type SearchIntent = 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RecommendedStructure {
  suggested_h1: string;
  h2_outline: string[];
  h3_outline?: Record<string, string[]>;
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
  content_mode: ContentMode;
  status: BriefStatus;
  objective: string;
  target_audience?: string;
  content_type: string;
  primary_keyword: string;
  secondary_keywords: string[];
  related_entities: string[];
  search_intent: SearchIntent;
  target_url?: string;
  cannibalization_risk: RiskLevel;
  differentiation_angle?: string;
  recommended_structure: RecommendedStructure;
  internal_links_plan: InternalLinkPlan[];
  word_count_min: number;
  word_count_max: number;
  reading_level?: string;
  tone: string;
  formality: string;
  cta_style: string;
  seo_constraints: SEOConstraints;
  risks: ContentRisks;
  success_metrics: SuccessMetrics;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// GENERATED CONTENT (Section 14)
// ============================================================================

export type ContentStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';

export interface GeneratedContent {
  id: string;
  project_id: string;
  brief_id: string;
  title: string;
  content_markdown: string;
  content_html?: string;
  meta_title?: string;
  meta_description?: string;
  status: ContentStatus;
  version: number;
  generated_by: 'ai' | 'human' | 'hybrid';
  model_used?: string;
  generation_params?: Record<string, any>;
  word_count: number;
  reading_time_minutes: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// QA RESULT (Section 16)
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
  score: number;
  issues: QAIssue[];
}

export interface ContentQAResult {
  id: string;
  project_id: string;
  content_id: string;
  brief_id: string;
  qa_status: QAStatus;
  overall_score: number;
  structure: QALayerResult;
  seo: QALayerResult;
  intent: QALayerResult;
  brand: QALayerResult;
  technical: QALayerResult;
  all_issues: QAIssue[];
  blocking_issues_count: number;
  warning_issues_count: number;
  info_issues_count: number;
  validated_at: string;
  created_at: string;
}

// ============================================================================
// CMS EXPORT (Section 15)
// ============================================================================

export type CMSType = 'wordpress' | 'strapi' | 'contentful' | 'sanity' | 'custom';
export type ExportStatus = 'PENDING' | 'VALIDATING' | 'EXPORTING' | 'SUCCESS' | 'FAILED' | 'BLOCKED';

export interface CMSConfig {
  cms_type: CMSType;
  api_url: string;
  api_key?: string;
  auth_token?: string;
  custom_headers?: Record<string, string>;
  content_type_id?: string;
  post_type?: string;
}

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

export interface CMSExport {
  id: string;
  project_id: string;
  content_id: string;
  brief_id: string;
  qa_result_id: string;
  cms_type: CMSType;
  status: ExportStatus;
  cms_content_id?: string;
  cms_url?: string;
  error_message?: string;
  exported_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CRAWLED CONTENT (Section 17)
// ============================================================================

export interface NormalizedHeading {
  level: number;
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
    tables: string[][][];
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
  normalized_content: NormalizedContent;
  crawled_at: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ValidationResponse extends ApiResponse<ContentQAResult> {
  can_export?: boolean;
}

export interface ExportResponse extends ApiResponse<{
  cms_content_id?: string;
  cms_url?: string;
  export_status?: ExportStatus;
}> {
  gates?: ExportGateResult;
}
