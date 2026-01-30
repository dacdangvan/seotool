/**
 * Backfill Content Text Script
 * 
 * Extracts visible text from raw_html and updates content_text column
 * 
 * Usage: npx tsx src/scripts/backfill_content_text.ts [project_id] [limit]
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
import * as cheerio from 'cheerio';

config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'ai_seo_tool',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

interface PageRow {
  id: number;
  url: string;
  raw_html: string;
}

/**
 * Extract visible text from HTML
 */
function extractVisibleText(html: string): string {
  const $ = cheerio.load(html);
  
  // Remove non-visible elements
  $('script, style, noscript, iframe, svg, head, nav, footer, header').remove();
  $('[style*="display: none"], [style*="display:none"], [hidden]').remove();
  
  // Get text from body
  const body = $('body');
  if (!body.length) return '';
  
  // Extract text from main content areas first, fallback to body
  const mainContent = $('main, article, [role="main"], .content, #content').first();
  const textSource = mainContent.length ? mainContent : body;
  
  // Get text and clean it
  let text = textSource.text();
  
  // Normalize whitespace
  text = text
    .replace(/[\t\n\r]+/g, ' ')  // Replace tabs/newlines with space
    .replace(/\s{2,}/g, ' ')      // Collapse multiple spaces
    .trim();
  
  return text;
}

async function updateContentText(id: number, contentText: string): Promise<void> {
  await pool.query(
    'UPDATE page_content_normalized SET content_text = $1 WHERE id = $2',
    [contentText, id]
  );
}

async function main() {
  const projectId = process.argv[2] || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const limit = parseInt(process.argv[3] || '100', 10);

  console.log('🔄 Backfill Content Text Script');
  console.log(`Project: ${projectId}`);
  console.log(`Limit: ${limit}`);
  console.log('');

  // Get pages with raw_html but no content_text
  const result = await pool.query<PageRow>(
    `SELECT id, url, raw_html FROM page_content_normalized 
     WHERE project_id = $1 
       AND raw_html IS NOT NULL 
       AND LENGTH(raw_html) > 0
       AND (content_text IS NULL OR content_text = '')
     ORDER BY id
     LIMIT $2`,
    [projectId, limit]
  );

  const pages = result.rows;
  console.log(`Found ${pages.length} pages to process\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    console.log(`[${i + 1}/${pages.length}] ${page.url}`);

    try {
      const contentText = extractVisibleText(page.raw_html);
      const wordCount = contentText.split(/\s+/).filter(w => w.length > 0).length;
      
      await updateContentText(page.id, contentText);
      console.log(`  ✅ Extracted ${wordCount} words (${(contentText.length / 1024).toFixed(1)}KB)`);
      success++;
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      failed++;
    }
  }

  console.log('\n✅ Done!');
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}`);

  await pool.end();
}

main().catch(console.error);
