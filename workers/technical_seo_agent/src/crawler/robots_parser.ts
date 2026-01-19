/**
 * Robots.txt Parser
 * Respects robots.txt rules for crawling
 */

import robotsParser, { Robot } from 'robots-parser';
import { Logger } from '../logger';

export interface RobotsChecker {
  isAllowed(url: string): boolean;
  getCrawlDelay(): number | undefined;
  getSitemaps(): string[];
}

export async function fetchRobotsTxt(
  baseUrl: string,
  logger: Logger
): Promise<RobotsChecker> {
  const robotsUrl = new URL('/robots.txt', baseUrl).href;
  let robotsTxt = '';

  try {
    const response = await fetch(robotsUrl, {
      headers: {
        'User-Agent': 'SEOTool-TechnicalAudit/0.4',
      },
    });

    if (response.ok) {
      robotsTxt = await response.text();
      logger.debug({ url: robotsUrl }, 'Fetched robots.txt');
    } else {
      logger.debug(
        { url: robotsUrl, status: response.status },
        'No robots.txt found, allowing all'
      );
    }
  } catch (error) {
    logger.warn({ url: robotsUrl, error }, 'Failed to fetch robots.txt');
  }

  const robot = robotsParser(robotsUrl, robotsTxt);
  const userAgent = 'SEOTool-TechnicalAudit';

  return {
    isAllowed(url: string): boolean {
      return robot.isAllowed(url, userAgent) ?? true;
    },

    getCrawlDelay(): number | undefined {
      const delay = robot.getCrawlDelay(userAgent);
      return delay ? delay * 1000 : undefined; // Convert to milliseconds
    },

    getSitemaps(): string[] {
      return robot.getSitemaps();
    },
  };
}

/**
 * Check if a URL is allowed to be crawled based on robots.txt
 */
export function isUrlAllowed(
  url: string,
  robotsChecker: RobotsChecker | null,
  respectRobots: boolean
): boolean {
  if (!respectRobots || !robotsChecker) {
    return true;
  }
  return robotsChecker.isAllowed(url);
}
