/**
 * Prompt Builder
 * 
 * Template-based prompt construction for SEO content generation.
 * Follows EEAT principles and Helpful Content guidelines.
 */

import { SearchIntent, type ContentGenerationTask, type Keyword, type FaqSchema } from './models';

/**
 * System prompts for different generation tasks
 */
export const SYSTEM_PROMPTS = {
  outline: `You are an expert SEO content strategist specializing in creating comprehensive article outlines.
Your outlines follow these principles:
- EEAT (Experience, Expertise, Authoritativeness, Trustworthiness)
- Helpful Content guidelines (user-first, comprehensive, valuable)
- Clear hierarchical structure (H1 → H2 → H3)
- Logical flow and progression
- Each section serves a clear purpose

SEMANTIC SEO REQUIREMENTS:
- H1 must contain the primary keyword naturally
- H2 headings should cover related subtopics (topical coverage)
- Include question-based headings for featured snippet opportunities
- Structure should answer: What, Why, How, When, Who where relevant
- Consider "People Also Ask" type questions as H2/H3 candidates

You MUST respond with valid JSON only. No markdown, no explanations.`,

  article: `You are an expert SEO content writer who creates high-quality, helpful articles.
Your writing follows these principles:
- EEAT: Demonstrate expertise and authority on the topic
- Helpful Content: Prioritize user value over search engine optimization
- Natural keyword integration (no keyword stuffing)
- Clear, scannable structure with proper heading hierarchy
- Actionable insights and practical value
- Neutral, informative tone

CRITICAL ANTI-HALLUCINATION RULES:
- NEVER invent statistics, percentages, or numerical data
- NEVER cite specific studies, research papers, or sources you cannot verify
- NEVER attribute quotes to specific people unless provided in the input
- Use hedging language: "research suggests", "experts recommend", "studies indicate"
- Prefer general truths over specific claims
- If unsure, omit rather than fabricate

Write in Markdown format with proper heading levels.`,

  meta: `You are an SEO metadata specialist who creates compelling, click-worthy meta titles and descriptions.
Your metadata follows these guidelines:
- Meta title: 50-60 characters, includes primary keyword naturally (preferably near the start)
- Meta description: 150-160 characters, includes call-to-action, creates curiosity
- Both should accurately represent the content
- No clickbait or misleading claims

SERP PSYCHOLOGY TACTICS:
- Use power words: "Complete", "Ultimate", "Essential", "Proven"
- Include the current year for freshness (if applicable)
- Add brackets/parentheses for visual distinction: [2024 Guide]
- Meta description should include: benefit + keyword + CTA
- Consider search intent: informational = "Learn", commercial = "Compare", transactional = "Get"

Respond with valid JSON only.`,

  faq: `You are an SEO specialist who creates FAQ schema content for better search visibility.
Your FAQs should:
- Address common user questions about the topic
- Provide concise, accurate answers
- Be relevant to the primary keyword and search intent
- Follow Google's FAQ structured data guidelines
- Avoid promotional language

Respond with valid JSON only.`,
};

/**
 * Generate outline prompt
 */
export function buildOutlinePrompt(task: ContentGenerationTask): string {
  const intentGuidance = getIntentGuidance(task.searchIntent);
  const keywordCluster = task.supportingKeywords.map((k: Keyword) => k.text);

  return `Create a comprehensive SEO article outline for the following topic:

PRIMARY KEYWORD: ${task.primaryKeyword.text}
KEYWORD CLUSTER: ${keywordCluster.join(', ')}
SEARCH INTENT: ${task.searchIntent}
TARGET LANGUAGE: ${task.targetLanguage}

${intentGuidance}

Create an outline with the following JSON structure:
{
  "title": "Article title (H1)",
  "sections": [
    {
      "heading": "Section heading",
      "level": 2,
      "keyPoints": ["Key point to cover", "Another point"],
      "subsections": [
        {
          "heading": "Subsection heading",
          "level": 3,
          "keyPoints": ["Detail to include"]
        }
      ]
    }
  ]
}

REQUIREMENTS:
- Include an introduction section
- Cover all keywords from the cluster naturally
- Include a conclusion or summary section
- Use 4-8 main sections (H2) with relevant subsections (H3)
- Each section should have 2-4 key points to cover
${task.customInstructions ? `\nCUSTOM INSTRUCTIONS:\n${task.customInstructions}` : ''}

Respond with JSON only.`;
}

/**
 * Generate article prompt
 */
