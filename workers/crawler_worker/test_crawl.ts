import * as cheerio from 'cheerio';

async function testCrawl() {
  const response = await fetch('https://www.vib.com.vn/vn/home', {
    headers: {
      'User-Agent': 'SEOBot/1.0',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('Title:', $('title').text().trim());
  console.log('Meta Description:', $('meta[name="description"]').attr('content'));
}

testCrawl();
