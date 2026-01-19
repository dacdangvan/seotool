/**
 * Unit Tests for Technical SEO Agent Detectors
 */

import { describe, it, expect } from 'vitest';
import { IndexingDetector } from '../src/detectors/indexing_detector';
import { CanonicalDetector } from '../src/detectors/canonical_detector';
import { MetaDetector } from '../src/detectors/meta_detector';
import { HeadingDetector } from '../src/detectors/heading_detector';
import { LinkDetector } from '../src/detectors/link_detector';
import { DuplicateDetector } from '../src/detectors/duplicate_detector';
import {
  CrawledPage,
  IssueCategory,
  IssueSeverity,
  DetectorContext,
  RenderMode,
} from '../src/models';

// Helper to create a mock crawled page
function createMockPage(overrides: Partial<CrawledPage> = {}): CrawledPage {
  return {
    url: 'https://example.com/test',
    statusCode: 200,
    contentType: 'text/html',
    html: '<html><head><title>Test</title></head><body><h1>Test</h1></body></html>',
    title: 'Test Page',
    metaDescription: 'A test page description for testing purposes.',
    metaRobots: null,
    canonicalUrl: 'https://example.com/test',
    h1: ['Test Heading'],
    h2: ['Subheading 1', 'Subheading 2'],
    h3: [],
    internalLinks: ['https://example.com/page1', 'https://example.com/page2'],
    externalLinks: ['https://external.com/link'],
    responseTimeMs: 200,
    contentLength: 1000,
    depth: 0,
    crawledAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a detector context
function createContext(page: CrawledPage, allPages: CrawledPage[] = []): DetectorContext {
  return {
    page,
    allPages: allPages.length > 0 ? allPages : [page],
    robotsTxt: null,
    config: {
      id: 'test-task',
      planId: 'test-plan',
      targetUrl: 'https://example.com',
      crawlDepth: 2,
      maxPages: 20,
      renderMode: RenderMode.HTML,
      respectRobotsTxt: true,
      rateLimit: 1000,
      includeCoreWebVitals: false,
    },
  };
}

describe('IndexingDetector', () => {
  const detector = new IndexingDetector();

  it('detects noindex in meta robots', () => {
    const page = createMockPage({ metaRobots: 'noindex, follow' });
    const result = detector.detect(createContext(page));

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].category).toBe(IssueCategory.INDEXING);
    expect(result.issues[0].severity).toBe(IssueSeverity.CRITICAL);
    expect(result.issues[0].title).toContain('noindex');
  });

  it('detects nofollow in meta robots', () => {
    const page = createMockPage({ metaRobots: 'index, nofollow' });
    const result = detector.detect(createContext(page));

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].title).toContain('nofollow');
    expect(result.issues[0].severity).toBe(IssueSeverity.MEDIUM);
  });

  it('detects 404 errors', () => {
    const page = createMockPage({ statusCode: 404 });
    const result = detector.detect(createContext(page));

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe(IssueSeverity.HIGH);
  });

  it('detects 500 errors', () => {
    const page = createMockPage({ statusCode: 500 });
    const result = detector.detect(createContext(page));

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe(IssueSeverity.CRITICAL);
  });

  it('passes clean page', () => {
    const page = createMockPage();
    const result = detector.detect(createContext(page));

    expect(result.issues).toHaveLength(0);
  });
});

describe('CanonicalDetector', () => {
  const detector = new CanonicalDetector();

  it('detects missing canonical', () => {
    const page = createMockPage({ canonicalUrl: null });
    const result = detector.detect(createContext(page));

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].category).toBe(IssueCategory.CANONICAL);
    expect(result.issues[0].title).toContain('Missing');
  });

  it('detects relative canonical URL', () => {
    const page = createMockPage({ canonicalUrl: '/test-page' });
    const result = detector.detect(createContext(page));

    const relativeIssue = result.issues.find(i => i.title.includes('Relative'));
    expect(relativeIssue).toBeDefined();
  });

  it('detects cross-domain canonical', () => {
    const page = createMockPage({
      url: 'https://example.com/page',
      canonicalUrl: 'https://otherdomain.com/page',
    });
    const result = detector.detect(createContext(page));

    const crossDomainIssue = result.issues.find(i => i.title.includes('Cross-domain'));
    expect(crossDomainIssue).toBeDefined();
    expect(crossDomainIssue?.severity).toBe(IssueSeverity.HIGH);
  });

  it('passes self-referencing canonical', () => {
    const page = createMockPage({
      url: 'https://example.com/test',
      canonicalUrl: 'https://example.com/test',
    });
    const result = detector.detect(createContext(page));

    expect(result.issues).toHaveLength(0);
  });
});

