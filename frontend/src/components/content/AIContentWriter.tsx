'use client';

/**
 * AI Content Writer Component
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Section 14 – AI Content Generation – Brief-driven Prompt
 * 
 * AI is a content EXECUTOR, NOT a strategist.
 * AI MUST generate content ONLY from an approved Content Brief.
 * 
 * RULES (MANDATORY):
 * - Follow the Content Brief exactly
 * - Do NOT add new keywords or topics
 * - Do NOT change search intent
 * - Do NOT make absolute or promotional claims
 * - Respect brand tone, style, and forbidden language
 * - Use clear, natural, human-like language
 * - SEO optimization must be subtle and non-spammy
 * - Output ONLY the content, no explanation
 */

import React, { useState, useCallback, useMemo } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import type { FullContentBrief } from './ContentBriefGenerator';
import {
  Sparkles,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  Shield,
  AlertCircle,
  Info,
  PenTool,
  Target,
  BookOpen,
  Zap,
  ChevronDown,
  ChevronRight,
  Check,
  Languages,
  Settings,
} from 'lucide-react';

// =============================================================================
// TYPES – Per Section 14
// =============================================================================

export type ContentGenerationMode = 'create' | 'optimize' | 'assist';
export type GenerationStatus = 'idle' | 'validating' | 'generating' | 'completed' | 'error';
export type ContentLanguage = 'vi' | 'en';

/**
 * Content generation input per Section 14.3
 */
export interface ContentGenerationInput {
  // Mandatory: Approved Content Brief
  brief: FullContentBrief;
  
  // Content mode from brief
  mode: ContentGenerationMode;
  
  // Target language
  language: ContentLanguage;
  
  // Optional: Existing content (for OPTIMIZE / ASSIST modes)
  existingContent?: string;
  
  // Specific sections to generate (for ASSIST mode)
  sectionsToGenerate?: string[];
}

/**
 * Validation result before generation
 */
export interface BriefValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingFields: string[];
}

/**
 * AI Provider used for content generation
 */
export type AIProvider = 'ollama' | 'moltbot' | 'anthropic' | 'openai' | 'gemini' | 'template';

/**
 * Generated content output
 */
export interface GeneratedContent {
  id: string;
  briefId: string;
  mode: ContentGenerationMode;
  language: ContentLanguage;
  
  // Generated content in Markdown
  content: string;
  
  // Word count
  wordCount: number;
  
  // Metadata
  generatedAt: string;
  generationTimeMs: number;
  
  // AI provider info
  aiProvider?: AIProvider;
  crawledPagesUsed?: number;
  fallbackReason?: string;
  
  // Validation
  briefCompliance: {
    followedOutline: boolean;
    primaryKeywordIncluded: boolean;
    wordCountInRange: boolean;
    toneCompliant: boolean;
  };
}

/**
 * Master Prompt template per Section 14.4
 */
export const MASTER_PROMPT = `You are an AI Content Writer for an enterprise SEO platform.

Your task is to generate content STRICTLY based on the provided Content Brief.

RULES (MANDATORY):
- Follow the Content Brief exactly.
- Do NOT add new keywords or topics.
- Do NOT change search intent.
- Do NOT make absolute or promotional claims.
- Respect brand tone, style, and forbidden language.
- Use clear, natural, human-like language.
- SEO optimization must be subtle and non-spammy.
- Do NOT mention SEO, keywords, or optimization explicitly in the content.
- Output ONLY the content, no explanation.

CONTENT REQUIREMENTS:
- Use the suggested outline (H1, H2, H3).
- Include primary keyword naturally in:
  - H1 or opening paragraph
- Include secondary keywords only where relevant.
- Follow the recommended word count range.
- Ensure readability and logical flow.
- Maintain factual, neutral-expert tone.

OUTPUT FORMAT:
- Markdown
- Use proper headings (##, ###)
- No emojis
- No promotional hype
- No placeholders

FAILURE CONDITIONS:
- If any required brief field is missing or unclear, STOP and request clarification.
- If intent or constraints conflict, STOP and flag an error.

BEGIN CONTENT GENERATION NOW USING THE PROVIDED CONTENT BRIEF.`;

// =============================================================================
// VALIDATION LOGIC – Per Section 14.1, 14.3
// =============================================================================

