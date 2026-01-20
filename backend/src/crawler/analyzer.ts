/**
 * Page Analyzer
 * 
 * SEO-safe Web Crawler - Extract SEO signals from HTML
 * Technical SEO audit & content analysis ONLY
 * NO PII extraction
 */

import { PageSEOData, ImageSEOData, OpenGraphData, SEOIssue, SEOIssueType } from './models';
import { FetchResult } from './fetcher';

// Regex patterns for SEO element extraction
const PATTERNS = {
  title: /<title[^>]*>([^<]*)<\/title>/i,
  metaDescription: /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
  metaDescriptionAlt: /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
  metaRobots: /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i,
  metaRobotsAlt: /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']robots["']/i,
  canonical: /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i,
  canonicalAlt: /<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i,
  htmlLang: /<html[^>]+lang=["']([^"']*)["']/i,
  h1: /<h1[^>]*>([\s\S]*?)<\/h1>/gi,
  h2: /<h2[^>]*>([\s\S]*?)<\/h2>/gi,
  h3: /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
  img: /<img[^>]+>/gi,
  imgSrc: /src=["']([^"']*)["']/i,
  imgAlt: /alt=["']([^"']*)["']/i,
  imgWidth: /width=["']?(\d+)/i,
  imgHeight: /height=["']?(\d+)/i,
  ogTitle: /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
  ogDescription: /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
  ogImage: /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i,
  ogType: /<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']*)["']/i,
  ogUrl: /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']*)["']/i,
  ogSiteName: /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["']/i,
  jsonLd: /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  body: /<body[^>]*>([\s\S]*)<\/body>/i,
};

// Thresholds for SEO analysis
const THRESHOLDS = {
  title: { min: 30, max: 60 },
  metaDescription: { min: 120, max: 160 },
  h1Count: { min: 1, max: 1 },
  wordCount: { min: 300 },
  responseTime: { warning: 1000, critical: 3000 },
};

export class PageAnalyzer {
  private baseUrl: URL;
  
  constructor(baseUrl: string) {
    this.baseUrl = new URL(baseUrl);
  }
  
  /**
   * Analyze a fetched page and extract SEO signals
   */
  analyze(
    fetchResult: FetchResult,
    projectId: string,
    crawlDepth: number,
    storeRawHtml: boolean = false
  ): PageSEOData {
    const html = fetchResult.html;
    const url = fetchResult.finalUrl || fetchResult.url;
    
    // Extract all SEO elements
    const title = this.extractTitle(html);
    const metaDescription = this.extractMetaDescription(html);
    const metaRobots = this.extractMetaRobots(html);
    const canonicalUrl = this.extractCanonical(html);
    const language = this.extractLanguage(html);
    const h1Tags = this.extractHeadings(html, PATTERNS.h1);
    const h2Tags = this.extractHeadings(html, PATTERNS.h2);
    const h3Tags = this.extractHeadings(html, PATTERNS.h3);
    const images = this.extractImages(html, url);
    const openGraph = this.extractOpenGraph(html);
    const structuredData = this.extractStructuredData(html);
    const wordCount = this.countWords(html);
    const contentHash = this.hashContent(html);
    
    // Check noindex/nofollow
    const hasNoindex = this.hasDirective(metaRobots, 'noindex');
    const hasNofollow = this.hasDirective(metaRobots, 'nofollow');
    
    // Check canonical
    const isSelfCanonical = canonicalUrl ? this.isSameUrl(canonicalUrl, url) : undefined;
    
    // Analyze issues
    const issues = this.analyzeIssues({
      url,
      statusCode: fetchResult.statusCode,
      responseTime: fetchResult.responseTime,
      title,
      metaDescription,
      metaRobots,
      canonicalUrl,
      language,
      h1Tags,
      wordCount,
      images,
      openGraph,
      structuredData,
    });
    
    // Count images without alt
    const imagesWithoutAlt = images.filter(img => !img.hasAlt).length;
    
    return {
      projectId,
      url,
      statusCode: fetchResult.statusCode,
      responseTime: fetchResult.responseTime,
      title,
      titleLength: title?.length,
      metaDescription,
      metaDescriptionLength: metaDescription?.length,
      canonicalUrl,
      isSelfCanonical,
      metaRobots,
      hasNoindex,
      hasNofollow,
      language,
      h1Tags,
      h1Count: h1Tags.length,
      h2Tags,
      h2Count: h2Tags.length,
      h3Tags,
      h3Count: h3Tags.length,
      wordCount,
      contentLength: fetchResult.contentLength,
      internalLinks: [], // Will be filled by crawler
      internalLinksCount: 0,
      externalLinks: [], // Will be filled by crawler
      externalLinksCount: 0,
      images,
      imagesCount: images.length,
      imagesWithoutAlt,
      openGraph,
      hasOpenGraph: !!openGraph,
      structuredData,
      hasStructuredData: !!structuredData && structuredData.length > 0,
      contentHash,
      contentType: fetchResult.contentType,
      crawlDepth,
      crawledAt: new Date(),
      issues,
      rawHtml: storeRawHtml ? html : undefined,
    };
  }
  
