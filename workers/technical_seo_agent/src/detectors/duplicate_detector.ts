/**
 * Duplicate Content Detector
 * Detects potential duplicate or thin content issues
 */

import { Detector } from './base';
import {
  DetectorContext,
  DetectorResult,
  SEOIssue,
  IssueCategory,
  IssueSeverity,
  CrawledPage,
} from '../models';
import { v4 as uuid } from 'uuid';

// Threshold for content similarity (using simple length comparison as proxy)
const THIN_CONTENT_WORD_THRESHOLD = 300;

export class DuplicateDetector implements Detector {
  readonly name = 'DuplicateDetector';

  detect(context: DetectorContext): DetectorResult {
    const issues: SEOIssue[] = [];
    const { page, allPages } = context;

    // Check for thin content
    const wordCount = this.estimateWordCount(page.html);
    if (wordCount < THIN_CONTENT_WORD_THRESHOLD && page.statusCode === 200) {
      issues.push(this.createThinContentIssue(page.url, wordCount));
    }

    // Check for potential duplicate pages based on title + description
    const duplicates = this.findPotentialDuplicates(page, allPages);
    if (duplicates.length > 0) {
      issues.push(this.createDuplicateContentIssue(page.url, duplicates));
    }

    // Check for URL variations (with/without trailing slash, www/non-www)
    const urlVariations = this.findUrlVariations(page.url, allPages);
    if (urlVariations.length > 0) {
      issues.push(this.createUrlVariationIssue(page.url, urlVariations));
    }

    return { issues };
  }

  private estimateWordCount(html: string): number {
    // Strip HTML tags and count words
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!text) return 0;
    return text.split(' ').filter(w => w.length > 0).length;
  }

  private findPotentialDuplicates(page: CrawledPage, allPages: CrawledPage[]): CrawledPage[] {
    if (!page.title || !page.metaDescription) return [];

    return allPages.filter(p => {
      if (p.url === page.url) return false;
      
      // Same title AND same description = likely duplicate
      const sameTitle = p.title === page.title;
      const sameDescription = p.metaDescription === page.metaDescription;
      
      return sameTitle && sameDescription;
    });
  }

  private findUrlVariations(url: string, allPages: CrawledPage[]): CrawledPage[] {
    try {
      const currentUrl = new URL(url);
      const variations: CrawledPage[] = [];

      for (const page of allPages) {
        if (page.url === url) continue;

        try {
          const otherUrl = new URL(page.url);

          // Check if it's the same page with/without trailing slash
          const currentPath = currentUrl.pathname.replace(/\/$/, '');
          const otherPath = otherUrl.pathname.replace(/\/$/, '');

          if (
            currentUrl.hostname === otherUrl.hostname &&
            currentPath === otherPath &&
            currentUrl.pathname !== otherUrl.pathname
          ) {
            variations.push(page);
          }

          // Check for www/non-www variation
          const currentHost = currentUrl.hostname.replace(/^www\./, '');
          const otherHost = otherUrl.hostname.replace(/^www\./, '');

          if (
            currentHost === otherHost &&
            currentUrl.hostname !== otherUrl.hostname &&
            currentUrl.pathname === otherUrl.pathname
          ) {
            variations.push(page);
          }
        } catch {
          continue;
        }
      }

      return variations;
    } catch {
      return [];
    }
  }

  private createThinContentIssue(url: string, wordCount: number): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.DUPLICATE_CONTENT,
      severity: wordCount < 100 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
      title: 'Thin content detected',
      description: `This page has only approximately ${wordCount} words, which may be considered thin content.`,
      affectedUrls: [url],
      details: { wordCount, threshold: THIN_CONTENT_WORD_THRESHOLD },
      impact: {
        summary: 'Pages with little content may struggle to rank.',
        seoEffect: 'Thin content pages may be seen as low-quality by search engines, potentially affecting site-wide quality signals.',
        userEffect: 'Users may not find enough information to satisfy their search intent.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Add more valuable content or consolidate with other pages.',
        steps: [
          'Evaluate if this page serves a valid user purpose',
          'If yes, expand content to comprehensively cover the topic',
          'If no, consider merging with a related page or removing',
          `Aim for at least ${THIN_CONTENT_WORD_THRESHOLD} words of unique, valuable content`,
          'Focus on quality over quantity - content should be genuinely useful',
        ],
      },
    };
  }

  private createDuplicateContentIssue(url: string, duplicates: CrawledPage[]): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.DUPLICATE_CONTENT,
      severity: IssueSeverity.HIGH,
      title: 'Potential duplicate content',
      description: `This page shares the same title and meta description with ${duplicates.length} other page(s).`,
      affectedUrls: [url, ...duplicates.map(p => p.url)],
      details: { duplicateUrls: duplicates.map(p => p.url) },
      impact: {
        summary: 'Duplicate content causes search engines to choose which version to index.',
        seoEffect: 'Search engines may pick the wrong version to index, or split signals between duplicates, diluting ranking potential.',
        userEffect: 'Users may land on different versions of the same content.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Differentiate the content or use canonical tags.',
        steps: [
          'Determine if these pages should be separate or consolidated',
          'If they should be different, make titles and content unique',
          'If they should be the same, choose one as canonical and redirect others',
          'Use canonical tags to specify the preferred version',
        ],
        codeExamples: [
          {
            language: 'html',
            label: 'Set canonical to preferred version',
            code: '<link rel="canonical" href="https://example.com/preferred-url/">',
          },
          {
            language: 'nginx',
            label: '301 redirect duplicate to canonical',
            code: 'rewrite ^/duplicate-page$ /canonical-page permanent;',
          },
        ],
      },
    };
  }

  private createUrlVariationIssue(url: string, variations: CrawledPage[]): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.DUPLICATE_CONTENT,
      severity: IssueSeverity.MEDIUM,
      title: 'URL variations detected',
      description: `Multiple URL variations of this page were found (e.g., with/without trailing slash or www).`,
      affectedUrls: [url, ...variations.map(p => p.url)],
      details: { variations: variations.map(p => p.url) },
      impact: {
        summary: 'URL variations can split PageRank and cause indexing issues.',
        seoEffect: 'Search engines may index multiple variations, diluting ranking signals between them.',
        userEffect: 'Users may bookmark or share different URLs for the same content.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Standardize on one URL format and redirect others.',
        steps: [
          'Choose a preferred URL format (with or without trailing slash, www or non-www)',
          'Implement 301 redirects from non-preferred to preferred format',
          'Add canonical tags pointing to the preferred URL',
          'Update internal links to use the preferred format',
        ],
        codeExamples: [
          {
            language: 'nginx',
            label: 'Redirect to consistent format (no trailing slash)',
            code: 'rewrite ^/(.*)/$ /$1 permanent;',
          },
          {
            language: 'htaccess',
            label: 'Redirect www to non-www',
            code: 'RewriteEngine On\nRewriteCond %{HTTP_HOST} ^www\\.(.*)$ [NC]\nRewriteRule ^(.*)$ https://%1/$1 [R=301,L]',
          },
        ],
      },
    };
  }
}