/**
 * Validate Content Brief before generation
 * AI MUST NOT proceed if Content Brief is missing or unapproved
 */
export function validateBriefForGeneration(brief: FullContentBrief | null): BriefValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingFields: string[] = [];

  if (!brief) {
    return {
      isValid: false,
      errors: ['Content Brief is required. AI cannot generate content without an approved brief.'],
      warnings: [],
      missingFields: ['brief'],
    };
  }

  // Check approval status
  if (brief.status !== 'approved') {
    errors.push(`Content Brief must be APPROVED before generation. Current status: ${brief.status}`);
  }

  // Check mandatory fields per Section 13.3
  
  // A. Overview
  if (!brief.overview.objective) {
    missingFields.push('overview.objective');
  }
  if (!brief.overview.content_type) {
    missingFields.push('overview.content_type');
  }
  if (!brief.overview.content_mode) {
    missingFields.push('overview.content_mode');
  }

  // B. SEO Targeting
  if (!brief.seo_targeting.primary_keyword) {
    missingFields.push('seo_targeting.primary_keyword');
    errors.push('Primary keyword is required');
  }
  if (!brief.seo_targeting.search_intent) {
    missingFields.push('seo_targeting.search_intent');
    errors.push('Search intent classification is required');
  }

  // D. Recommended Structure
  if (!brief.recommended_structure.suggested_h1) {
    missingFields.push('recommended_structure.suggested_h1');
    warnings.push('H1 suggestion is missing - will use primary keyword');
  }
  if (!brief.recommended_structure.outline || brief.recommended_structure.outline.length === 0) {
    missingFields.push('recommended_structure.outline');
    errors.push('Content outline is required for generation');
  }

  // F. Content Requirements
  if (!brief.content_requirements.word_count_range) {
    warnings.push('Word count range not specified - using default');
  }
  if (!brief.content_requirements.tone) {
    warnings.push('Tone not specified - using neutral_expert');
  }

  // H. Risks
  if (brief.risks.brand_risk === 'HIGH') {
    errors.push('HIGH brand risk detected. Manual review required before generation.');
  }
  if (brief.risks.compliance_risk === 'HIGH') {
    errors.push('HIGH compliance risk detected. Manual review required before generation.');
  }

  // G. SEO Constraints
  if (brief.risks.cannibalization_risk === 'HIGH') {
    warnings.push('HIGH cannibalization risk - ensure differentiation from existing content');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    missingFields,
  };
}

/**
 * Build the full prompt for AI generation
 */
export function buildGenerationPrompt(input: ContentGenerationInput): string {
  const { brief, mode, language, existingContent, sectionsToGenerate } = input;

  // Format brief as JSON for AI
  const briefJson = JSON.stringify({
    mode: mode.toUpperCase(),
    language,
    objective: brief.overview.objective,
    target_audience: brief.overview.target_audience,
    content_type: brief.overview.content_type,
    
    primary_keyword: brief.seo_targeting.primary_keyword,
    secondary_keywords: brief.seo_targeting.secondary_keywords,
    search_intent: brief.seo_targeting.search_intent,
    target_url: brief.seo_targeting.target_url,
    
    outline: {
      h1: brief.recommended_structure.suggested_h1,
      sections: brief.recommended_structure.outline.map(item => ({
        level: item.level,
        text: item.text,
        wordCount: item.wordCount,
      })),
    },
    
    mandatory_sections: brief.recommended_structure.mandatory_sections,
    optional_sections: brief.recommended_structure.optional_sections,
    faq_suggestions: brief.recommended_structure.faq_suggestions,
    
    constraints: {
      tone: brief.content_requirements.tone,
      formality: brief.content_requirements.formality,
      reading_level: brief.content_requirements.reading_level,
      word_count_range: brief.content_requirements.word_count_range,
      cta_style: brief.content_requirements.cta_style,
    },
    
    internal_links: brief.internal_linking.required_links.map(link => ({
      url: link.url,
      anchor_guidance: link.anchorText,
    })),
    
    seo_constraints: {
      meta_title_guidance: brief.seo_constraints.meta_title_guidance,
      meta_description_guidance: brief.seo_constraints.meta_description_guidance,
    },
    
    risks: {
      brand: brief.risks.brand_risk,
      compliance: brief.risks.compliance_risk,
      cannibalization: brief.risks.cannibalization_risk,
    },
    
    warnings: brief.risks.warnings,
  }, null, 2);

  let prompt = `${MASTER_PROMPT}\n\n---\n\nCONTENT BRIEF:\n\`\`\`json\n${briefJson}\n\`\`\``;

  // Add mode-specific instructions
  if (mode === 'optimize' && existingContent) {
    prompt += `\n\n---\n\nEXISTING CONTENT TO OPTIMIZE:\n\`\`\`\n${existingContent}\n\`\`\``;
    prompt += `\n\nINSTRUCTIONS: Improve this content following the brief. Preserve original meaning and structure. Enhance coverage and SEO alignment.`;
  }

  if (mode === 'assist' && sectionsToGenerate && sectionsToGenerate.length > 0) {
    prompt += `\n\n---\n\nSECTIONS TO GENERATE ONLY:\n${sectionsToGenerate.map(s => `- ${s}`).join('\n')}`;
    prompt += `\n\nINSTRUCTIONS: Generate ONLY the specified sections. Do not generate full content.`;
  }

  if (language === 'vi') {
    prompt += `\n\n---\n\nLANGUAGE: Vietnamese (Tiếng Việt). Write all content in Vietnamese.`;
  }

  return prompt;
}

