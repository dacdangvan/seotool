/**
 * Entity + Internal Linking Agent - Main Entry Point
 * 
 * CLI interface for running the agent
 */

import { v4 as uuid } from 'uuid';
import { createLogger } from './logger';
import { EntityLinkingAgent } from './agent_runner';
import { EntityLinkingTask, ContentItem } from './models';

const logger = createLogger('entity-linking-agent');

/**
 * Mock content for testing
 */
function createMockContent(): ContentItem[] {
  const baseUrl = 'https://example.com';
  
  return [
    // Pillar content
    {
      id: uuid(),
      url: `${baseUrl}/seo-guide`,
      title: 'Complete SEO Guide for 2024',
      content: `
        <h1>Complete SEO Guide for 2024</h1>
        <p>Search Engine Optimization (SEO) is essential for any website. In this comprehensive guide, 
        we'll cover everything you need to know about SEO in 2024.</p>
        <h2>What is SEO?</h2>
        <p>SEO is the practice of optimizing websites to rank higher in search engine results pages (SERPs).</p>
        <h2>Why SEO Matters</h2>
        <p>SEO helps drive organic traffic to your website, which is crucial for business growth.</p>
        <h2>Types of SEO</h2>
        <p>There are three main types: On-page SEO, Off-page SEO, and Technical SEO.</p>
        <a href="/on-page-seo">Learn about On-page SEO</a>
      `,
      primaryKeyword: 'SEO guide',
      supportingKeywords: ['search engine optimization', 'SEO basics', 'SEO tutorial'],
      author: 'John Smith',
      publishedAt: '2024-01-15T10:00:00Z',
      wordCount: 1500,
    },
    // Supporting content 1
    {
      id: uuid(),
      url: `${baseUrl}/on-page-seo`,
      title: 'On-Page SEO: The Complete Guide',
      content: `
        <h1>On-Page SEO: The Complete Guide</h1>
        <p>On-page SEO refers to the practice of optimizing individual web pages to rank higher.</p>
        <h2>Meta Tags</h2>
        <p>Meta tags are HTML elements that provide information about your page.</p>
        <h2>Content Optimization</h2>
        <p>High-quality content is the foundation of good on-page SEO.</p>
        <a href="/seo-guide">Back to SEO Guide</a>
      `,
      primaryKeyword: 'on-page SEO',
      supportingKeywords: ['meta tags', 'content optimization', 'title tags'],
      author: 'John Smith',
      publishedAt: '2024-01-20T10:00:00Z',
      wordCount: 800,
    },
    // Supporting content 2
    {
      id: uuid(),
      url: `${baseUrl}/technical-seo`,
      title: 'Technical SEO Explained',
      content: `
        <h1>Technical SEO Explained</h1>
        <p>Technical SEO focuses on improving the technical aspects of a website to help search engines crawl and index it.</p>
        <h2>Site Speed</h2>
        <p>Page speed is a critical ranking factor.</p>
        <h2>Mobile Optimization</h2>
        <p>With mobile-first indexing, ensuring your site works well on mobile is essential.</p>
      `,
      primaryKeyword: 'technical SEO',
      supportingKeywords: ['site speed', 'mobile optimization', 'crawlability'],
      author: 'Jane Doe',
      publishedAt: '2024-02-01T10:00:00Z',
      wordCount: 700,
    },
    // Orphan content (no incoming links)
    {
      id: uuid(),
      url: `${baseUrl}/keyword-research`,
      title: 'Keyword Research Guide',
      content: `
        <h1>Keyword Research Guide</h1>
        <p>Keyword research is the foundation of any successful SEO strategy.</p>
        <h2>How to Find Keywords</h2>
        <p>Use tools like Google Keyword Planner to discover relevant keywords.</p>
        <h2>Keyword Difficulty</h2>
        <p>Understanding keyword difficulty helps you prioritize your efforts.</p>
      `,
      primaryKeyword: 'keyword research',
      supportingKeywords: ['keyword tools', 'search volume', 'keyword difficulty'],
      author: 'John Smith',
      publishedAt: '2024-02-15T10:00:00Z',
      wordCount: 600,
    },
    // Related topic (content marketing)
    {
      id: uuid(),
      url: `${baseUrl}/content-marketing`,
      title: 'Content Marketing Strategy',
      content: `
        <h1>Content Marketing Strategy</h1>
        <p>Content marketing and SEO go hand in hand. Great content is essential for ranking.</p>
        <h2>Creating Quality Content</h2>
        <p>Focus on creating valuable, informative content that answers user questions.</p>
        <h2>Content Distribution</h2>
        <p>Publishing is just the first step. You need to distribute your content effectively.</p>
      `,
      primaryKeyword: 'content marketing',
      supportingKeywords: ['content strategy', 'content creation', 'content distribution'],
      author: 'Jane Doe',
      publishedAt: '2024-03-01T10:00:00Z',
      wordCount: 900,
    },
  ];
}