export function buildArticlePrompt(
  task: ContentGenerationTask,
  outline: string
): string {
  const intentGuidance = getIntentGuidance(task.searchIntent);
  const keywordCluster = task.supportingKeywords.map((k: Keyword) => k.text);

  return `Write a complete SEO article based on the following:

PRIMARY KEYWORD: ${task.primaryKeyword.text}
KEYWORD CLUSTER: ${keywordCluster.join(', ')}
SEARCH INTENT: ${task.searchIntent}
TARGET LANGUAGE: ${task.targetLanguage}

${intentGuidance}

Write a comprehensive article of appropriate length for the topic.

ARTICLE OUTLINE:
${outline}

WRITING GUIDELINES:
1. Start with the H1 title (# Title)
2. Follow the outline structure precisely
3. Use proper Markdown formatting:
   - # for H1 (title only)
   - ## for H2 (main sections)
   - ### for H3 (subsections)
   - Use bullet points and numbered lists where appropriate
   - Use **bold** for emphasis on key terms
4. Integrate keywords naturally throughout the content
5. Write in a neutral, informative tone
6. Provide actionable insights and practical value
7. Do NOT hallucinate facts, statistics, or citations
8. If mentioning statistics or claims, use hedging language ("studies suggest", "according to research")
9. Include a brief introduction and a conclusion
10. Make the content scannable with short paragraphs

${task.customInstructions ? `\nCUSTOM INSTRUCTIONS:\n${task.customInstructions}` : ''}

Write the complete article in Markdown format:`;
}

/**
 * Generate meta title/description prompt
 */
export function buildMetaPrompt(
  task: ContentGenerationTask,
  articleContent: string
): string {
  // Take first 2000 chars of article for context
  const contentSample = articleContent.slice(0, 2000);

  return `Create SEO meta title and description for the following article:

PRIMARY KEYWORD: ${task.primaryKeyword.text}
SEARCH INTENT: ${task.searchIntent}
TARGET LANGUAGE: ${task.targetLanguage}

ARTICLE CONTENT (excerpt):
${contentSample}

Create compelling metadata that:
- Includes the primary keyword naturally
- Accurately represents the content
- Encourages clicks without being clickbait
- Follows length guidelines:
  - Meta title: 50-60 characters
  - Meta description: 150-160 characters

Respond with this JSON structure:
{
  "metaTitle": "Your meta title here",
  "metaDescription": "Your meta description here"
}`;
}

/**
 * Generate FAQ prompt
 */
export function buildFAQPrompt(
  task: ContentGenerationTask,
  articleContent: string
): string {
  // Take first 3000 chars for context
  const contentSample = articleContent.slice(0, 3000);
  const keywordCluster = task.supportingKeywords.map((k: Keyword) => k.text);

  return `Create FAQ schema questions and answers for the following article:

PRIMARY KEYWORD: ${task.primaryKeyword.text}
KEYWORD CLUSTER: ${keywordCluster.join(', ')}
SEARCH INTENT: ${task.searchIntent}
TARGET LANGUAGE: ${task.targetLanguage}

ARTICLE CONTENT (excerpt):
${contentSample}

Create 3-5 FAQs that:
- Address common user questions about the topic
- Are directly relevant to the primary keyword
- Provide concise, accurate answers (50-200 words each)
- Would be valuable in Google's FAQ rich results
- Match the search intent

Respond with this JSON structure:
{
  "questions": [
    {
      "question": "The question text?",
      "answer": "The comprehensive answer text."
    }
  ]
}`;
}

/**
 * Get intent-specific writing guidance
 */
function getIntentGuidance(intent: SearchIntent): string {
  switch (intent) {
    case SearchIntent.INFORMATIONAL:
      return `INTENT GUIDANCE (Informational):
- Focus on educating the reader
- Provide comprehensive, factual information
- Answer common questions about the topic
- Include definitions and explanations
- Structure for easy learning and understanding`;

    case SearchIntent.COMMERCIAL:
      return `INTENT GUIDANCE (Commercial Investigation):
- Help users make informed decisions
- Compare options, features, and benefits
- Include pros/cons when relevant
- Provide objective analysis
- Address common concerns and considerations`;

    case SearchIntent.TRANSACTIONAL:
      return `INTENT GUIDANCE (Transactional):
- Focus on actionable steps
- Clear calls-to-action where appropriate
- Reduce friction in the decision-making process
- Highlight key benefits and value propositions
- Include practical how-to information`;

    case SearchIntent.NAVIGATIONAL:
      return `INTENT GUIDANCE (Navigational):
- Provide clear, direct information
- Include relevant links and references
- Help users find what they're looking for quickly
- Be concise and to the point`;

    default:
      return `INTENT GUIDANCE:
- Provide valuable, comprehensive content
- Focus on user needs and questions
- Be informative and helpful`;
  }
}

/**
 * Build JSON-LD FAQ Schema with best practices
 */
export function buildFAQSchema(
  questions: Array<{ question: string; answer: string }>
): FaqSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question' as const,
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: q.answer,
      },
    })),
  };
}