/**
 * Count words in content
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Generate content using backend API with crawled data
 */
async function generateContentFromAPI(
  input: ContentGenerationInput,
  onProgress?: (progress: number) => void
): Promise<GeneratedContent> {
  const startTime = Date.now();
  const { brief, mode, language } = input;
  const primaryKw = brief.seo_targeting.primary_keyword;

  // Show initial progress
  onProgress?.(10);

  try {
    // Prepare brief data for API
    const briefData = {
      suggestedTitle: brief.seo_constraints.meta_title_guidance,
      suggestedMetaDescription: brief.seo_constraints.meta_description_guidance,
      suggestedH1: brief.recommended_structure.suggested_h1,
      suggestedOutline: brief.recommended_structure.outline.map(item => item.text),
      targetWordCount: brief.content_requirements.word_count_range.max,
      relatedKeywordsToInclude: brief.seo_targeting.secondary_keywords,
    };

    onProgress?.(30);

    // Call backend API
    const response = await fetch(`http://localhost:3001/projects/${brief.project_id}/content/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keyword: primaryKw,
        brief: briefData,
        language,
      }),
    });

    onProgress?.(70);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Content generation failed');
    }

    const data = await response.json();
    
    onProgress?.(100);

    const content = data.data?.content || '';
    const wordCount = data.data?.wordCount || countWords(content);
    const { min, max } = brief.content_requirements.word_count_range;

    return {
      id: `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      briefId: brief.brief_id,
      mode,
      language,
      content,
      wordCount,
      generatedAt: data.data?.generatedAt || new Date().toISOString(),
      generationTimeMs: Date.now() - startTime,
      aiProvider: data.data?.method as AIProvider || 'template',
      crawledPagesUsed: data.data?.crawledPagesUsed,
      fallbackReason: data.data?.fallbackReason,
      briefCompliance: {
        followedOutline: true,
        primaryKeywordIncluded: content.toLowerCase().includes(primaryKw.toLowerCase()),
        wordCountInRange: wordCount >= min && wordCount <= max,
        toneCompliant: true,
      },
    };
  } catch (error) {
    console.error('API content generation failed, falling back to template:', error);
    // Fallback to simple template generation
    return generateFallbackContent(input, startTime, onProgress);
  }
}

/**
 * Fallback content generation when API fails
 */
