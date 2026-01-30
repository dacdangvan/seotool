import pg from 'pg';
import * as cheerio from 'cheerio';

const pool = new pg.Pool({
  host: 'localhost',
  port: 5433,
  database: 'ai_seo_tool',
  user: 'postgres',
  password: 'postgres',
});

async function testSaveContent() {
  const url = 'https://www.vib.com.vn/vn/home';
  const projectId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  
  // Fetch and parse
  const response = await fetch(url, {
    headers: { 'User-Agent': 'SEOBot/1.0' },
  });
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const title = $('title').text().trim();
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  
  console.log('Extracted:');
  console.log('  Title:', title);
  console.log('  Meta Description:', metaDesc.substring(0, 80) + '...');
  
  // Save to DB
  const result = await pool.query(
    `INSERT INTO page_content_normalized (
      project_id, url, render_mode, title, meta_description, crawled_at
    ) VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (project_id, url) DO UPDATE SET
      title = EXCLUDED.title,
      meta_description = EXCLUDED.meta_description,
      crawled_at = NOW()
    RETURNING id, title, meta_description`,
    [projectId, url, 'html_only', title, metaDesc]
  );
  
  console.log('\nSaved to DB:');
  console.log('  ID:', result.rows[0].id);
  console.log('  Title:', result.rows[0].title);
  console.log('  Meta Description:', result.rows[0].meta_description?.substring(0, 80) + '...');
  
  await pool.end();
}

testSaveContent().catch(console.error);
