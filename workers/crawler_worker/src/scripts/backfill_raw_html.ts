/**
 * Backfill Raw HTML Script
 * 
 * Re-fetches and stores raw HTML for existing crawled pages
 * 
 * Usage: npx tsx src/scripts/backfill_raw_html.ts [project_id] [limit]
 */

import { Pool } from 'pg';
import { config } from 'dotenv';

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
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VIB-SEO-Bot/1.0 (respectful crawler)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`  ⚠️ HTTP ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      console.log(`  ⚠️ Not HTML: ${contentType}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.log(`  ❌ Fetch error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

async function updateRawHtml(id: number, rawHtml: string): Promise<void> {
  await pool.query(
    'UPDATE page_content_normalized SET raw_html = $1 WHERE id = $2',
    [rawHtml, id]
  );
}

async function main() {
  const projectId = process.argv[2] || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const limit = parseInt(process.argv[3] || '100', 10);

  console.log('🔄 Backfill Raw HTML Script');
  console.log(`Project: ${projectId}`);
  console.log(`Limit: ${limit}`);
  console.log('');

  // Get pages without raw_html
  const result = await pool.query<PageRow>(
    `SELECT id, url FROM page_content_normalized 
     WHERE project_id = $1 AND (raw_html IS NULL OR raw_html = '')
     ORDER BY id
     LIMIT $2`,
    [projectId, limit]
  );

  const pages = result.rows;
  console.log(`Found ${pages.length} pages without raw_html\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    console.log(`[${i + 1}/${pages.length}] ${page.url}`);

    const html = await fetchHtml(page.url);
    if (html) {
      await updateRawHtml(page.id, html);
      console.log(`  ✅ Saved ${(html.length / 1024).toFixed(1)}KB`);
      success++;
    } else {
      failed++;
    }

    // Rate limit
    if (i < pages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n✅ Done!');
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}`);

  await pool.end();
}

main().catch(console.error);