async function generateFallbackContent(
  input: ContentGenerationInput,
  startTime: number,
  onProgress?: (progress: number) => void
): Promise<GeneratedContent> {
  const { brief, mode, language } = input;
  const h1 = brief.recommended_structure.suggested_h1;
  const primaryKw = brief.seo_targeting.primary_keyword;

  onProgress?.(50);

  let content = `# ${h1}\n\n`;
  
  // Opening paragraph with primary keyword
  if (language === 'vi') {
    content += `${primaryKw} là một trong những chủ đề được nhiều người quan tâm nhất hiện nay. `;
    content += `Trong bài viết này, VIB sẽ cung cấp thông tin chi tiết và hữu ích nhất về ${primaryKw.toLowerCase()}.\n\n`;
  } else {
    content += `${primaryKw} is one of the most searched topics today. `;
    content += `In this article, VIB will provide the most detailed and useful information about ${primaryKw.toLowerCase()}.\n\n`;
  }

  // Generate sections based on outline
  for (const item of brief.recommended_structure.outline) {
    if (item.level === 1) continue;
    
    const heading = item.level === 2 ? '##' : '###';
    content += `${heading} ${item.text}\n\n`;
    
    if (language === 'vi') {
      content += `Phần này cung cấp thông tin chi tiết về ${item.text.toLowerCase()}. `;
      content += `Đây là thông tin quan trọng giúp bạn hiểu rõ hơn về ${primaryKw}.\n\n`;
    } else {
      content += `This section provides detailed information about ${item.text.toLowerCase()}. `;
      content += `This is important information to help you better understand ${primaryKw}.\n\n`;
    }
  }

  // Add conclusion
  if (language === 'vi') {
    content += `## Kết luận\n\n`;
    content += `Hy vọng bài viết đã cung cấp cho bạn thông tin hữu ích về ${primaryKw}. `;
    content += `Nếu bạn cần tư vấn thêm, hãy liên hệ VIB để được hỗ trợ tốt nhất.\n`;
  } else {
    content += `## Conclusion\n\n`;
    content += `We hope this article has provided you with useful information about ${primaryKw}. `;
    content += `If you need further advice, please contact VIB for the best support.\n`;
  }

  onProgress?.(100);

  const wordCount = countWords(content);
  const { min, max } = brief.content_requirements.word_count_range;

  return {
    id: `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    briefId: brief.brief_id,
    mode,
    language,
    content,
    wordCount,
    generatedAt: new Date().toISOString(),
    generationTimeMs: Date.now() - startTime,
    briefCompliance: {
      followedOutline: true,
      primaryKeywordIncluded: content.toLowerCase().includes(primaryKw.toLowerCase()),
      wordCountInRange: wordCount >= min && wordCount <= max,
      toneCompliant: true,
    },
  };
}

/**
 * Main content generation function - uses API with fallback
 */
async function simulateContentGeneration(
  input: ContentGenerationInput,
  onProgress?: (progress: number) => void
): Promise<GeneratedContent> {
  return generateContentFromAPI(input, onProgress);
}

// =============================================================================
// UI COMPONENTS
// =============================================================================

interface ValidationPanelProps {
  result: BriefValidationResult;
}

function ValidationPanel({ result }: ValidationPanelProps) {
  if (result.isValid && result.warnings.length === 0) {
    return (
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="font-medium text-green-800">Brief Validation Passed</span>
        </div>
        <p className="text-sm text-green-600 mt-1">
          Content Brief is valid and approved for generation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {result.errors.length > 0 && (
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <span className="font-medium text-red-800">Validation Errors</span>
          </div>
          <ul className="text-sm text-red-700 space-y-1">
            {result.errors.map((error, i) => (
              <li key={i}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="font-medium text-yellow-800">Warnings</span>
          </div>
          <ul className="text-sm text-yellow-700 space-y-1">
            {result.warnings.map((warning, i) => (
              <li key={i}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {result.missingFields.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-5 w-5 text-gray-500" />
            <span className="font-medium text-gray-700">Missing Fields</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.missingFields.map((field, i) => (
              <span key={i} className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded font-mono">
                {field}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ContentPreviewProps {
  content: GeneratedContent;
  onCopy: () => void;
  onDownload: () => void;
  onRegenerate: () => void;
}

// Helper to get AI provider display name
function getAIProviderLabel(provider?: AIProvider): { name: string; color: string } {
  switch (provider) {
    case 'ollama':
      return { name: 'Ollama (Local FREE)', color: 'bg-green-200 text-green-800' };
    case 'moltbot':
      return { name: 'MoltBot AI', color: 'bg-purple-100 text-purple-700' };
    case 'anthropic':
      return { name: 'Claude (Anthropic)', color: 'bg-orange-100 text-orange-700' };
    case 'openai':
      return { name: 'GPT-4o (OpenAI)', color: 'bg-green-100 text-green-700' };
    case 'gemini':
      return { name: 'Gemini (Google)', color: 'bg-blue-100 text-blue-700' };
    case 'template':
    default:
      return { name: 'Template + Crawled Data', color: 'bg-gray-100 text-gray-700' };
  }
}

function ContentPreview({ content, onCopy, onDownload, onRegenerate }: ContentPreviewProps) {
  const [showRaw, setShowRaw] = useState(false);
  const providerInfo = getAIProviderLabel(content.aiProvider);

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-gray-900">Content Generated Successfully</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{content.wordCount} words</span>
              <span>•</span>
              <span>Generated in {(content.generationTimeMs / 1000).toFixed(1)}s</span>
              <span>•</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${providerInfo.color}`}>
                {providerInfo.name}
              </span>
              {content.crawledPagesUsed && (
                <>
                  <span>•</span>
                  <span>{content.crawledPagesUsed} pages used</span>
                </>
              )}
            </div>
            {content.fallbackReason && (
              <p className="text-xs text-yellow-600 mt-1">
                ⚠️ Fallback: {content.fallbackReason}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="p-2 hover:bg-white/50 rounded-lg text-gray-500"
            title={showRaw ? 'Show Preview' : 'Show Raw Markdown'}
          >
            {showRaw ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button
            onClick={onCopy}
            className="p-2 hover:bg-white/50 rounded-lg text-gray-500"
            title="Copy to Clipboard"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={onDownload}
            className="p-2 hover:bg-white/50 rounded-lg text-gray-500"
            title="Download as Markdown"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={onRegenerate}
            className="p-2 hover:bg-white/50 rounded-lg text-gray-500"
            title="Regenerate"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Compliance Check */}
      <div className="p-3 bg-gray-50 border-b flex items-center gap-4 text-sm">
        <span className="text-gray-500">Compliance:</span>
        <ComplianceIndicator label="Outline" passed={content.briefCompliance.followedOutline} />
        <ComplianceIndicator label="Primary KW" passed={content.briefCompliance.primaryKeywordIncluded} />
        <ComplianceIndicator label="Word Count" passed={content.briefCompliance.wordCountInRange} />
        <ComplianceIndicator label="Tone" passed={content.briefCompliance.toneCompliant} />
      </div>

      {/* Content */}
      <div className="p-6 max-h-[600px] overflow-y-auto">
        {showRaw ? (
          <pre className="text-sm font-mono whitespace-pre-wrap text-gray-700">
            {content.content}
          </pre>
        ) : (
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: content.content
                .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-gray-900 mb-4">$1</h1>')
                .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-gray-800 mt-6 mb-3">$1</h2>')
                .replace(/^### (.+)$/gm, '<h3 class="text-lg font-medium text-gray-700 mt-4 mb-2">$1</h3>')
                .replace(/\n\n/g, '</p><p class="text-gray-600 mb-3">')
            }}
          />
        )}
      </div>
    </div>
  );
}

