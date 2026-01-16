/**
 * Content Generator
 * 
 * Main orchestration service for SEO content generation.
 * Coordinates outline → article → meta → FAQ generation.
 */

import { v4 as uuidv4 } from 'uuid';
import type { LLMAdapter } from './adapters/llm_adapter';
import {
  ContentStatus,
  type ContentGenerationTask,
  type ContentGenerationResult,
  type GeneratedContent,
  type ArticleOutline,
  type ArticleSection,
  type FaqSchema,
  type SeoMetadata,
} from './models';
import {
  SYSTEM_PROMPTS,
  buildOutlinePrompt,
  buildArticlePrompt,
  buildMetaPrompt,
  buildFAQPrompt,
  buildFAQSchema,
} from './prompt_builder';
import { Logger } from './logger';

const logger = new Logger('content-generator');

interface RawOutlineSection {
  heading: string;
  keyPoints?: string[];
  subsections?: Array<{ heading: string; keyPoints?: string[] }>;
}

interface RawOutline {
  title: string;
  sections: RawOutlineSection[];
}

interface RawMeta {
  metaTitle: string;
  metaDescription: string;
}

interface RawFAQ {
  questions: Array<{ question: string; answer: string }>;
}

/**
 * Content quality thresholds for SEO safety
 */
const QUALITY_THRESHOLDS = {
  minWordCount: 300,          // Google thin content threshold
  maxWordCount: 10000,        // Reasonable upper limit
  minHeadingCount: 3,         // At least H1 + 2 H2s
  minParagraphLength: 40,     // Avoid single-sentence paragraphs
  maxConsecutiveKeywords: 2,  // Prevent keyword stuffing in proximity
};

export class ContentGenerator {
  private llm: LLMAdapter;

  constructor(llmAdapter: LLMAdapter) {
    this.llm = llmAdapter;
  }