/**
 * Create mock task
 */
function createMockTask(): EntityLinkingTask {
  return {
    id: uuid(),
    planId: uuid(),
    contentItems: createMockContent(),
    siteUrl: 'https://example.com',
    brandName: 'Example SEO Agency',
    config: {
      maxLinksPerPage: 10,
      minRelevanceScore: 0.5,
      includeSchemaGeneration: true,
      topicClusteringEnabled: true,
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Main entry point
 */
async function main() {
  logger.info('Entity + Internal Linking Agent v0.5.0');
  
  const task = createMockTask();
  logger.info({ taskId: task.id, contentCount: task.contentItems.length }, 'Running with mock task');

  const agent = new EntityLinkingAgent(logger);
  const result = await agent.run(task);

  // Print results
  console.log('\n' + '='.repeat(80));
  console.log('ENTITY + INTERNAL LINKING AGENT RESULTS');
  console.log('='.repeat(80));
  console.log(`Status: ${result.status}`);
  console.log(`Processing Time: ${result.processingTimeMs}ms`);
  console.log('');

  // Summary
  console.log('📊 SUMMARY');
  console.log('-'.repeat(40));
  console.log(`Total Entities: ${result.summary.totalEntities}`);
  console.log(`Total Relations: ${result.summary.totalRelations}`);
  console.log(`Topic Clusters: ${result.summary.totalClusters}`);
  console.log('');

  // Content Health
  console.log('🏥 CONTENT HEALTH');
  console.log('-'.repeat(40));
  console.log(`✅ Healthy: ${result.summary.contentHealthBreakdown.healthy}`);
  console.log(`⚠️  Weak: ${result.summary.contentHealthBreakdown.weak}`);
  console.log(`🔴 Orphan: ${result.summary.contentHealthBreakdown.orphan}`);
  console.log(`⚡ Over-optimized: ${result.summary.contentHealthBreakdown.overOptimized}`);
  console.log('');

  // Link Suggestions
  console.log('🔗 LINK SUGGESTIONS');
  console.log('-'.repeat(40));
  console.log(`Total Suggestions: ${result.summary.totalLinkSuggestions}`);
  console.log(`High Priority: ${result.summary.highPrioritySuggestions}`);
  console.log('');

  // Top suggestions
  const topSuggestions = result.linkSuggestions.slice(0, 5);
  if (topSuggestions.length > 0) {
    console.log('Top 5 Link Suggestions:');
    for (const suggestion of topSuggestions) {
      console.log(`  ${suggestion.sourceUrl}`);
      console.log(`    → ${suggestion.targetUrl}`);
      console.log(`    Relevance: ${(suggestion.relevanceScore * 100).toFixed(0)}%`);
      console.log(`    Anchor: "${suggestion.suggestedAnchors[0]?.text || 'N/A'}"`);
      console.log(`    Reason: ${suggestion.reasoning.topicRelevance}`);
      console.log('');
    }
  }

  // Topic Clusters
  if (result.topicClusters.length > 0) {
    console.log('📚 TOPIC CLUSTERS');
    console.log('-'.repeat(40));
    for (const cluster of result.topicClusters) {
      console.log(`  ${cluster.pillarTopic.name}`);
      console.log(`    Subtopics: ${cluster.subtopics.map(s => s.name).join(', ') || 'None'}`);
      console.log(`    Content pieces: ${cluster.relatedContentIds.length}`);
      console.log(`    Coherence: ${(cluster.coherenceScore * 100).toFixed(0)}%`);
      console.log('');
    }
  }

  // Schemas Generated
  console.log('📋 SCHEMAS GENERATED');
  console.log('-'.repeat(40));
  console.log(`Total: ${result.summary.schemasGenerated}`);
  for (const schema of result.schemas.slice(0, 5)) {
    console.log(`  ${schema.schemaType}: ${schema.url} ${schema.isValid ? '✅' : '❌'}`);
  }
  console.log('');

  // Issues found
  const allIssues = result.contentAnalysis.flatMap(a => a.issues);
  if (allIssues.length > 0) {
    console.log('⚠️ ISSUES FOUND');
    console.log('-'.repeat(40));
    for (const content of result.contentAnalysis) {
      if (content.issues.length > 0) {
        console.log(`  ${content.url}:`);
        for (const issue of content.issues) {
          console.log(`    [${issue.severity.toUpperCase()}] ${issue.description}`);
        }
        console.log('');
      }
    }
  }

  console.log('='.repeat(80));

  if (result.error) {
    console.error('Error:', result.error);
    process.exit(1);
  }
}

main().catch(error => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