  // ==========================================================================
  // EXTRACTION METHODS
  // ==========================================================================
  
  private extractTitle(html: string): string | undefined {
    const match = html.match(PATTERNS.title);
    return match ? this.cleanText(match[1]) : undefined;
  }
  
  private extractMetaDescription(html: string): string | undefined {
    let match = html.match(PATTERNS.metaDescription);
    if (!match) {
      match = html.match(PATTERNS.metaDescriptionAlt);
    }
    return match ? this.cleanText(match[1]) : undefined;
  }
  
  private extractMetaRobots(html: string): string | undefined {
    let match = html.match(PATTERNS.metaRobots);
    if (!match) {
      match = html.match(PATTERNS.metaRobotsAlt);
    }
    return match ? match[1].trim().toLowerCase() : undefined;
  }
  
  private extractCanonical(html: string): string | undefined {
    let match = html.match(PATTERNS.canonical);
    if (!match) {
      match = html.match(PATTERNS.canonicalAlt);
    }
    return match ? match[1].trim() : undefined;
  }
  
  private extractLanguage(html: string): string | undefined {
    const match = html.match(PATTERNS.htmlLang);
    return match ? match[1].trim().toLowerCase() : undefined;
  }
  
  private extractHeadings(html: string, regex: RegExp): string[] {
    const headings: string[] = [];
    let match;
    
    // Reset regex
    regex.lastIndex = 0;
    
    while ((match = regex.exec(html)) !== null) {
      const text = this.cleanText(this.stripTags(match[1]));
      if (text) {
        headings.push(text);
      }
    }
    
    return headings;
  }
  
  private extractImages(html: string, pageUrl: string): ImageSEOData[] {
    const images: ImageSEOData[] = [];
    let match;
    
    PATTERNS.img.lastIndex = 0;
    
    while ((match = PATTERNS.img.exec(html)) !== null) {
      const imgTag = match[0];
      const srcMatch = imgTag.match(PATTERNS.imgSrc);
      
      if (srcMatch) {
        const src = srcMatch[1];
        const altMatch = imgTag.match(PATTERNS.imgAlt);
        const widthMatch = imgTag.match(PATTERNS.imgWidth);
        const heightMatch = imgTag.match(PATTERNS.imgHeight);
        
        // Resolve absolute URL
        let absoluteSrc = src;
        let isExternal = false;
        
        try {
          const imgUrl = new URL(src, pageUrl);
          absoluteSrc = imgUrl.href;
          isExternal = imgUrl.hostname !== this.baseUrl.hostname;
        } catch {
          // Keep relative src
        }
        
        const alt = altMatch ? this.cleanText(altMatch[1]) : undefined;
        
        images.push({
          src: absoluteSrc,
          alt,
          hasAlt: !!alt && alt.length > 0,
          isExternal,
          width: widthMatch ? parseInt(widthMatch[1]) : undefined,
          height: heightMatch ? parseInt(heightMatch[1]) : undefined,
        });
      }
    }
    
    return images;
  }
  
  private extractOpenGraph(html: string): OpenGraphData | undefined {
    const title = html.match(PATTERNS.ogTitle)?.[1];
    const description = html.match(PATTERNS.ogDescription)?.[1];
    const image = html.match(PATTERNS.ogImage)?.[1];
    const type = html.match(PATTERNS.ogType)?.[1];
    const url = html.match(PATTERNS.ogUrl)?.[1];
    const siteName = html.match(PATTERNS.ogSiteName)?.[1];
    
    if (!title && !description && !image && !type) {
      return undefined;
    }
    
    return {
      title: title ? this.cleanText(title) : undefined,
      description: description ? this.cleanText(description) : undefined,
      image,
      type,
      url,
      siteName: siteName ? this.cleanText(siteName) : undefined,
    };
  }
  
  private extractStructuredData(html: string): object[] | undefined {
    const data: object[] = [];
    let match;
    
    PATTERNS.jsonLd.lastIndex = 0;
    
    while ((match = PATTERNS.jsonLd.exec(html)) !== null) {
      try {
        const json = JSON.parse(match[1].trim());
        data.push(json);
      } catch {
        // Invalid JSON, skip
      }
    }
    
    return data.length > 0 ? data : undefined;
  }
  
