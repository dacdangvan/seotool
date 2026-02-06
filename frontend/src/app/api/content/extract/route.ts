import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: Extract content from URL for SEO validation
 * GET /api/content/extract?url=<url>
 */

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // Validate URL
    new URL(url);

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0; +https://www.vib.com.vn)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
        { status: 400 }
      );
    }

    const html = await response.text();

    // Extract data from HTML
    const extractedData = extractSEOData(html, url);

    return NextResponse.json(extractedData);
  } catch (error) {
    console.error('Content extraction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract content' },
      { status: 500 }
    );
  }
}

function extractSEOData(html: string, url: string) {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : '';

  // Extract meta description
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  const metaDescription = metaDescMatch ? decodeHTMLEntities(metaDescMatch[1].trim()) : '';

  // Extract H1 tags
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h1 = h1Matches.map(h => stripTags(decodeHTMLEntities(h)));

  // Extract H2 tags
  const h2Matches = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [];
  const h2 = h2Matches.map(h => stripTags(decodeHTMLEntities(h)));

  // Extract H3 tags
  const h3Matches = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/gi) || [];
  const h3 = h3Matches.map(h => stripTags(decodeHTMLEntities(h)));

  // Extract body content and count words
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;
  
  // Remove scripts, styles, and tags
  const cleanContent = bodyContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const content = decodeHTMLEntities(cleanContent);
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

  // Extract images
  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  const images = imgMatches.length;
  const imagesWithoutAlt = imgMatches.filter(img => 
    !img.match(/alt=["'][^"']+["']/i) || img.match(/alt=["']\s*["']/i)
  ).length;

  // Extract links
  const linkMatches = html.match(/<a[^>]*href=["']([^"']*)["'][^>]*>/gi) || [];
  const baseUrl = new URL(url);
  
  let internalLinks = 0;
  let externalLinks = 0;
  
  linkMatches.forEach(link => {
    const hrefMatch = link.match(/href=["']([^"']*)["']/i);
    if (hrefMatch) {
      const href = hrefMatch[1];
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        // Skip anchors, javascript, mailto, tel
        return;
      }
      
      try {
        const linkUrl = new URL(href, url);
        if (linkUrl.hostname === baseUrl.hostname) {
          internalLinks++;
        } else {
          externalLinks++;
        }
      } catch {
        // Invalid URL, skip
      }
    }
  });

  // Extract canonical
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i) ||
                         html.match(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["'][^>]*>/i);
  const canonical = canonicalMatch ? canonicalMatch[1] : '';

  // Check for noindex
  const robotsMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const hasNoindex = robotsMatch ? robotsMatch[1].toLowerCase().includes('noindex') : false;

  // Extract Open Graph data
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i);

  return {
    url,
    title,
    metaDescription,
    h1,
    h2,
    h3,
    wordCount,
    content: content.substring(0, 5000), // Limit content size
    images,
    imagesWithoutAlt,
    internalLinks,
    externalLinks,
    canonical,
    hasNoindex,
    openGraph: {
      title: ogTitleMatch ? decodeHTMLEntities(ogTitleMatch[1]) : '',
      description: ogDescMatch ? decodeHTMLEntities(ogDescMatch[1]) : '',
      image: ogImageMatch ? ogImageMatch[1] : '',
    },
  };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#8217;': "'",
    '&#8216;': "'",
    '&#8220;': '"',
    '&#8221;': '"',
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
  };
  
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  
  // Handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  decoded = decoded.replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  return decoded;
}