describe('MetaDetector', () => {
  const detector = new MetaDetector();

  it('detects missing title', () => {
    const page = createMockPage({ title: null });
    const result = detector.detect(createContext(page));

    const titleIssue = result.issues.find(i => i.title.includes('Missing page title'));
    expect(titleIssue).toBeDefined();
    expect(titleIssue?.severity).toBe(IssueSeverity.CRITICAL);
  });

  it('detects short title', () => {
    const page = createMockPage({ title: 'Short' });
    const result = detector.detect(createContext(page));

    const shortIssue = result.issues.find(i => i.title.includes('too short'));
    expect(shortIssue).toBeDefined();
  });

  it('detects long title', () => {
    const page = createMockPage({
      title: 'This is a very long title that exceeds the recommended maximum length for SEO purposes and will be truncated in search results',
    });
    const result = detector.detect(createContext(page));

    const longIssue = result.issues.find(i => i.title.includes('too long'));
    expect(longIssue).toBeDefined();
  });

  it('detects missing description', () => {
    const page = createMockPage({ metaDescription: null });
    const result = detector.detect(createContext(page));

    const descIssue = result.issues.find(i => i.title.includes('Missing meta description'));
    expect(descIssue).toBeDefined();
    expect(descIssue?.severity).toBe(IssueSeverity.MEDIUM);
  });

  it('detects duplicate titles across pages', () => {
    const page1 = createMockPage({ url: 'https://example.com/page1', title: 'Duplicate Title' });
    const page2 = createMockPage({ url: 'https://example.com/page2', title: 'Duplicate Title' });

    const result = detector.detect(createContext(page1, [page1, page2]));

    const dupIssue = result.issues.find(i => i.title.includes('Duplicate page title'));
    expect(dupIssue).toBeDefined();
  });

  it('passes good title and description', () => {
    const page = createMockPage({
      title: 'A Good Page Title That Is Just Right',
      metaDescription: 'A well-written meta description that provides valuable information about the page content and encourages users to click.',
    });
    const result = detector.detect(createContext(page));

    expect(result.issues).toHaveLength(0);
  });
});

describe('HeadingDetector', () => {
  const detector = new HeadingDetector();

  it('detects missing H1', () => {
    const page = createMockPage({ h1: [] });
    const result = detector.detect(createContext(page));

    const h1Issue = result.issues.find(i => i.title.includes('Missing H1'));
    expect(h1Issue).toBeDefined();
    expect(h1Issue?.severity).toBe(IssueSeverity.HIGH);
  });

  it('detects multiple H1s', () => {
    const page = createMockPage({ h1: ['Heading 1', 'Heading 2'] });
    const result = detector.detect(createContext(page));

    const multiH1Issue = result.issues.find(i => i.title.includes('Multiple H1'));
    expect(multiH1Issue).toBeDefined();
  });

  it('detects empty H1', () => {
    const page = createMockPage({ h1: [''] });
    const result = detector.detect(createContext(page));

    const emptyIssue = result.issues.find(i => i.title.includes('Empty H1'));
    expect(emptyIssue).toBeDefined();
  });

  it('detects missing subheadings', () => {
    const page = createMockPage({ h1: ['Main Heading'], h2: [] });
    const result = detector.detect(createContext(page));

    const noSubIssue = result.issues.find(i => i.title.includes('No subheadings'));
    expect(noSubIssue).toBeDefined();
  });

  it('passes good heading structure', () => {
    const page = createMockPage({
      h1: ['Main Heading'],
      h2: ['Section 1', 'Section 2'],
      h3: ['Subsection'],
    });
    const result = detector.detect(createContext(page));

    expect(result.issues).toHaveLength(0);
  });
});

describe('LinkDetector', () => {
  const detector = new LinkDetector();

  it('detects orphan pages', () => {
    const page = createMockPage({ url: 'https://example.com/orphan' });
    const otherPage = createMockPage({
      url: 'https://example.com/other',
      internalLinks: ['https://example.com/somewhere-else'],
    });

    const result = detector.detect(createContext(page, [page, otherPage]));

    const orphanIssue = result.issues.find(i => i.title.includes('Orphan'));
    expect(orphanIssue).toBeDefined();
  });

  it('detects too many links', () => {
    const manyLinks = Array.from({ length: 150 }, (_, i) => `https://example.com/link${i}`);
    const page = createMockPage({ internalLinks: manyLinks });
    const result = detector.detect(createContext(page));

    const tooManyIssue = result.issues.find(i => i.title.includes('excessive links'));
    expect(tooManyIssue).toBeDefined();
  });

  it('detects broken internal links', () => {
    const goodPage = createMockPage({
      url: 'https://example.com/good',
      internalLinks: ['https://example.com/broken'],
    });
    const brokenPage = createMockPage({
      url: 'https://example.com/broken',
      statusCode: 404,
    });

    const result = detector.detect(createContext(goodPage, [goodPage, brokenPage]));

    const brokenIssue = result.issues.find(i => i.title.includes('broken'));
    expect(brokenIssue).toBeDefined();
  });
});

describe('DuplicateDetector', () => {
  const detector = new DuplicateDetector();

  it('detects thin content', () => {
    const page = createMockPage({
      html: '<html><body><p>Very short content</p></body></html>',
    });
    const result = detector.detect(createContext(page));

    const thinIssue = result.issues.find(i => i.title.includes('Thin content'));
    expect(thinIssue).toBeDefined();
  });

  it('detects potential duplicates based on title and description', () => {
    const page1 = createMockPage({
      url: 'https://example.com/page1',
      title: 'Same Title',
      metaDescription: 'Same description',
    });
    const page2 = createMockPage({
      url: 'https://example.com/page2',
      title: 'Same Title',
      metaDescription: 'Same description',
    });

    const result = detector.detect(createContext(page1, [page1, page2]));

    const dupIssue = result.issues.find(i => i.title.includes('duplicate content'));
    expect(dupIssue).toBeDefined();
  });
});