  private countWords(html: string): number {
    const bodyMatch = html.match(PATTERNS.body);
    if (!bodyMatch) return 0;
    
    let text = bodyMatch[1];
    
    // Remove scripts and styles
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
    
    // Strip HTML tags
    text = this.stripTags(text);
    
    // Decode HTML entities
    text = this.decodeHtml(text);
    
    // Count words
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length;
  }
  
  private hashContent(html: string): string {
    // Simple hash for change detection
    let hash = 0;
    const str = html.substring(0, 10000); // Hash first 10KB for performance
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
  
  // ==========================================================================
  // ISSUE ANALYSIS
  // ==========================================================================
  
  private analyzeIssues(data: {
    url: string;
    statusCode: number;
    responseTime: number;
    title?: string;
    metaDescription?: string;
    metaRobots?: string;
    canonicalUrl?: string;
    language?: string;
    h1Tags: string[];
    wordCount: number;
    images: ImageSEOData[];
    openGraph?: OpenGraphData;
    structuredData?: object[];
  }): SEOIssue[] {
    const issues: SEOIssue[] = [];
    
    // Status code issues
    if (data.statusCode >= 500) {
      issues.push({
        type: 'server_error',
        severity: 'critical',
        message: `Lỗi server (HTTP ${data.statusCode})`,
        recommendation: 'Kiểm tra server logs và khắc phục lỗi.',
      });
    } else if (data.statusCode >= 400) {
      issues.push({
        type: 'client_error',
        severity: 'critical',
        message: `Lỗi client (HTTP ${data.statusCode})`,
        recommendation: data.statusCode === 404 
          ? 'Xóa hoặc redirect link đến trang này.' 
          : 'Kiểm tra quyền truy cập và cấu hình.',
      });
    } else if (data.statusCode >= 300) {
      issues.push({
        type: 'redirect',
        severity: 'info',
        message: `Redirect (HTTP ${data.statusCode})`,
        recommendation: 'Cập nhật internal links để trỏ trực tiếp đến URL đích.',
      });
    }
    
    // Response time issues
    if (data.responseTime > THRESHOLDS.responseTime.critical) {
      issues.push({
        type: 'slow_response',
        severity: 'critical',
        message: `Thời gian phản hồi quá chậm (${data.responseTime}ms)`,
        details: `Ngưỡng: < ${THRESHOLDS.responseTime.critical}ms`,
        recommendation: 'Tối ưu server, bật caching, sử dụng CDN.',
      });
    } else if (data.responseTime > THRESHOLDS.responseTime.warning) {
      issues.push({
        type: 'slow_response',
        severity: 'warning',
        message: `Thời gian phản hồi khá chậm (${data.responseTime}ms)`,
        details: `Ngưỡng khuyến nghị: < ${THRESHOLDS.responseTime.warning}ms`,
        recommendation: 'Cân nhắc tối ưu để cải thiện tốc độ.',
      });
    }
    
    // Title issues
    if (!data.title) {
      issues.push({
        type: 'missing_title',
        severity: 'critical',
        message: 'Thiếu thẻ title',
        recommendation: 'Thêm thẻ <title> mô tả nội dung trang (50-60 ký tự).',
      });
    } else if (data.title.length < THRESHOLDS.title.min) {
      issues.push({
        type: 'title_too_short',
        severity: 'warning',
        message: `Title quá ngắn (${data.title.length} ký tự)`,
        details: `Ngưỡng: ${THRESHOLDS.title.min}-${THRESHOLDS.title.max} ký tự`,
        recommendation: 'Viết title chi tiết hơn với keyword chính.',
      });
    } else if (data.title.length > THRESHOLDS.title.max) {
      issues.push({
        type: 'title_too_long',
        severity: 'warning',
        message: `Title quá dài (${data.title.length} ký tự)`,
        details: `Ngưỡng: ${THRESHOLDS.title.min}-${THRESHOLDS.title.max} ký tự`,
        recommendation: 'Rút gọn title, đặt keyword quan trọng ở đầu.',
      });
    }
    
    // Meta description issues
    if (!data.metaDescription) {
      issues.push({
        type: 'missing_meta_description',
        severity: 'critical',
        message: 'Thiếu meta description',
        recommendation: 'Thêm meta description hấp dẫn (150-160 ký tự) với CTA.',
      });
    } else if (data.metaDescription.length < THRESHOLDS.metaDescription.min) {
      issues.push({
        type: 'meta_description_too_short',
        severity: 'warning',
        message: `Meta description quá ngắn (${data.metaDescription.length} ký tự)`,
        details: `Ngưỡng: ${THRESHOLDS.metaDescription.min}-${THRESHOLDS.metaDescription.max} ký tự`,
        recommendation: 'Viết description chi tiết hơn để tăng CTR.',
      });
    } else if (data.metaDescription.length > THRESHOLDS.metaDescription.max) {
      issues.push({
        type: 'meta_description_too_long',
        severity: 'warning',
        message: `Meta description quá dài (${data.metaDescription.length} ký tự)`,
        details: `Ngưỡng: ${THRESHOLDS.metaDescription.min}-${THRESHOLDS.metaDescription.max} ký tự`,
        recommendation: 'Rút gọn để tránh bị cắt trên SERP.',
      });
    }
    
    // H1 issues
    if (data.h1Tags.length === 0) {
      issues.push({
        type: 'missing_h1',
        severity: 'critical',
        message: 'Thiếu thẻ H1',
        recommendation: 'Thêm một thẻ H1 duy nhất mô tả nội dung chính của trang.',
      });
    } else if (data.h1Tags.length > 1) {
      issues.push({
        type: 'multiple_h1',
        severity: 'warning',
        message: `Có ${data.h1Tags.length} thẻ H1`,
        details: `H1 tags: ${data.h1Tags.slice(0, 3).join(', ')}${data.h1Tags.length > 3 ? '...' : ''}`,
        recommendation: 'Chỉ nên có một thẻ H1 trên mỗi trang.',
      });
    } else if (data.h1Tags[0] && data.h1Tags[0].length === 0) {
      issues.push({
        type: 'empty_h1',
        severity: 'warning',
        message: 'Thẻ H1 trống',
        recommendation: 'Thêm nội dung vào thẻ H1.',
      });
    }
    
    // Canonical issues
    if (!data.canonicalUrl) {
      issues.push({
        type: 'missing_canonical',
        severity: 'info',
        message: 'Thiếu thẻ canonical',
        recommendation: 'Thêm canonical URL để tránh duplicate content.',
      });
    }
    
    // Language attribute
    if (!data.language) {
      issues.push({
        type: 'missing_lang_attribute',
        severity: 'info',
        message: 'Thiếu thuộc tính lang trong thẻ HTML',
        recommendation: 'Thêm lang="vi" vào thẻ <html> cho trang tiếng Việt.',
      });
    }
    
    // Content issues
    if (data.wordCount === 0) {
      issues.push({
        type: 'no_content',
        severity: 'critical',
        message: 'Không có nội dung text',
        recommendation: 'Thêm nội dung văn bản có giá trị cho người dùng.',
      });
    } else if (data.wordCount < THRESHOLDS.wordCount.min) {
      issues.push({
        type: 'thin_content',
        severity: 'warning',
        message: `Nội dung mỏng (${data.wordCount} từ)`,
        details: `Ngưỡng: > ${THRESHOLDS.wordCount.min} từ`,
        recommendation: 'Bổ sung nội dung chất lượng, chi tiết hơn.',
      });
    }
    
    // Image alt issues
    const imagesWithoutAlt = data.images.filter(img => !img.hasAlt);
    if (imagesWithoutAlt.length > 0) {
      issues.push({
        type: 'missing_alt_text',
        severity: 'warning',
        message: `${imagesWithoutAlt.length}/${data.images.length} hình ảnh thiếu alt text`,
        recommendation: 'Thêm alt text mô tả cho tất cả hình ảnh.',
      });
    }
    
    // Structured data
    if (!data.structuredData || data.structuredData.length === 0) {
      issues.push({
        type: 'missing_structured_data',
        severity: 'info',
        message: 'Thiếu structured data (JSON-LD)',
        recommendation: 'Thêm schema markup phù hợp với loại trang (Organization, BreadcrumbList, etc.)',
      });
    }
    
    // Open Graph
    if (!data.openGraph) {
      issues.push({
        type: 'missing_open_graph',
        severity: 'info',
        message: 'Thiếu Open Graph tags',
        recommendation: 'Thêm OG tags (og:title, og:description, og:image) cho chia sẻ social.',
      });
    }
    
    // Noindex check
    if (this.hasDirective(data.metaRobots, 'noindex')) {
      issues.push({
        type: 'noindex_page',
        severity: 'warning',
        message: 'Trang có meta robots noindex',
        details: `Robots: ${data.metaRobots}`,
        recommendation: 'Xác nhận đây có phải trang cần ẩn khỏi Google không.',
      });
    }
    
    return issues;
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  private hasDirective(metaRobots: string | undefined, directive: string): boolean {
    if (!metaRobots) return false;
    return metaRobots.toLowerCase().includes(directive);
  }
  
  private isSameUrl(url1: string, url2: string): boolean {
    try {
      const u1 = new URL(url1, this.baseUrl.href);
      const u2 = new URL(url2, this.baseUrl.href);
      return u1.origin + u1.pathname === u2.origin + u2.pathname;
    } catch {
      return false;
    }
  }
  
  private stripTags(html: string): string {
    return html.replace(/<[^>]+>/g, ' ');
  }
  
  private cleanText(text: string): string {
    return this.decodeHtml(text)
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  private decodeHtml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
  }
}
