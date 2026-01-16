/**
 * Task Template Configuration
 * Externalized from TaskPlannerService for flexibility
 * 
 * In production, these could be loaded from:
 * - Database
 * - Configuration file
 * - Admin API
 */

import { GoalType, TaskType, TaskPriority } from '../domain/index.js';

export interface TaskTemplate {
  type: TaskType;
  name: string;
  description: string;
  priority: TaskPriority;
  timeoutMs: number;
  maxRetries: number;
  dependsOn?: TaskType[];
}

export interface GoalTaskTemplates {
  [key: string]: TaskTemplate[];
}

/**
 * Default task templates per goal type
 * Can be overridden via configuration
 */
export const DEFAULT_GOAL_TASK_TEMPLATES: Record<GoalType, TaskTemplate[]> = {
  [GoalType.TRAFFIC]: [
    {
      type: TaskType.KEYWORD_ANALYSIS,
      name: 'Keyword Research & Analysis',
      description: 'Analyze target keywords, search intent, and competition',
      priority: TaskPriority.HIGH,
      timeoutMs: 120000,
      maxRetries: 3,
    },
    {
      type: TaskType.TECHNICAL_AUDIT,
      name: 'Technical SEO Audit',
      description: 'Audit website for technical SEO issues',
      priority: TaskPriority.HIGH,
      timeoutMs: 300000,
      maxRetries: 2,
    },
    {
      type: TaskType.CONTENT_GENERATION,
      name: 'Content Strategy & Generation',
      description: 'Generate SEO-optimized content based on keyword clusters',
      priority: TaskPriority.MEDIUM,
      timeoutMs: 180000,
      maxRetries: 2,
      dependsOn: [TaskType.KEYWORD_ANALYSIS],
    },
    {
      type: TaskType.INTERNAL_LINKING,
      name: 'Internal Linking Optimization',
      description: 'Optimize internal link structure for better crawlability',
      priority: TaskPriority.MEDIUM,
      timeoutMs: 120000,
      maxRetries: 2,
      dependsOn: [TaskType.CONTENT_GENERATION],
    },
  ],
  
  [GoalType.RANKING]: [
    {
      type: TaskType.KEYWORD_ANALYSIS,
      name: 'Target Keyword Analysis',
      description: 'Deep analysis of target keywords and SERP competition',
      priority: TaskPriority.CRITICAL,
      timeoutMs: 120000,
      maxRetries: 3,
    },
    {
      type: TaskType.CONTENT_OPTIMIZATION,
      name: 'Content Optimization',
      description: 'Optimize existing content for target keywords',
      priority: TaskPriority.HIGH,
      timeoutMs: 180000,
      maxRetries: 2,
      dependsOn: [TaskType.KEYWORD_ANALYSIS],
    },
    {
      type: TaskType.SCHEMA_GENERATION,
      name: 'Schema Markup Generation',
      description: 'Generate structured data for rich snippets',
      priority: TaskPriority.MEDIUM,
      timeoutMs: 60000,
      maxRetries: 2,
      dependsOn: [TaskType.CONTENT_OPTIMIZATION],
    },
    {
      type: TaskType.BACKLINK_ANALYSIS,
      name: 'Backlink Gap Analysis',
      description: 'Analyze backlink profile and identify opportunities',
      priority: TaskPriority.MEDIUM,
      timeoutMs: 180000,
      maxRetries: 2,
    },
  ],
  
  [GoalType.LEADS]: [
    {
      type: TaskType.KEYWORD_ANALYSIS,
      name: 'Commercial Intent Keyword Research',
      description: 'Focus on transactional and commercial keywords',
      priority: TaskPriority.CRITICAL,
      timeoutMs: 120000,
      maxRetries: 3,
    },
    {
      type: TaskType.CONTENT_GENERATION,
      name: 'Conversion-Focused Content',
      description: 'Generate content optimized for lead generation',
      priority: TaskPriority.HIGH,
      timeoutMs: 180000,
      maxRetries: 2,
      dependsOn: [TaskType.KEYWORD_ANALYSIS],
    },
    {
      type: TaskType.ENTITY_EXTRACTION,
      name: 'Entity & Trust Signal Optimization',
      description: 'Extract and optimize brand entities for trust',
      priority: TaskPriority.MEDIUM,
      timeoutMs: 120000,
      maxRetries: 2,
    },
  ],
  
  [GoalType.BRAND_VISIBILITY]: [
    {
      type: TaskType.ENTITY_EXTRACTION,
      name: 'Brand Entity Analysis',
      description: 'Extract and analyze brand entities',
      priority: TaskPriority.CRITICAL,
      timeoutMs: 120000,
      maxRetries: 3,
    },
    {
      type: TaskType.SCHEMA_GENERATION,
      name: 'Organization Schema',
      description: 'Generate comprehensive schema.org markup',
      priority: TaskPriority.HIGH,
      timeoutMs: 60000,
      maxRetries: 2,
      dependsOn: [TaskType.ENTITY_EXTRACTION],
    },
    {
      type: TaskType.CONTENT_GENERATION,
      name: 'Brand Authority Content',
      description: 'Generate content establishing brand authority',
      priority: TaskPriority.MEDIUM,
      timeoutMs: 180000,
      maxRetries: 2,
    },
    {
      type: TaskType.BACKLINK_ANALYSIS,
      name: 'Brand Mention Analysis',
      description: 'Analyze brand mentions and citation opportunities',
      priority: TaskPriority.MEDIUM,
      timeoutMs: 180000,
      maxRetries: 2,
    },
  ],
};

/**
 * Task Template Provider Interface
 * Allows custom template sources (DB, API, etc.)
 */
export interface ITaskTemplateProvider {
  getTemplates(goalType: GoalType): Promise<TaskTemplate[]>;
  setTemplates(goalType: GoalType, templates: TaskTemplate[]): Promise<void>;
}

/**
 * Default in-memory template provider
 */
export class DefaultTaskTemplateProvider implements ITaskTemplateProvider {
  private templates: Record<string, TaskTemplate[]>;

  constructor(initial?: Record<GoalType, TaskTemplate[]>) {
    this.templates = { ...(initial || DEFAULT_GOAL_TASK_TEMPLATES) };
  }

  async getTemplates(goalType: GoalType): Promise<TaskTemplate[]> {
    return this.templates[goalType] || [];
  }

  async setTemplates(goalType: GoalType, templates: TaskTemplate[]): Promise<void> {
    this.templates[goalType] = templates;
  }
}
