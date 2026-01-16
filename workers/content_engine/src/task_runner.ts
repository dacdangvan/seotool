/**
 * Task Runner
 * 
 * CLI tool for testing content generation locally.
 */

import { createLLMAdapter } from './adapters';
import { ContentGenerator } from './content_generator';
import { SearchIntent, ContentType, type ContentGenerationTask } from './models';
import { Logger } from './logger';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger('task-runner');

// Sample task for testing
const sampleTask: ContentGenerationTask = {
  id: uuidv4(),
  planId: uuidv4(),
  primaryKeyword: {
    text: 'best credit cards 2024',
    searchVolume: 50000,
    intent: SearchIntent.COMMERCIAL,
    intentConfidence: 0.92,
  },
  supportingKeywords: [
    { text: 'credit card comparison', searchVolume: 12000 },
    { text: 'rewards credit cards', searchVolume: 8500 },
    { text: 'cash back credit cards', searchVolume: 15000 },
    { text: 'travel credit cards', searchVolume: 11000 },
    { text: 'credit card benefits', searchVolume: 6000 },
  ],
  searchIntent: SearchIntent.COMMERCIAL,
  targetLanguage: 'en-US',
  contentType: ContentType.ARTICLE,
  brandName: 'FinanceGuide',
  customInstructions: 'Focus on beginner-friendly explanations. Include a comparison table format in the content.',
};

async function runTask(): Promise<void> {
  console.log('\n=== Content Engine Task Runner ===\n');
  
  // Parse CLI args
  const args = process.argv.slice(2);
  const useMock = args.includes('--mock') || args.includes('-m');
  const provider = useMock ? 'mock' : (args.includes('--anthropic') ? 'anthropic' : 'openai');
  
  logger.info('Starting task runner', {
    provider,
    taskId: sampleTask.id,
    primaryKeyword: sampleTask.primaryKeyword.text,
  });

  try {
    // Create LLM adapter
    const llmAdapter = createLLMAdapter(provider);
    const generator = new ContentGenerator(llmAdapter);

    console.log(`📝 Generating content for: "${sampleTask.primaryKeyword.text}"`);
    console.log(`🔧 Using provider: ${provider}`);
    console.log(`🌐 Target language: ${sampleTask.targetLanguage}`);
    console.log(`📊 Search intent: ${sampleTask.searchIntent}`);
    console.log('\n--- Generation in progress... ---\n');

    const startTime = Date.now();
    const result = await generator.generate(sampleTask);
    const duration = (Date.now() - startTime) / 1000;

    if (result.status === 'completed' && result.content) {
      console.log('✅ Content generated successfully!\n');
      console.log(`⏱️  Processing time: ${duration.toFixed(2)}s`);
      console.log(`📏 Word count: ${result.content.wordCount}`);
      console.log('\n--- OUTLINE ---\n');
      console.log(`# ${result.content.outline.h1}`);
      for (const section of result.content.outline.sections) {
        console.log(`  ## ${section.h2}`);
        for (const sub of section.subsections) {
          console.log(`    ### ${sub}`);
        }
      }

      console.log('\n--- META ---\n');
      console.log(`Title: ${result.content.seoMetadata.metaTitle}`);
      console.log(`Description: ${result.content.seoMetadata.metaDescription}`);

      console.log('\n--- FAQ QUESTIONS ---\n');
      for (const entity of result.content.faqSchema.mainEntity) {
        console.log(`Q: ${entity.name}`);
        console.log(`A: ${entity.acceptedAnswer.text.slice(0, 100)}...`);
        console.log('');
      }

      console.log('\n--- ARTICLE PREVIEW (first 1000 chars) ---\n');
      console.log(result.content.markdownContent.slice(0, 1000));
      console.log('\n... [truncated]');

      // Save full output to file
      const outputFile = `output_${sampleTask.id}.json`;
      const fs = await import('fs/promises');
      await fs.writeFile(outputFile, JSON.stringify(result, null, 2));
      console.log(`\n💾 Full output saved to: ${outputFile}`);
    } else {
      console.log('❌ Content generation failed');
      console.log(`Error: ${result.error}`);
    }
  } catch (error) {
    logger.error('Task runner failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Help message
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Content Engine Task Runner

Usage: npm run task:run [options]

Options:
  --mock, -m      Use mock LLM adapter (no API calls)
  --anthropic     Use Anthropic Claude instead of OpenAI
  --help, -h      Show this help message

Environment variables:
  OPENAI_API_KEY      OpenAI API key (required for OpenAI provider)
  ANTHROPIC_API_KEY   Anthropic API key (required for Anthropic provider)

Examples:
  npm run task:run --mock      # Test with mock responses
  npm run task:run             # Generate with OpenAI
  npm run task:run --anthropic # Generate with Anthropic
`);
  process.exit(0);
}

runTask();
