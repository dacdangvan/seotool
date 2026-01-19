/**
 * Link Detector
 * Detects broken internal links and link-related issues
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

export class LinkDetector implements Detector {
  readonly name = 'LinkDetector';

  detect(context: DetectorContext): DetectorResult {
    const issues: SEOIssue[] = [];
    const { page, allPages } = context;

    // Build a set of all crawled URLs for quick lookup
    const crawledUrls = new Set(allPages.map(p => this.normalizeUrl(p.url)));

    // Check for broken internal links
    const brokenLinks = this.findBrokenInternalLinks(page, crawledUrls, allPages);
    if (brokenLinks.length > 0) {
      issues.push(this.createBrokenLinksIssue(page.url, brokenLinks));
    }

    // Check for orphan pages (no internal links pointing to them)
    const isOrphan = this.checkIfOrphan(page.url, allPages);
    if (isOrphan) {
      issues.push(this.createOrphanPageIssue(page.url));
    }

    // Check for pages with too many links
    const totalLinks = page.internalLinks.length + page.externalLinks.length;
    if (totalLinks > 100) {
      issues.push(this.createTooManyLinksIssue(page.url, totalLinks));
    }

    // Check for pages with no internal links
    if (page.internalLinks.length === 0 && page.depth === 0) {
      issues.push(this.createNoInternalLinksIssue(page.url));
    }

    return { issues };
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
      }
      urlObj.hash = '';
      urlObj.search = ''; // Normalize query strings
      return urlObj.href.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  private findBrokenInternalLinks(
    page: CrawledPage,
    crawledUrls: Set<string>,
    allPages: CrawledPage[]
  ): Array<{ url: string; statusCode?: number }> {
    const brokenLinks: Array<{ url: string; statusCode?: number }> = [];

    for (const link of page.internalLinks) {
      const normalizedLink = this.normalizeUrl(link);
      
      // Check if we crawled this URL
      if (crawledUrls.has(normalizedLink)) {
        // Check if the page returned an error status
        const linkedPage = allPages.find(p => this.normalizeUrl(p.url) === normalizedLink);
        if (linkedPage && linkedPage.statusCode >= 400) {
          brokenLinks.push({ url: link, statusCode: linkedPage.statusCode });
        }
      }
      // Note: We only check URLs we've crawled. URLs not crawled could be 
      // outside crawl depth or blocked by robots.txt
    }

    return brokenLinks;
  }

  private checkIfOrphan(pageUrl: string, allPages: CrawledPage[]): boolean {
    const normalizedPageUrl = this.normalizeUrl(pageUrl);
    
    // Check if any other page links to this page
    for (const otherPage of allPages) {
      if (this.normalizeUrl(otherPage.url) === normalizedPageUrl) continue;
      
      for (const link of otherPage.internalLinks) {
        if (this.normalizeUrl(link) === normalizedPageUrl) {
          return false; // Found an incoming link
        }
      }
    }
    
    return true; // No incoming links found
  }

  private createBrokenLinksIssue(sourceUrl: string, brokenLinks: Array<{ url: string; statusCode?: number }>): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.BROKEN_LINKS,
      severity: brokenLinks.length > 5 ? IssueSeverity.HIGH : IssueSeverity.MEDIUM,
      title: `${brokenLinks.length} broken internal link(s)`,
      description: `This page contains ${brokenLinks.length} link(s) to pages that return error status codes.`,
      affectedUrls: [sourceUrl],
      details: { brokenLinks },
      impact: {
        summary: 'Broken links waste crawl budget and harm user experience.',
        seoEffect: 'Search engines may interpret many broken links as a sign of poor site quality. Link equity is lost on 404 pages.',
        userEffect: 'Users encounter dead ends, leading to frustration and increased bounce rate.',
        ranking: 'direct',
      },
      fix: {
        summary: 'Fix or remove broken links.',
        steps: [
          'Review the list of broken URLs',
          'For each broken link, either:',
          '  - Fix the target page if it should exist',
          '  - Update the link to point to a valid page',
          '  - Remove the link entirely',
          'Set up 301 redirects for permanently moved content',
        ],
      },
    };
  }

  private createOrphanPageIssue(url: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.BROKEN_LINKS,
      severity: IssueSeverity.MEDIUM,
      title: 'Orphan page detected',
      description: 'This page has no internal links pointing to it from other pages on the site.',
      affectedUrls: [url],
      details: {},
      impact: {
        summary: 'Orphan pages are hard for search engines and users to discover.',
        seoEffect: 'Without internal links, this page receives no PageRank from other pages and may be considered low-importance.',
        userEffect: 'Users can only find this page through direct URL, external links, or search engines.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Add internal links from relevant pages.',
        steps: [
          'Identify pages with related content',
          'Add contextual links from those pages to this one',
          'Consider adding the page to site navigation if appropriate',
          'Add to relevant category or tag pages',
        ],
      },
    };
  }

  private createTooManyLinksIssue(url: string, linkCount: number): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.BROKEN_LINKS,
      severity: IssueSeverity.LOW,
      title: 'Page has excessive links',
      description: `This page contains ${linkCount} links. Consider keeping links under 100 per page.`,
      affectedUrls: [url],
      details: { linkCount },
      impact: {
        summary: 'Too many links can dilute PageRank and overwhelm users.',
        seoEffect: 'While Google can handle many links, the PageRank passed to each linked page decreases as total links increase.',
        userEffect: 'Pages with too many links can be overwhelming and hard to navigate.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Reduce the number of links or spread them across multiple pages.',
        steps: [
          'Review all links and remove those that don\'t add value',
          'Consider using pagination for long lists',
          'Consolidate related links into fewer, more targeted links',
          'Use rel="nofollow" for non-essential links if needed',
        ],
      },
    };
  }

  private createNoInternalLinksIssue(url: string): SEOIssue {
    return {
      id: uuid(),
      category: IssueCategory.BROKEN_LINKS,
      severity: IssueSeverity.LOW,
      title: 'Homepage has no internal links',
      description: 'The homepage (or entry point) has no internal links to other pages.',
      affectedUrls: [url],
      details: {},
      impact: {
        summary: 'Pages without internal links cannot distribute PageRank.',
        seoEffect: 'This page cannot pass authority to other pages on the site, limiting their ranking potential.',
        userEffect: 'Users have no way to navigate to other parts of the site from this page.',
        ranking: 'indirect',
      },
      fix: {
        summary: 'Add internal links to important pages.',
        steps: [
          'Add navigation linking to key sections',
          'Include links to important content within the page body',
          'Ensure the page serves as a proper hub for the site',
        ],
      },
    };
  }
}
