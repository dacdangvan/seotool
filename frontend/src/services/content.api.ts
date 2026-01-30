/**
 * Content API Service
 * Sections 0.1, 13, 14, 15, 16, 17
 * 
 * ALL DATA FROM DATABASE (populated by crawl)
 */

import {
  ContentBrief,
  BriefStatus,
  GeneratedContent,
  ContentStatus,
  ContentQAResult,
  CMSConfig,
  CMSExport,
  CrawledContent,
  ApiResponse,
  ValidationResponse,
  ExportResponse,
  SearchIntent,
} from '@/types/content.types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// ============================================================================
// CONTENT BRIEFS (Section 13)
// ============================================================================

export interface GenerateBriefInput {
  project_id: string;
  keyword: string;
  search_volume: number;
  difficulty: number;
  intent: SearchIntent;
  domain: string;
  brand_tone?: string;
  brand_formality?: string;
  forbidden_claims?: string[];
}

/**
 * Generate a new content brief from keyword data
 */
export async function generateContentBrief(input: GenerateBriefInput): Promise<ApiResponse<ContentBrief>> {
  const response = await fetch(`${API_BASE}/api/content/briefs/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return response.json();
}

/**
 * Get content briefs for a project
 */
export async function getContentBriefs(
  projectId: string,
  status?: BriefStatus,
  limit = 50,
  offset = 0
): Promise<ApiResponse<ContentBrief[]>> {
  const params = new URLSearchParams({
    project_id: projectId,
    limit: limit.toString(),
    offset: offset.toString(),
  });
  if (status) params.append('status', status);

  const response = await fetch(`${API_BASE}/api/content/briefs?${params}`);
  return response.json();
}

/**
 * Get content brief by ID
 */
export async function getContentBriefById(id: string): Promise<ApiResponse<ContentBrief>> {
  const response = await fetch(`${API_BASE}/api/content/briefs/${id}`);
  return response.json();
}

/**
 * Update brief status
 */
export async function updateBriefStatus(
  id: string,
  status: BriefStatus,
  approvedBy?: string
): Promise<ApiResponse<ContentBrief>> {
  const response = await fetch(`${API_BASE}/api/content/briefs/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, approved_by: approvedBy }),
  });
  return response.json();
}

// ============================================================================
// GENERATED CONTENT (Section 14)
// ============================================================================

export interface SaveContentInput {
  project_id: string;
  brief_id: string;
  title: string;
  content_markdown: string;
  content_html?: string;
  meta_title?: string;
  meta_description?: string;
  model_used?: string;
  generation_params?: Record<string, any>;
}

/**
 * Save generated content
 */
export async function saveGeneratedContent(input: SaveContentInput): Promise<ApiResponse<GeneratedContent>> {
  const response = await fetch(`${API_BASE}/api/content/generated`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return response.json();
}

/**
 * Get generated content for a project
 */
export async function getGeneratedContent(
  projectId: string,
  status?: ContentStatus,
  limit = 50,
  offset = 0
): Promise<ApiResponse<GeneratedContent[]>> {
  const params = new URLSearchParams({
    project_id: projectId,
    limit: limit.toString(),
    offset: offset.toString(),
  });
  if (status) params.append('status', status);

  const response = await fetch(`${API_BASE}/api/content/generated?${params}`);
  return response.json();
}

/**
 * Get generated content by ID
 */
export async function getGeneratedContentById(id: string): Promise<ApiResponse<GeneratedContent>> {
  const response = await fetch(`${API_BASE}/api/content/generated/${id}`);
  return response.json();
}

/**
 * Update content status
 */
export async function updateContentStatus(
  id: string,
  status: ContentStatus
): Promise<ApiResponse<GeneratedContent>> {
  const response = await fetch(`${API_BASE}/api/content/generated/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return response.json();
}

// ============================================================================
// QA VALIDATION (Section 16)
// ============================================================================

/**
 * Run QA validation on content
 */
export async function validateContent(contentId: string): Promise<ValidationResponse> {
  const response = await fetch(`${API_BASE}/api/content/qa/validate/${contentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return response.json();
}

/**
 * Get QA result for content
 */
export async function getQAResult(contentId: string): Promise<ApiResponse<ContentQAResult>> {
  const response = await fetch(`${API_BASE}/api/content/qa/${contentId}`);
  return response.json();
}

// ============================================================================
// CMS EXPORT (Section 15)
// ============================================================================

/**
 * Export content to CMS
 */
export async function exportToCMS(
  contentId: string,
  cmsConfig: CMSConfig
): Promise<ExportResponse> {
  const response = await fetch(`${API_BASE}/api/content/export/${contentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cms_config: cmsConfig }),
  });
  return response.json();
}

/**
 * Get export history for project
 */
export async function getExportHistory(
  projectId: string,
  limit = 50,
  offset = 0
): Promise<ApiResponse<CMSExport[]>> {
  const params = new URLSearchParams({
    project_id: projectId,
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`${API_BASE}/api/content/exports?${params}`);
  return response.json();
}

// ============================================================================
// CRAWLED CONTENT (Section 17)
// ============================================================================

/**
 * Get crawled content for project
 */
export async function getCrawledContent(
  projectId: string,
  limit = 50,
  offset = 0
): Promise<ApiResponse<CrawledContent[]>> {
  const params = new URLSearchParams({
    project_id: projectId,
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`${API_BASE}/api/content/crawled?${params}`);
  return response.json();
}

/**
 * Get crawled content by URL
 */
export async function getCrawledContentByUrl(
  projectId: string,
  url: string
): Promise<ApiResponse<CrawledContent>> {
  const params = new URLSearchParams({
    project_id: projectId,
    url: url,
  });

  const response = await fetch(`${API_BASE}/api/content/crawled/url?${params}`);
  return response.json();
}

// ============================================================================
// CONTENT WORKFLOW HELPERS
// ============================================================================

/**
 * Full content workflow: Brief -> Content -> QA -> Export
 */
export class ContentWorkflow {
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  /**
   * Step 1: Generate brief from keyword
   */
  async generateBrief(keyword: string, intent: SearchIntent, domain: string) {
    return generateContentBrief({
      project_id: this.projectId,
      keyword,
      search_volume: 1000, // Default, should come from keyword research
      difficulty: 50,
      intent,
      domain,
    });
  }

  /**
   * Step 2: Approve brief
   */
  async approveBrief(briefId: string, approvedBy?: string) {
    return updateBriefStatus(briefId, 'APPROVED', approvedBy);
  }

  /**
   * Step 3: Save generated content
   */
  async saveContent(briefId: string, title: string, markdown: string, metaTitle?: string, metaDescription?: string) {
    return saveGeneratedContent({
      project_id: this.projectId,
      brief_id: briefId,
      title,
      content_markdown: markdown,
      meta_title: metaTitle,
      meta_description: metaDescription,
    });
  }

  /**
   * Step 4: Approve content
   */
  async approveContent(contentId: string) {
    return updateContentStatus(contentId, 'APPROVED');
  }

  /**
   * Step 5: Validate content
   */
  async validateContent(contentId: string) {
    return validateContent(contentId);
  }

  /**
   * Step 6: Export to CMS
   */
  async exportToCMS(contentId: string, cmsConfig: CMSConfig) {
    return exportToCMS(contentId, cmsConfig);
  }

  /**
   * Check if content is ready for export
   */
  async canExport(contentId: string): Promise<boolean> {
    const qaResult = await getQAResult(contentId);
    if (!qaResult.success || !qaResult.data) return false;
    
    return qaResult.data.qa_status !== 'FAIL' && qaResult.data.blocking_issues_count === 0;
  }
}
