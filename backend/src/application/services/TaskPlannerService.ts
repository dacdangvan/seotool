/**
 * TaskPlannerService - Rule-based MVP
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md - Module 0
 * 
 * Responsibilities:
 * - Decompose SEO goals into actionable tasks
 * - Create execution plans with proper task ordering
 * - Calculate dependencies between tasks
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SeoGoal,
  GoalType,
  SeoPlan,
  PlanStatus,
  SeoTask,
  TaskType,
  TaskStatus,
  TaskPriority,
  CreateSeoTaskInput,
} from '../../domain/index.js';
import { ISeoPlanRepository, ISeoTaskRepository } from '../../domain/repositories/index.js';
import { Logger } from '../../shared/Logger.js';

interface TaskTemplate {
  type: TaskType;
  name: string;
  description: string;
  priority: TaskPriority;
  timeoutMs: number;
  maxRetries: number;
  dependsOn?: TaskType[];
}

/**
 * Rule-based task templates for each goal type
 * These define the standard workflow for each SEO goal
 */
const GOAL_TASK_TEMPLATES: Record<GoalType, TaskTemplate[]> = {
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

export class TaskPlannerService {
  private readonly logger: Logger;

  constructor(
    private readonly planRepository: ISeoPlanRepository,
    private readonly taskRepository: ISeoTaskRepository,
    logger?: Logger
  ) {
    this.logger = logger || new Logger('TaskPlannerService');
  }

  /**
   * Create an execution plan for an SEO goal
   * Decomposes the goal into ordered tasks based on goal type
   */
  async createPlan(goal: SeoGoal): Promise<SeoPlan> {
    this.logger.info(`Creating plan for goal: ${goal.id} (${goal.type})`);

    const templates = GOAL_TASK_TEMPLATES[goal.type];
    if (!templates || templates.length === 0) {
      throw new Error(`No task templates defined for goal type: ${goal.type}`);
    }

    // Create plan first
    const planId = uuidv4();
    const taskInputs = this.buildTaskInputs(planId, goal, templates);

    // Create tasks
    const tasks = await this.taskRepository.createMany(taskInputs);
    this.logger.info(`Created ${tasks.length} tasks for plan ${planId}`);

    // Resolve dependencies (map TaskType to actual task IDs)
    const tasksWithDeps = this.resolveDependencies(tasks, templates);

    // Create the plan
    const plan = await this.planRepository.create({
      goalId: goal.id,
      name: `SEO Plan: ${goal.title}`,
      description: `Automated plan for ${goal.type} goal targeting ${goal.targetUrl}`,
      tasks: tasksWithDeps,
    });

    this.logger.info(`Plan created successfully: ${plan.id}`);
    return plan;
  }

  /**
   * Build task creation inputs from templates
   */
  private buildTaskInputs(
    planId: string,
    goal: SeoGoal,
    templates: TaskTemplate[]
  ): CreateSeoTaskInput[] {
    return templates.map((template) => ({
      planId,
      type: template.type,
      name: template.name,
      description: template.description,
      priority: template.priority,
      timeoutMs: template.timeoutMs,
      maxRetries: template.maxRetries,
      input: {
        goalId: goal.id,
        targetUrl: goal.targetUrl,
        keywords: goal.keywords || [],
        metrics: goal.metrics,
      },
      dependencies: [], // Will be resolved after task creation
    }));
  }

  /**
   * Resolve task dependencies from TaskType to actual task IDs
   */
  private resolveDependencies(
    tasks: SeoTask[],
    templates: TaskTemplate[]
  ): SeoTask[] {
    const taskByType = new Map<TaskType, SeoTask>();
    tasks.forEach((task) => taskByType.set(task.type, task));

    return tasks.map((task, index) => {
      const template = templates[index];
      if (template.dependsOn && template.dependsOn.length > 0) {
        const dependencies = template.dependsOn
          .map((depType) => {
            const depTask = taskByType.get(depType);
            if (depTask) {
              return { taskId: depTask.id, required: true };
            }
            return null;
          })
          .filter((dep) => dep !== null);

        return { ...task, dependencies };
      }
      return task;
    });
  }

  /**
   * Get next executable tasks (tasks with no pending dependencies)
   */
  async getExecutableTasks(planId: string): Promise<SeoTask[]> {
    const tasks = await this.taskRepository.findByPlanId(planId);
    const completedTaskIds = new Set(
      tasks
        .filter((t) => t.status === TaskStatus.COMPLETED)
        .map((t) => t.id)
    );

    return tasks.filter((task) => {
      if (task.status !== TaskStatus.PENDING) {
        return false;
      }

      // Check if all required dependencies are completed
      const hasUnmetDependencies = task.dependencies.some(
        (dep) => dep.required && !completedTaskIds.has(dep.taskId)
      );

      return !hasUnmetDependencies;
    });
  }

  /**
   * Calculate plan progress
   */
  async calculateProgress(planId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
    running: number;
    progress: number;
  }> {
    const tasks = await this.taskRepository.findByPlanId(planId);
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
    const failed = tasks.filter((t) => t.status === TaskStatus.FAILED).length;
    const running = tasks.filter((t) => t.status === TaskStatus.RUNNING).length;
    const pending = tasks.filter((t) => t.status === TaskStatus.PENDING).length;

    return {
      total,
      completed,
      failed,
      pending,
      running,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
}
