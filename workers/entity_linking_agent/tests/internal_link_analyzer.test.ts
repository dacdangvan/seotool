/**
 * Internal Link Analyzer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InternalLinkAnalyzer } from '../src/internal_link_analyzer';
import { ContentHealth, ContentItem } from '../src/models';
import { loadConfig } from '../src/config';
import pino from 'pino';

const logger = pino({ level: 'silent' });
const config = loadConfig();

describe('InternalLinkAnalyzer', () => {
  let analyzer: InternalLinkAnalyzer;

  beforeEach(() => {
    analyzer = new InternalLinkAnalyzer(config, logger);
  });

  const createMockContent = (
    id: string,
    url: string,
    content: string,
    internalLinks: Array<{ href: string; anchorText: string }> = []
  ): ContentItem => ({
    id,
    url,
    title: `Test ${id}`,
    content,
    primaryKeyword: 'test keyword',
    internalLinks,
  });

  describe('parseContent', () => {
    it('should extract text content from HTML', () => {
      const items = [
        createMockContent(
          '1',
          'https://example.com/page1',
          '<p>This is paragraph one.</p><p>This is paragraph two.</p>'
        ),
      ];

      const parsed = analyzer.parseContent(items, 'https://example.com');

      expect(parsed[0].textContent).toContain('This is paragraph one');
      expect(parsed[0].textContent).toContain('This is paragraph two');
    });

    it('should extract existing links from HTML', () => {
      const items = [
        createMockContent(
          '1',
          'https://example.com/page1',
          '<a href="/page2">Link to page 2</a><a href="https://external.com">External</a>'
        ),
      ];

      const parsed = analyzer.parseContent(items, 'https://example.com');

      // Should only include internal links
      const internalLinks = parsed[0].existingLinks.filter(
        l => l.targetUrl.includes('example.com')
      );
      expect(internalLinks.length).toBe(1);
      expect(internalLinks[0].anchorText).toBe('Link to page 2');
    });

    it('should use pre-extracted links when available', () => {
      const items = [
        createMockContent(
          '1',
          'https://example.com/page1',
          '<p>Content</p>',
          [{ href: 'https://example.com/page2', anchorText: 'Page 2' }]
        ),
      ];

      const parsed = analyzer.parseContent(items, 'https://example.com');

      expect(parsed[0].existingLinks.length).toBe(1);
      expect(parsed[0].existingLinks[0].anchorText).toBe('Page 2');
    });

    it('should count words correctly', () => {
      const items = [
        createMockContent(
          '1',
          'https://example.com/page1',
          '<p>One two three four five</p>'
        ),
      ];

      const parsed = analyzer.parseContent(items, 'https://example.com');

      expect(parsed[0].wordCount).toBe(5);
    });
  });

  describe('analyze', () => {
    it('should identify orphan content', () => {
      const items = [
        createMockContent(
          '1',
          'https://example.com/page1',
          '<p>Page 1</p><a href="/page2">Link</a>',
        ),
        createMockContent(
          '2',
          'https://example.com/page2',
          '<p>Page 2</p>',
        ),
        createMockContent(
          '3',
          'https://example.com/page3',
          '<p>Orphan page with no incoming links</p>',
        ),
      ];

      const parsed = analyzer.parseContent(items, 'https://example.com');
      
      // Resolve target IDs
      for (const content of parsed) {
        for (const link of content.existingLinks) {
          const target = parsed.find(p => p.item.url === link.targetUrl);
          if (target) {
            link.targetContentId = target.item.id;
          }
        }
      }

      const { analysis } = analyzer.analyze(parsed);

      // Page 3 should be orphan
      const page3Analysis = analysis.find(a => a.contentId === '3');
      expect(page3Analysis?.health).toBe(ContentHealth.ORPHAN);
    });

    it('should calculate incoming and outgoing link counts', () => {
      const items = [
        createMockContent(
          '1',
          'https://example.com/page1',
          '<p>Content</p>',
          [
            { href: 'https://example.com/page2', anchorText: 'Page 2' },
            { href: 'https://example.com/page3', anchorText: 'Page 3' },
          ]
        ),
        createMockContent('2', 'https://example.com/page2', '<p>Page 2</p>'),
        createMockContent('3', 'https://example.com/page3', '<p>Page 3</p>'),
      ];

      const parsed = analyzer.parseContent(items, 'https://example.com');
      
      for (const content of parsed) {
        for (const link of content.existingLinks) {
          const target = parsed.find(p => p.item.url === link.targetUrl);
          if (target) {
            link.targetContentId = target.item.id;
          }
        }
      }

      const { analysis } = analyzer.analyze(parsed);

      const page1 = analysis.find(a => a.contentId === '1');
      expect(page1?.outgoingLinks).toBe(2);

      const page2 = analysis.find(a => a.contentId === '2');
      expect(page2?.incomingLinks).toBe(1);
    });

    it('should detect link issues', () => {
      const items = [
        createMockContent(
          '1',
          'https://example.com/page1',
          '<p>Orphan content</p>',
        ),
      ];

      const parsed = analyzer.parseContent(items, 'https://example.com');
      const { analysis } = analyzer.analyze(parsed);

      const page1 = analysis.find(a => a.contentId === '1');
      expect(page1?.issues.length).toBeGreaterThan(0);
      expect(page1?.issues.some(i => i.type === 'orphan')).toBe(true);
    });

    it('should suggest links to related content', async () => {
      const items = [
        createMockContent('1', 'https://example.com/seo-guide', '<p>SEO Guide</p>'),
        createMockContent('2', 'https://example.com/seo-tips', '<p>SEO Tips</p>'),
      ];
      items[0].primaryKeyword = 'SEO guide';
      items[0].supportingKeywords = ['SEO tips'];
      items[1].primaryKeyword = 'SEO tips';
      items[1].supportingKeywords = ['SEO guide'];

      const parsed = analyzer.parseContent(items, 'https://example.com');
      const { analysis } = analyzer.analyze(parsed);

      // Both should suggest linking to each other due to keyword overlap
      const page1 = analysis.find(a => a.contentId === '1');
      const page2 = analysis.find(a => a.contentId === '2');

      // At least one should suggest the other
      const hasSuggestions = 
        (page1?.suggestedLinksTo.includes('2') || false) ||
        (page2?.suggestedLinksTo.includes('1') || false) ||
        (page1?.suggestedLinksFrom.includes('2') || false) ||
        (page2?.suggestedLinksFrom.includes('1') || false);
      expect(hasSuggestions).toBe(true);
    });
  });
});