  /**
   * Generate complete SEO content from task
   */
  async generate(task: ContentGenerationTask): Promise<ContentGenerationResult> {
    const startTime = Date.now();

    logger.info('Starting content generation', {
      taskId: task.id,
      primaryKeyword: task.primaryKeyword.text,
      searchIntent: task.searchIntent,
    });

    try {
      // Step 1: Generate outline
      logger.debug('Generating outline', { taskId: task.id });
      const outline = await this.generateOutline(task);

      // Step 2: Generate article from outline
      logger.debug('Generating article', { taskId: task.id });
      const markdownContent = await this.generateArticle(task, outline);

      // Step 3: Generate meta title/description
      logger.debug('Generating meta', { taskId: task.id });
      const seoMetadata = await this.generateMeta(task, markdownContent);

      // Step 4: Generate FAQ schema
      logger.debug('Generating FAQ', { taskId: task.id });
      const faqSchema = await this.generateFAQ(task, markdownContent);

      // Calculate word count
      const wordCount = this.countWords(markdownContent);

      // Validate keyword density
      const densityValidation = this.validateKeywordDensity(markdownContent, task.primaryKeyword.text);
      if (!densityValidation.isSafe) {
        logger.warn('Keyword density warning', {
          taskId: task.id,
          warning: densityValidation.warning,
        });
      }

      const processingTime = Date.now() - startTime;

      const content: GeneratedContent = {
        outline,
        markdownContent,
        wordCount,
        seoMetadata,
        faqSchema,
      };

      const result: ContentGenerationResult = {
        taskId: task.id,
        status: ContentStatus.COMPLETED,
        content,
        processingTimeMs: processingTime,
        metadata: {
          primaryKeyword: task.primaryKeyword.text,
          targetLanguage: task.targetLanguage,
          contentType: task.contentType,
          generatedAt: new Date().toISOString(),
        },
      };

      logger.info('Content generation complete', {
        taskId: task.id,
        wordCount,
        processingTimeMs: processingTime,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Content generation failed', {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        taskId: task.id,
        status: ContentStatus.FAILED,
        content: null,
        processingTimeMs: processingTime,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          primaryKeyword: task.primaryKeyword.text,
          targetLanguage: task.targetLanguage,
          contentType: task.contentType,
          generatedAt: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Generate article outline
   */
  private async generateOutline(task: ContentGenerationTask): Promise<ArticleOutline> {
    const prompt = buildOutlinePrompt(task);

    const rawOutline = await this.llm.completeJSON<RawOutline>(
      prompt,
      SYSTEM_PROMPTS.outline
    );

    // Transform to ArticleOutline format
    return {
      h1: rawOutline.title,
      sections: this.transformSections(rawOutline.sections),
    };
  }

  /**
   * Transform raw outline sections to ArticleSection format
   */
  private transformSections(rawSections: RawOutlineSection[]): ArticleSection[] {
    return rawSections.map((section) => ({
      h2: section.heading,
      subsections: section.subsections
        ? section.subsections.map((sub) => sub.heading)
        : [],
      keyPoints: section.keyPoints,
    }));
  }

  /**
   * Generate article content from outline
   */
  private async generateArticle(
    task: ContentGenerationTask,
    outline: ArticleOutline
  ): Promise<string> {
    // Convert outline to readable format for prompt
    const outlineText = this.outlineToText(outline);
    const prompt = buildArticlePrompt(task, outlineText);

    const article = await this.llm.completeText(
      prompt,
      SYSTEM_PROMPTS.article,
      {
        maxTokens: 4000, // Allow for longer content
        temperature: 0.7,
      }
    );

    return article.trim();
  }

  /**
   * Convert outline to readable text format
   */
  private outlineToText(outline: ArticleOutline): string {
    let text = `# ${outline.h1}\n\n`;

    for (const section of outline.sections) {
      text += `## ${section.h2}\n`;
      if (section.keyPoints) {
        text += `Key points: ${section.keyPoints.join(', ')}\n`;
      }
      for (const subsection of section.subsections) {
        text += `### ${subsection}\n`;
      }
      text += '\n';
    }

    return text;
  }

  /**
   * Generate meta title and description
   */
  private async generateMeta(
    task: ContentGenerationTask,
    articleContent: string
  ): Promise<SeoMetadata> {
    const prompt = buildMetaPrompt(task, articleContent);

    const meta = await this.llm.completeJSON<RawMeta>(
      prompt,
      SYSTEM_PROMPTS.meta
    );

    // Validate and truncate if needed
    return {
      metaTitle: this.truncate(meta.metaTitle, 60),
      metaDescription: this.truncate(meta.metaDescription, 160),
    };
  }

  /**
   * Generate FAQ schema
   */
  private async generateFAQ(
    task: ContentGenerationTask,
    articleContent: string
  ): Promise<FaqSchema> {
    const prompt = buildFAQPrompt(task, articleContent);

    const rawFaq = await this.llm.completeJSON<RawFAQ>(
      prompt,
      SYSTEM_PROMPTS.faq
    );

    // Build JSON-LD schema
    return buildFAQSchema(rawFaq.questions);
  }

  /**
   * Count words in content
   */
  private countWords(content: string): number {
    return content.split(/\s+/).filter((w) => w.length > 0).length;
  }

  /**
   * Calculate keyword density and validate SEO safety
   * Safe range: 0.5% - 2.5% for primary keyword
   */
  private validateKeywordDensity(
    content: string,
    primaryKeyword: string
  ): { density: number; isSafe: boolean; warning?: string } {
    const words = content.toLowerCase().split(/\s+/);
    const totalWords = words.length;
    const keywordLower = primaryKeyword.toLowerCase();
    
    // Count exact and partial matches
    const keywordWords = keywordLower.split(/\s+/);
    let matches = 0;
    
    for (let i = 0; i <= words.length - keywordWords.length; i++) {
      const slice = words.slice(i, i + keywordWords.length).join(' ');
      if (slice === keywordLower) {
        matches++;
      }
    }
    
    const density = (matches * keywordWords.length / totalWords) * 100;
    
    if (density < 0.3) {
      return { density, isSafe: false, warning: 'Under-optimized: keyword density below 0.3%' };
    }
    if (density > 3.0) {
      return { density, isSafe: false, warning: 'Over-optimized: keyword stuffing risk (>3%)' };
    }
    
    return { density, isSafe: true };
  }

  /**
   * Truncate string to max length (smart truncation at word boundary)
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    
    // Find last space before maxLength to avoid cutting words
    const truncated = text.slice(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.7) {
      return truncated.slice(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Calculate basic readability score (Flesch-Kincaid approximation)
   * Target: 60-70 for general audience
   */
  private calculateReadabilityScore(content: string): number {
    // Remove markdown formatting
    const cleanContent = content
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    const sentences = cleanContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = cleanContent.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((acc, word) => acc + this.countSyllables(word), 0);
    
    if (sentences.length === 0 || words.length === 0) return 0;
    
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    
    // Flesch Reading Ease formula
    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Approximate syllable count for a word
   */
  private countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;
    
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }
}

/**
 * Create content generator with LLM adapter
 */
export function createContentGenerator(llmAdapter: LLMAdapter): ContentGenerator {
  return new ContentGenerator(llmAdapter);
}
