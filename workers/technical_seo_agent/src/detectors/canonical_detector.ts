/**
 * Canonical Detector
 * Detects issues related to canonical URLs
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

export class CanonicalDetector implements Detector {
  readonly name = 'CanonicalDetector';

  detect(context: DetectorContext): DetectorResult {
    const issues: SEOIssue[] = [];
    const { page, allPages } = context;

    // Check for missing canonical
    if (!page.canonicalUrl) {
      issues.push(this.createMissingCanonicalIssue(page.url));
    } else {
      // Check for self-referencing canonical (this is actually good)
      const normalizedCanonical = this.normalizeUrl(page.canonicalUrl);
      const normalizedPage = this.normalizeUrl(page.url);

      // Check for canonical pointing to different domain
      try {
        const canonicalDomain = new URL(page.canonicalUrl).hostname;
        const pageDomain = new URL(page.url).hostname;
        
        if (canonicalDomain !== pageDomain) {
          issues.push(this.createCrossdomainCanonicalIssue(page.url, page.canonicalUrl));
        }
      } catch {
        issues.push(this.createInvalidCanonicalIssue(page.url, page.canonicalUrl));
      }

      // Check for relative canonical (should be absolute)
      if (!page.canonicalUrl.startsWith('http://') && !page.canonicalUrl.startsWith('https://')) {
        issues.push(this.createRelativeCanonicalIssue(page.url, page.canonicalUrl));
      }

      // Check for canonical pointing to non-existent page
      const canonicalExists = allPages.some(
        p => this.normalizeUrl(p.url) === normalizedCanonical
      );
      
      if (normalizedCanonical !== normalizedPage && !canonicalExists) {
        // Only flag if we've crawled enough to know
        issues.push(this.createBrokenCanonicalIssue(page.url, page.canonicalUrl));
      }
    }

    // Check for canonical chains (A → B → C)
    this.detectCanonicalChains(allPages, issues);

    return { issues };
  }

  private detectCanonicalChains(allPages: CrawledPage[], issues: SEOIssue[]): void {
    const canonicalMap = new Map<string, string>();
    
    for (const page of allPages) {
      if (page.canonicalUrl) {
        canonicalMap.set(this.normalizeUrl(page.url), this.normalizeUrl(page.canonicalUrl));
      }
    }

    // Find chains
    for (const [pageUrl, canonicalUrl] of canonicalMap) {
      if (pageUrl === canonicalUrl) continue; // Self-referencing is fine
      
      const secondCanonical = canonicalMap.get(canonicalUrl);
      if (secondCanonical && secondCanonical !== canonicalUrl) {
        // Found a chain: pageUrl → canonicalUrl → secondCanonical
        issues.push(this.createCanonicalChainIssue(pageUrl, canonicalUrl, secondCanonical));
      }
    }
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
      }
      urlObj.hash = '';
      return urlObj.href.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  private createMissingCanonicalIssue(url: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.CANONICAL,
      severity: IssueSeverity.MEDIUM,
      title: 'Missing canonical tag',
      description: 'The page does not have a canonical URL specified.',
      affectedUrls: [url],
      details: {},
      impact: {
        summary: 'Without a canonical tag, search engines must guess which version of the page to index.',
        seoEffect: 'Risk of duplicate content issues if the page is accessible via multiple URLs (with/without trailing slash, with query parameters, etc.).',
        userEffect: 'No direct user impact.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Add a self-referencing canonical tag to the page.',
        steps: [
          'Add a canonical link element in the <head> section',
          'Use the absolute URL of the page',
          'Ensure the canonical URL is the preferred version',
        ],
        codeExamples: [
          {
            language: 'html',
            label: 'Add canonical tag',
            code: '<link rel="canonical" href="https://example.com/page/">',
          },
          {
            language: 'nextjs',
            label: 'Next.js Head component',
            code: 'import Head from "next/head";\n\nexport default function Page() {\n  return (\n    <Head>\n      <link rel="canonical" href="https://example.com/page/" />\n    </Head>\n  );\n}',
          },
        ],
      },
    };
  }

  private createCrossdomainCanonicalIssue(url: string, canonical: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.CANONICAL,
      severity: IssueSeverity.HIGH,
      title: 'Cross-domain canonical detected',
      description: `The page has a canonical pointing to a different domain: ${canonical}`,
      affectedUrls: [url],
      details: { canonical },
      impact: {
        summary: 'This page is telling search engines to index a different domain\'s page instead.',
        seoEffect: 'The current page will likely be excluded from the index in favor of the canonical target. This is only correct for syndicated or mirrored content.',
        userEffect: 'No direct impact, but organic traffic will go to the canonical target.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Verify if cross-domain canonical is intentional. If not, update to point to this domain.',
        steps: [
          'Confirm whether this is intentional (content syndication)',
          'If unintentional, update the canonical to the correct URL on this domain',
          'If intentional, no action needed',
        ],
      },
    };
  }

  private createRelativeCanonicalIssue(url: string, canonical: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.CANONICAL,
      severity: IssueSeverity.MEDIUM,
      title: 'Relative canonical URL',
      description: `The canonical tag uses a relative URL: ${canonical}`,
      affectedUrls: [url],
      details: { canonical },
      impact: {
        summary: 'Relative canonical URLs can cause issues in some edge cases.',
        seoEffect: 'While browsers will resolve relative URLs, using absolute URLs is best practice and avoids potential issues with URL resolution.',
        userEffect: 'No direct impact.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Use absolute URLs in canonical tags.',
        steps: [
          'Update the canonical tag to use the full absolute URL including protocol',
        ],
        codeExamples: [
          {
            language: 'html',
            label: 'Use absolute URL',
            code: '<!-- Change from: -->\n<link rel="canonical" href="/page/">\n\n<!-- To: -->\n<link rel="canonical" href="https://example.com/page/">',
          },
        ],
      },
    };
  }

  private createInvalidCanonicalIssue(url: string, canonical: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.CANONICAL,
      severity: IssueSeverity.HIGH,
      title: 'Invalid canonical URL',
      description: `The canonical URL is malformed and cannot be parsed: ${canonical}`,
      affectedUrls: [url],
      details: { canonical },
      impact: {
        summary: 'Search engines cannot understand an invalid canonical URL.',
        seoEffect: 'The canonical tag will likely be ignored, potentially causing duplicate content issues.',
        userEffect: 'No direct impact.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Fix the malformed canonical URL.',
        steps: [
          'Review and correct the canonical URL format',
          'Ensure it\'s a valid absolute URL',
        ],
      },
    };
  }

  private createBrokenCanonicalIssue(url: string, canonical: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.CANONICAL,
      severity: IssueSeverity.HIGH,
      title: 'Canonical points to non-indexable page',
      description: `The canonical URL may not be accessible or indexable: ${canonical}`,
      affectedUrls: [url],
      details: { canonical },
      impact: {
        summary: 'Pointing canonical to a broken or non-indexable page causes indexing problems.',
        seoEffect: 'Search engines may ignore the canonical signal or fail to index either page properly.',
        userEffect: 'No direct impact.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Update the canonical to point to a valid, indexable page.',
        steps: [
          'Verify the canonical target URL is accessible (returns 200)',
          'Ensure the target page does not have noindex',
          'Update the canonical URL if needed',
        ],
      },
    };
  }

  private createCanonicalChainIssue(pageUrl: string, firstCanonical: string, secondCanonical: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.CANONICAL,
      severity: IssueSeverity.HIGH,
      title: 'Canonical chain detected',
      description: `Found a canonical chain: this page → ${firstCanonical} → ${secondCanonical}`,
      affectedUrls: [pageUrl],
      details: { chain: [pageUrl, firstCanonical, secondCanonical] },
      impact: {
        summary: 'Canonical chains can confuse search engines and dilute signals.',
        seoEffect: 'While Google says they follow chains, it\'s not guaranteed and adds processing complexity. It\'s better to point directly to the final canonical.',
        userEffect: 'No direct impact.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Point canonical directly to the final target URL.',
        steps: [
          `Update this page's canonical to point directly to: ${secondCanonical}`,
          'Audit other pages for similar chains',
        ],
      },
    };
  }
}