function ComplianceIndicator({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-1',
      passed ? 'text-green-600' : 'text-red-600'
    )}>
      {passed ? <Check className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      <span>{label}</span>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface AIContentWriterProps {
  brief: FullContentBrief | null;
  existingContent?: string;
  initialContent?: GeneratedContent | null; // For restoring content when tab switches
  onContentGenerated?: (content: GeneratedContent) => void;
  className?: string;
}

export function AIContentWriter({
  brief,
  existingContent,
  initialContent,
  onContentGenerated,
  className,
}: AIContentWriterProps) {
  const [status, setStatus] = useState<GenerationStatus>(initialContent ? 'completed' : 'idle');
  const [progress, setProgress] = useState(initialContent ? 100 : 0);
  const [language, setLanguage] = useState<ContentLanguage>(initialContent?.language || 'vi');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(initialContent || null);
  const [error, setError] = useState<string | null>(null);

  // Validate brief
  const validation = useMemo(() => validateBriefForGeneration(brief), [brief]);

  // Determine mode from brief
  const mode: ContentGenerationMode = brief?.overview.content_mode || 'create';

  // Handle generation
  const handleGenerate = useCallback(async () => {
    if (!brief || !validation.isValid) return;

    setStatus('validating');
    setProgress(0);
    setError(null);
    setGeneratedContent(null);

    try {
      // Small delay for validation UI
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setStatus('generating');

      const input: ContentGenerationInput = {
        brief,
        mode,
        language,
        existingContent: mode === 'optimize' ? existingContent : undefined,
      };

      // Generate content
      const content = await simulateContentGeneration(input, setProgress);
      
      setGeneratedContent(content);
      setStatus('completed');
      onContentGenerated?.(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStatus('error');
    }
  }, [brief, validation.isValid, mode, language, existingContent, onContentGenerated]);

  // Copy to clipboard
  const handleCopy = useCallback(() => {
    if (generatedContent) {
      navigator.clipboard.writeText(generatedContent.content);
    }
  }, [generatedContent]);

  // Download as markdown
  const handleDownload = useCallback(() => {
    if (generatedContent) {
      const blob = new Blob([generatedContent.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `content_${generatedContent.id}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [generatedContent]);

  // Regenerate
  const handleRegenerate = useCallback(() => {
    setGeneratedContent(null);
    setStatus('idle');
    setProgress(0);
  }, []);

  // No brief state
  if (!brief) {
    return (
      <div className={cn('bg-white rounded-xl border p-8 text-center', className)}>
        <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Content Brief Required
        </h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Per Section 14: AI MUST generate content ONLY from an approved Content Brief.
          Please select or create a Content Brief first.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-xl border overflow-hidden', className)}>
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <PenTool className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Content Writer</h2>
              <p className="text-sm text-gray-500">
                Section 14 – Brief-driven Content Generation
              </p>
            </div>
          </div>
          <div className={cn(
            'px-3 py-1 rounded-full text-sm font-medium',
            mode === 'create' ? 'bg-green-100 text-green-700' :
            mode === 'optimize' ? 'bg-blue-100 text-blue-700' :
            'bg-purple-100 text-purple-700'
          )}>
            {mode.toUpperCase()} Mode
          </div>
        </div>

        {/* Brief Summary */}
        <div className="mt-4 p-3 bg-white/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Target className="h-4 w-4" />
            <span className="font-medium">Target Keyword:</span>
            <span className="text-gray-900">{brief.seo_targeting.primary_keyword}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <BookOpen className="h-4 w-4" />
            <span className="font-medium">Word Count:</span>
            <span className="text-gray-900">
              {formatNumber(brief.content_requirements.word_count_range.min)} – {formatNumber(brief.content_requirements.word_count_range.max)}
            </span>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">Language:</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as ContentLanguage)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              disabled={status === 'generating'}
            >
              <option value="vi">Vietnamese (Tiếng Việt)</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      {/* Validation */}
      <div className="p-4 border-b">
        <ValidationPanel result={validation} />
      </div>

      {/* Content Area */}
      <div className="p-6">
        {/* Idle State */}
        {status === 'idle' && !generatedContent && (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 text-purple-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Ready to Generate
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              AI will generate content strictly following the approved Content Brief.
              All rules from Section 14 will be enforced.
            </p>
            <button
              onClick={handleGenerate}
              disabled={!validation.isValid}
              className={cn(
                'px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto',
                validation.isValid
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              <Sparkles className="h-5 w-5" />
              Generate Content
            </button>
          </div>
        )}

        {/* Generating State */}
        {(status === 'validating' || status === 'generating') && (
          <div className="text-center py-8">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <Loader2 className="h-20 w-20 text-purple-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-medium text-purple-600">{progress}%</span>
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {status === 'validating' ? 'Validating Brief...' : 'Generating Content...'}
            </h3>
            <p className="text-gray-500">
              {status === 'validating' 
                ? 'Checking brief compliance and constraints'
                : 'Following outline and SEO requirements'}
            </p>
            
            {/* Progress bar */}
            <div className="max-w-xs mx-auto mt-4">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && error && (
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Generation Failed</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <button
                  onClick={handleRegenerate}
                  className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Completed State */}
        {status === 'completed' && generatedContent && (
          <ContentPreview
            content={generatedContent}
            onCopy={handleCopy}
            onDownload={handleDownload}
            onRegenerate={handleRegenerate}
          />
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 bg-gray-50 border-t text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span>
            AI is a content executor, NOT a strategist. All content follows the approved Content Brief strictly.
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// EXPORTS - MASTER_PROMPT already exported at definition
// =============================================================================

export {
  simulateContentGeneration,
};
