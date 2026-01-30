#!/usr/bin/env npx ts-node

/**
 * CLI tool to run recommendation generator job manually
 * 
 * Usage:
 *   npx ts-node src/scripts/run-recommendation-job.ts
 *   npx ts-node src/scripts/run-recommendation-job.ts --project <project-id>
 */

import { getPool } from '../infrastructure/database/connection';
import { createRecommendationGeneratorJob, GenerationResult } from '../jobs';

async function main() {
  console.log('🚀 Starting Recommendation Generator Job...\n');

  const pool = getPool();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const projectIdIndex = args.indexOf('--project');
  const projectIds = projectIdIndex >= 0 && args[projectIdIndex + 1] 
    ? [args[projectIdIndex + 1]] 
    : undefined;

  try {
    const job = createRecommendationGeneratorJob(pool, {
      enabled: true,
      projectIds,
      maxRecommendationsPerProject: 20,
      cleanupOldDays: 30,
    });

    const results = await job.run();

    // Print results
    console.log('\n📊 Results Summary:');
    console.log('='.repeat(60));

    let totalGenerated = 0;
    let totalSkipped = 0;
    let totalDeleted = 0;
    let totalErrors = 0;

    for (const result of results) {
      console.log(`\n📁 Project: ${result.projectName}`);
      console.log(`   ID: ${result.projectId}`);
      console.log(`   ✅ Generated: ${result.generated}`);
      console.log(`   ⏭️  Skipped: ${result.skipped}`);
      console.log(`   🗑️  Deleted (old): ${result.deleted}`);
      console.log(`   ⏱️  Duration: ${result.duration}ms`);
      
      if (result.errors.length > 0) {
        console.log(`   ❌ Errors: ${result.errors.join(', ')}`);
        totalErrors += result.errors.length;
      }

      totalGenerated += result.generated;
      totalSkipped += result.skipped;
      totalDeleted += result.deleted;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📈 Total: ${totalGenerated} generated, ${totalSkipped} skipped, ${totalDeleted} deleted`);
    
    if (totalErrors > 0) {
      console.log(`⚠️  Total errors: ${totalErrors}`);
    }

    console.log('\n✅ Job completed successfully!');

  } catch (error: any) {
    console.error('\n❌ Job failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
