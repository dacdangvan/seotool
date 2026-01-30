/**
 * Content Normalizer Service
 * Section 17: Full Page Content Capture & Normalization
 * 
 * Extracts and normalizes page content from rendered DOM for AI features.
 * AI features MUST NOT consume raw HTML directly.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cheerio = require('cheerio');

import {
  NormalizedContent,
  NormalizedHeading,
  NormalizedSection,
  NormalizedImage,
  NormalizedLink,
} from './types';

// Elements to exclude from content extraction
const EXCLUDED_SELECTORS = [
  'header',
  'footer',
  'nav',
  '.navigation',
  '.nav',
  '.header',
  '.footer',
  '.cookie-banner',
  '.cookie-notice',
  '.gdpr',
  '.legal-footer',
  '.sidebar',
  '.advertisement',
  '.ad',
  '.social-share',
  '.comments',
  '#comments',
  'script',
  'style',
  'noscript',
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',
];

export class ContentNormalizer {
  private excludeBoilerplate: boolean;
  private excludedSelectors: string[];

  constructor(options: { excludeBoilerplate?: boolean; customExclusions?: string[] } = {}) {
    this.excludeBoilerplate = options.excludeBoilerplate ?? true;
    this.excludedSelectors = [...EXCLUDED_SELECTORS, ...(options.customExclusions || [])];
  }

  /**
   * Main entry point: Normalize HTML content
   */
  normalize(
    html: string,
    url: string,
    renderMode: 'html_only' | 'js_rendered',
    language?: string
  ): NormalizedContent {
    const $ = cheerio.load(html);

    // Remove excluded elements if boilerplate exclusion is enabled
    if (this.excludeBoilerplate) {
      this.excludedSelectors.forEach((selector) => {
        $(selector).remove();
      });
    }

    const title = this.extractTitle($);
    const headings = this.extractHeadings($);
    const sections = this.extractSections($, headings);
    const paragraphs = this.extractParagraphs($);
    const lists = this.extractLists($);
    const tables = this.extractTables($);
    const images = this.extractImages($);
    const embeddedMedia = this.extractEmbeddedMedia($);
    const internalLinks = this.extractInternalLinks($, url);
    const externalLinks = this.extractExternalLinks($, url);
    const structuredData = this.extractStructuredData($);
    const wordCount = this.calculateWordCount(paragraphs, sections);
    const readingTime = this.calculateReadingTime(wordCount);

    return {
      url,
      language: language || this.detectLanguage($),
      render_mode: renderMode,
      content: {
        title,
        headings,
        sections,
        paragraphs,
        lists,
        tables,
      },
      media: {
        images,
        embedded_media: embeddedMedia,
      },
      links: {
        internal: internalLinks,
        external: externalLinks,
      },
      structured_data: structuredData,
      metrics: {
        word_count: wordCount,
        reading_time_minutes: readingTime,
      },
    };
  }

  /**
   * Extract page title
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractTitle($: any): string {
    // Priority: og:title > title tag > h1
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) return ogTitle.trim();

    const titleTag = $('title').text();
    if (titleTag) return titleTag.trim();

    const h1 = $('h1').first().text();
    return h1 ? h1.trim() : '';
  }

  /**
   * Extract all headings (H1-H6)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractHeadings($: any): NormalizedHeading[] {
    const headings: NormalizedHeading[] = [];

    $('h1, h2, h3, h4, h5, h6').each((_: number, el: any) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (text) {
        const tagName = el.tagName || el.name || 'h1';
        headings.push({
          level: parseInt(tagName.replace('h', ''), 10),
          text,
          id: $el.attr('id'),
        });
      }
    });

    return headings;
  }

  /**
   * Extract content sections based on headings
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractSections(
    $: any,
    headings: NormalizedHeading[]
  ): NormalizedSection[] {
    const sections: NormalizedSection[] = [];
    let sectionIndex = 0;

    // Find content between headings
    $('h1, h2, h3, h4, h5, h6').each((_: number, el: any) => {
      const $heading = $(el);
      const headingText = $heading.text().trim();
      const tagName = el.tagName || el.name || 'h1';
      const headingLevel = parseInt(tagName.replace('h', ''), 10);

      // Collect text until next heading
      let text = '';
      let current = $heading.next();

      while (current.length && !current.is('h1, h2, h3, h4, h5, h6')) {
        const currentText = current.text().trim();
        if (currentText) {
          text += currentText + ' ';
        }
        current = current.next();
      }

      text = text.trim();

      if (text) {
        sections.push({
          section_id: `section_${sectionIndex++}`,
          heading: headingText,
          heading_level: headingLevel,
          text,
          word_count: this.countWords(text),
        });
      }
    });

    return sections;
  }

  /**
   * Extract all paragraphs
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractParagraphs($: any): string[] {
    const paragraphs: string[] = [];

    $('p').each((_: number, el: any) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        // Ignore very short paragraphs
        paragraphs.push(text);
      }
    });

    return paragraphs;
  }

  /**
   * Extract lists (ul/ol)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractLists($: any): string[][] {
    const lists: string[][] = [];

    $('ul, ol').each((_: number, el: any) => {
      const items: string[] = [];
      $(el)
        .find('li')
        .each((_: number, li: any) => {
          const text = $(li).text().trim();
          if (text) {
            items.push(text);
          }
        });
      if (items.length > 0) {
        lists.push(items);
      }
    });

    return lists;
  }

  /**
   * Extract tables as text representation
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractTables($: any): string[][][] {
    const tables: string[][][] = [];

    $('table').each((_: number, table: any) => {
      const rows: string[][] = [];

      $(table)
        .find('tr')
        .each((_: number, tr: any) => {
          const cells: string[] = [];
          $(tr)
            .find('th, td')
            .each((_: number, cell: any) => {
              cells.push($(cell).text().trim());
            });
          if (cells.length > 0) {
            rows.push(cells);
          }
        });

      if (rows.length > 0) {
        tables.push(rows);
      }
    });

    return tables;
  }

  /**
   * Extract images with metadata
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractImages($: any): NormalizedImage[] {
    const images: NormalizedImage[] = [];

    $('img').each((_: number, el: any) => {
      const $img = $(el);
      const src = $img.attr('src') || $img.attr('data-src');

      if (src) {
        // Get surrounding context
        const parent = $img.parent();
        let context = '';
        if (parent.is('figure')) {
          context = parent.find('figcaption').text().trim();
        } else {
          context = parent.text().trim().slice(0, 200);
        }

        images.push({
          src,
          alt: $img.attr('alt') || '',
          title: $img.attr('title'),
          surrounding_context: context || undefined,
          width: parseInt($img.attr('width') || '0', 10) || undefined,
          height: parseInt($img.attr('height') || '0', 10) || undefined,
        });
      }
    });

    return images;
  }

  /**
   * Extract embedded media (iframes, videos)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractEmbeddedMedia(
    $: any
  ): Array<{ type: string; src: string; title?: string }> {
    const media: Array<{ type: string; src: string; title?: string }> = [];

    // Iframes (YouTube, Vimeo, etc.)
    $('iframe').each((_: number, el: any) => {
      const $iframe = $(el);
      const src = $iframe.attr('src');
      if (src && !src.includes('doubleclick') && !src.includes('googlesyndication')) {
        let type = 'iframe';
        if (src.includes('youtube')) type = 'youtube';
        if (src.includes('vimeo')) type = 'vimeo';

        media.push({
          type,
          src,
          title: $iframe.attr('title'),
        });
      }
    });

    // Video tags
    $('video').each((_: number, el: any) => {
      const $video = $(el);
      const src = $video.attr('src') || $video.find('source').first().attr('src');
      if (src) {
        media.push({
          type: 'video',
          src,
          title: $video.attr('title'),
        });
      }
    });

    return media;
  }

  /**
   * Extract internal links
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractInternalLinks($: any, pageUrl: string): NormalizedLink[] {
    const links: NormalizedLink[] = [];
    const baseUrl = new URL(pageUrl);

    $('a[href]').each((_: number, el: any) => {
      const $a = $(el);
      const href = $a.attr('href');

      if (href) {
        try {
          const linkUrl = new URL(href, pageUrl);

          // Check if internal link
          if (linkUrl.hostname === baseUrl.hostname) {
            const rel = $a.attr('rel') || '';

            links.push({
              url: linkUrl.pathname + linkUrl.search,
              anchor_text: $a.text().trim(),
              rel: rel || undefined,
              section_context: this.findSectionContext($, $a),
              is_nofollow: rel.includes('nofollow'),
            });
          }
        } catch {
          // Invalid URL, skip
        }
      }
    });

    return links;
  }

  /**
   * Extract external links
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractExternalLinks($: any, pageUrl: string): NormalizedLink[] {
    const links: NormalizedLink[] = [];
    const baseUrl = new URL(pageUrl);

    $('a[href]').each((_: number, el: any) => {
      const $a = $(el);
      const href = $a.attr('href');

      if (href) {
        try {
          const linkUrl = new URL(href, pageUrl);

          // Check if external link
          if (linkUrl.hostname !== baseUrl.hostname && linkUrl.protocol.startsWith('http')) {
            const rel = $a.attr('rel') || '';

            links.push({
              url: linkUrl.href,
              anchor_text: $a.text().trim(),
              rel: rel || undefined,
              section_context: this.findSectionContext($, $a),
              is_nofollow: rel.includes('nofollow'),
            });
          }
        } catch {
          // Invalid URL, skip
        }
      }
    });

    return links;
  }

  /**
   * Find the section context for an element
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private findSectionContext(
    $: any,
    $element: any
  ): string | undefined {
    // Look for parent heading
    let parent = $element.parent();
    for (let i = 0; i < 10 && parent.length; i++) {
      const prevHeading = parent.prevAll('h1, h2, h3, h4, h5, h6').first();
      if (prevHeading.length) {
        return prevHeading.text().trim();
      }
      parent = parent.parent();
    }
    return undefined;
  }

  /**
   * Extract JSON-LD structured data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractStructuredData($: any): {
    json_ld: object[];
    schema_types: string[];
  } {
    const jsonLd: object[] = [];
    const schemaTypes: string[] = [];

    $('script[type="application/ld+json"]').each((_: number, el: any) => {
      try {
        const content = $(el).html();
        if (content) {
          const data = JSON.parse(content);

          if (Array.isArray(data)) {
            jsonLd.push(...data);
            data.forEach((item) => {
              if (item['@type']) {
                const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
                schemaTypes.push(...types);
              }
            });
          } else {
            jsonLd.push(data);
            if (data['@type']) {
              const types = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
              schemaTypes.push(...types);
            }
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    });

    return {
      json_ld: jsonLd,
      schema_types: [...new Set(schemaTypes)],
    };
  }

  /**
   * Detect page language
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private detectLanguage($: any): string {
    return $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content') || 'en';
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  }

  /**
   * Calculate total word count
   */
  private calculateWordCount(paragraphs: string[], sections: NormalizedSection[]): number {
    const paragraphWords = paragraphs.reduce((sum, p) => sum + this.countWords(p), 0);
    const sectionWords = sections.reduce((sum, s) => sum + s.word_count, 0);

    // Use whichever is larger to avoid double counting
    return Math.max(paragraphWords, sectionWords);
  }

  /**
   * Calculate reading time (average 200 words per minute)
   */
  private calculateReadingTime(wordCount: number): number {
    return Math.ceil(wordCount / 200);
  }
}

// Singleton instance
export const contentNormalizer = new ContentNormalizer();

// Factory for custom configuration
export function createContentNormalizer(
  options: { excludeBoilerplate?: boolean; customExclusions?: string[] } = {}
): ContentNormalizer {
  return new ContentNormalizer(options);
}
