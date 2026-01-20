/**
 * HTML Parser
 * 
 * Extracts SEO-relevant data from HTML content
 */

import { PageData, ImageData, SEOIssue, SEOIssueType } from './types';

// Simple HTML tag regex patterns
const TITLE_REGEX = /<title[^>]*>([^<]*)<\/title>/i;
const META_DESC_REGEX = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i;
const META_DESC_ALT_REGEX = /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i;
const META_KEYWORDS_REGEX = /<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']*)["']/i;
const META_ROBOTS_REGEX = /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i;
const CANONICAL_REGEX = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i;
const H1_REGEX = /<h1[^>]*>([^<]*)<\/h1>/gi;
const H2_REGEX = /<h2[^>]*>([^<]*)<\/h2>/gi;
const H3_REGEX = /<h3[^>]*>([^<]*)<\/h3>/gi;
const ANCHOR_REGEX = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>/gi;
const IMG_REGEX = /<img[^>]+>/gi;
const IMG_SRC_REGEX = /src=["']([^"']*)["']/i;
const IMG_ALT_REGEX = /alt=["']([^"']*)["']/i;
const IMG_WIDTH_REGEX = /width=["']?(\d+)/i;
const IMG_HEIGHT_REGEX = /height=["']?(\d+)/i;
const OG_TITLE_REGEX = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i;
const OG_DESC_REGEX = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i;
const OG_IMAGE_REGEX = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i;
const OG_TYPE_REGEX = /<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']*)["']/i;
const JSON_LD_REGEX = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/gi;
const BODY_REGEX = /<body[^>]*>([\s\S]*)<\/body>/i;
const STRIP_TAGS_REGEX = /<[^>]+>/g;
const STRIP_SCRIPTS_REGEX = /<script[^>]*>[\s\S]*?<\/script>/gi;
const STRIP_STYLES_REGEX = /<style[^>]*>[\s\S]*?<\/style>/gi;

export class HTMLParser {
  private baseUrl: URL;
  
  constructor(baseUrl: string) {
    this.baseUrl = new URL(baseUrl);
  }
  
  /**
   * Parse HTML and extract SEO data
   */
  parse(html: string, url: string, statusCode: number, responseTime: number, pageSize: number, crawlDepth: number, projectId: string): PageData {
    const title = this.extractTitle(html);
    const metaDescription = this.extractMetaDescription(html);
    const metaKeywords = this.extractMetaKeywords(html);
    const metaRobots = this.extractMetaRobots(html);
    const canonicalUrl = this.extractCanonical(html);
    const h1Tags = this.extractHeadings(html, H1_REGEX);
    const h2Tags = this.extractHeadings(html, H2_REGEX);
    const h3Tags = this.extractHeadings(html, H3_REGEX);
    const links = this.extractLinks(html, url);
    const images = this.extractImages(html, url);
    const openGraph = this.extractOpenGraph(html);
    const structuredData = this.extractStructuredData(html);
    const wordCount = this.countWords(html);
    const contentHash = this.hashContent(html);
    
    const issues = this.analyzeIssues({
      title,
      metaDescription,
      metaRobots,
      canonicalUrl,
      h1Tags,
      wordCount,
      images,
      openGraph,
      structuredData,
      statusCode,
      responseTime,
      url,
    });
    
    return {
      projectId,
      url,
      canonicalUrl,
      statusCode,
      responseTime,
      title,
      metaDescription,
      metaKeywords,
      metaRobots,
      openGraph,
      h1Tags,
      h2Tags,
      h3Tags,
      wordCount,
      internalLinks: links.internal,
      externalLinks: links.external,
      images,
      structuredData,
      contentHash,
      pageSize,
      crawlDepth,
      crawledAt: new Date(),
      issues,
    };
  }
  
  private extractTitle(html: string): string | undefined {
    const match = html.match(TITLE_REGEX);
    return match ? this.decodeHTML(match[1].trim()) : undefined;
  }
  
  private extractMetaDescription(html: string): string | undefined {
    let match = html.match(META_DESC_REGEX);
    if (!match) {
      match = html.match(META_DESC_ALT_REGEX);
    }
    return match ? this.decodeHTML(match[1].trim()) : undefined;
  }
  
  private extractMetaKeywords(html: string): string | undefined {
    const match = html.match(META_KEYWORDS_REGEX);
    return match ? this.decodeHTML(match[1].trim()) : undefined;
  }
  
  private extractMetaRobots(html: string): string | undefined {
    const match = html.match(META_ROBOTS_REGEX);
    return match ? match[1].trim().toLowerCase() : undefined;
  }
  
  private extractCanonical(html: string): string | undefined {
    const match = html.match(CANONICAL_REGEX);
    return match ? match[1].trim() : undefined;
  }
  
  private extractHeadings(html: string, regex: RegExp): string[] {
    const headings: string[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      const text = this.decodeHTML(match[1].trim());
      if (text) {
        headings.push(text);
      }
    }
    return headings;
  }
  
  private extractLinks(html: string, currentUrl: string): { internal: string[]; external: string[] } {
    const internal: string[] = [];
    const external: string[] = [];
    const seen = new Set<string>();
    
    let match;
    while ((match = ANCHOR_REGEX.exec(html)) !== null) {
      try {
        const href = match[1].trim();
        if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          continue;
        }
        
        const absoluteUrl = new URL(href, currentUrl);
        const normalized = absoluteUrl.origin + absoluteUrl.pathname;
        
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        
        if (absoluteUrl.hostname === this.baseUrl.hostname) {
          internal.push(normalized);
        } else {
          external.push(absoluteUrl.href);
        }
      } catch {
        // Invalid URL, skip
      }
    }
    
    return { internal, external };
  }
  
  private extractImages(html: string, currentUrl: string): ImageData[] {
    const images: ImageData[] = [];
    let match;
    
    while ((match = IMG_REGEX.exec(html)) !== null) {
      const imgTag = match[0];
      const srcMatch = imgTag.match(IMG_SRC_REGEX);
      
      if (srcMatch) {
        const src = srcMatch[1];
        const altMatch = imgTag.match(IMG_ALT_REGEX);
        const widthMatch = imgTag.match(IMG_WIDTH_REGEX);
        const heightMatch = imgTag.match(IMG_HEIGHT_REGEX);
        
        let absoluteSrc = src;
        let isExternal = false;
        
        try {
          const imgUrl = new URL(src, currentUrl);
          absoluteSrc = imgUrl.href;
          isExternal = imgUrl.hostname !== this.baseUrl.hostname;
        } catch {
          // Keep relative src
        }
        
        images.push({
          src: absoluteSrc,
          alt: altMatch ? this.decodeHTML(altMatch[1]) : undefined,
          width: widthMatch ? parseInt(widthMatch[1]) : undefined,
          height: heightMatch ? parseInt(heightMatch[1]) : undefined,
          hasAlt: !!altMatch && altMatch[1].trim().length > 0,
          isExternal,
        });
      }
    }
    
    return images;
  }
  
  private extractOpenGraph(html: string): PageData['openGraph'] {
    const title = html.match(OG_TITLE_REGEX)?.[1];
    const description = html.match(OG_DESC_REGEX)?.[1];
    const image = html.match(OG_IMAGE_REGEX)?.[1];
    const type = html.match(OG_TYPE_REGEX)?.[1];
    
    if (!title && !description && !image && !type) {
      return undefined;
    }
    
    return {
      title: title ? this.decodeHTML(title) : undefined,
      description: description ? this.decodeHTML(description) : undefined,
      image,
      type,
    };
  }
  
  private extractStructuredData(html: string): object[] | undefined {
    const data: object[] = [];
    let match;
    
    while ((match = JSON_LD_REGEX.exec(html)) !== null) {
      try {
        const json = JSON.parse(match[1]);
        data.push(json);
      } catch {
        // Invalid JSON, skip
      }
    }
    
    return data.length > 0 ? data : undefined;
  }
  
  private countWords(html: string): number {
    // Extract body content
    const bodyMatch = html.match(BODY_REGEX);
    if (!bodyMatch) return 0;
    
    let text = bodyMatch[1];
    
    // Remove scripts and styles
    text = text.replace(STRIP_SCRIPTS_REGEX, '');
    text = text.replace(STRIP_STYLES_REGEX, '');
    
    // Remove HTML tags
    text = text.replace(STRIP_TAGS_REGEX, ' ');
    
    // Decode HTML entities
    text = this.decodeHTML(text);
    
    // Count words
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length;
  }
  
  private hashContent(html: string): string {
    // Simple hash for change detection
    let hash = 0;
    for (let i = 0; i < html.length; i++) {
      const char = html.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }
  
  private decodeHTML(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  }
  
  private analyzeIssues(data: {
    title?: string;
    metaDescription?: string;
    metaRobots?: string;
    canonicalUrl?: string;
    h1Tags: string[];
    wordCount: number;
    images: ImageData[];
    openGraph?: object;
    structuredData?: object[];
    statusCode: number;
    responseTime: number;
    url: string;
  }): SEOIssue[] {
    const issues: SEOIssue[] = [];
    
    // Title issues
    if (!data.title) {
      issues.push({
        type: 'missing_title',
        severity: 'critical',
        message: 'Trang thiếu thẻ title',
        details: 'Thẻ title là yếu tố SEO quan trọng nhất. Hãy thêm title mô tả nội dung trang.',
      });
    } else if (data.title.length < 30) {
      issues.push({
        type: 'title_too_short',
        severity: 'warning',
        message: `Title quá ngắn (${data.title.length} ký tự)`,
        details: 'Title nên từ 50-60 ký tự để tối ưu hiển thị trên Google.',
      });
    } else if (data.title.length > 60) {
      issues.push({
        type: 'title_too_long',
        severity: 'warning',
        message: `Title quá dài (${data.title.length} ký tự)`,
        details: 'Title trên 60 ký tự có thể bị cắt trên kết quả tìm kiếm.',
      });
    }
    
    // Meta description issues
    if (!data.metaDescription) {
      issues.push({
        type: 'missing_meta_description',
        severity: 'critical',
        message: 'Trang thiếu meta description',
        details: 'Meta description giúp tăng CTR từ kết quả tìm kiếm.',
      });
    } else if (data.metaDescription.length < 120) {
      issues.push({
        type: 'meta_description_too_short',
        severity: 'warning',
        message: `Meta description quá ngắn (${data.metaDescription.length} ký tự)`,
        details: 'Meta description nên từ 150-160 ký tự.',
      });
    } else if (data.metaDescription.length > 160) {
      issues.push({
        type: 'meta_description_too_long',
        severity: 'warning',
        message: `Meta description quá dài (${data.metaDescription.length} ký tự)`,
        details: 'Meta description trên 160 ký tự có thể bị cắt.',
      });
    }
    
    // H1 issues
    if (data.h1Tags.length === 0) {
      issues.push({
        type: 'missing_h1',
        severity: 'critical',
        message: 'Trang thiếu thẻ H1',
        details: 'Mỗi trang nên có một thẻ H1 duy nhất mô tả nội dung chính.',
      });
    } else if (data.h1Tags.length > 1) {
      issues.push({
        type: 'multiple_h1',
        severity: 'warning',
        message: `Trang có ${data.h1Tags.length} thẻ H1`,
        details: 'Nên chỉ có một thẻ H1 trên mỗi trang.',
      });
    }
    
    // Canonical issues
    if (!data.canonicalUrl) {
      issues.push({
        type: 'missing_canonical',
        severity: 'info',
        message: 'Trang thiếu thẻ canonical',
        details: 'Thẻ canonical giúp tránh duplicate content.',
      });
    }
    
    // Image alt issues
    const imagesWithoutAlt = data.images.filter(img => !img.hasAlt);
    if (imagesWithoutAlt.length > 0) {
      issues.push({
        type: 'missing_alt_text',
        severity: 'warning',
        message: `${imagesWithoutAlt.length} hình ảnh thiếu alt text`,
        details: 'Alt text giúp SEO hình ảnh và accessibility.',
      });
    }
    
    // Thin content
    if (data.wordCount < 300) {
      issues.push({
        type: 'thin_content',
        severity: 'warning',
        message: `Nội dung mỏng (${data.wordCount} từ)`,
        details: 'Trang có ít nội dung có thể bị đánh giá thấp bởi Google.',
      });
    }
    
    // Slow response
    if (data.responseTime > 3000) {
      issues.push({
        type: 'slow_response',
        severity: 'critical',
        message: `Thời gian phản hồi chậm (${data.responseTime}ms)`,
        details: 'Trang nên tải trong vòng 3 giây để UX tốt.',
      });
    } else if (data.responseTime > 1000) {
      issues.push({
        type: 'slow_response',
        severity: 'warning',
        message: `Thời gian phản hồi khá chậm (${data.responseTime}ms)`,
        details: 'Cân nhắc tối ưu để trang tải nhanh hơn.',
      });
    }
    
    // Structured data
    if (!data.structuredData || data.structuredData.length === 0) {
      issues.push({
        type: 'missing_structured_data',
        severity: 'info',
        message: 'Trang thiếu structured data (JSON-LD)',
        details: 'Structured data giúp Google hiểu nội dung trang tốt hơn.',
      });
    }
    
    // Open Graph
    if (!data.openGraph) {
      issues.push({
        type: 'missing_open_graph',
        severity: 'info',
        message: 'Trang thiếu Open Graph tags',
        details: 'OG tags cải thiện chia sẻ trên mạng xã hội.',
      });
    }
    
    // Noindex check
    if (data.metaRobots && data.metaRobots.includes('noindex')) {
      issues.push({
        type: 'noindex_page',
        severity: 'warning',
        message: 'Trang có meta robots noindex',
        details: 'Trang này sẽ không được index bởi Google.',
      });
    }
    
    return issues;
  }
}
