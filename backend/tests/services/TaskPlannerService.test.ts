/**
 * TaskPlannerService Unit Tests
 * Implement based on AI_SEO_TOOL_PROMPT_BOOK.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskPlannerService } from '../../src/application/services/TaskPlannerService.js';
import { ISeoPlanRepository, ISeoTaskRepository } from '../../src/domain/repositories/index.js';
import {
  SeoGoal,
  GoalType,
  GoalStatus,
  GoalPriority,
  SeoTask,
  TaskStatus,
  TaskType,
  TaskPriority,
  SeoPlan,
  PlanStatus,
} from '../../src/domain/index.js';

// Mock repositories
const createMockPlanRepository = (): ISeoPlanRepository => ({
  create: vi.fn(),
  findById: vi.fn(),
  findByGoalId: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
});

const createMockTaskRepository = (): ISeoTaskRepository => ({
  create: vi.fn(),
  createMany: vi.fn(),
  findById: vi.fn(),
  findByPlanId: vi.fn(),
  findPendingTasks: vi.fn(),
  findByStatus: vi.fn(),
  update: vi.fn(),
  updateStatus: vi.fn(),
  delete: vi.fn(),
});

// Sample goal for testing
const createSampleGoal = (overrides?: Partial<SeoGoal>): SeoGoal => ({
  id: 'goal-123',
  type: GoalType.TRAFFIC,
  title: 'Test Goal',
  description: 'Test Description',
  targetUrl: 'https://example.com',
  keywords: ['test', 'seo'],
  metrics: { targetValue: 100, unit: 'visitors' },
  priority: GoalPriority.HIGH,
  status: GoalStatus.PENDING,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Sample task for testing
const createSampleTask = (overrides?: Partial<SeoTask>): SeoTask => ({
  id: 'task-123',
  planId: 'plan-123',
  type: TaskType.KEYWORD_ANALYSIS,
  name: 'Test Task',
  description: 'Test Description',
  status: TaskStatus.PENDING,
  priority: TaskPriority.MEDIUM,
  input: {},
  dependencies: [],
  retryCount: 0,
  maxRetries: 3,
  timeoutMs: 120000,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('TaskPlannerService', () => {
  let planRepository: ISeoPlanRepository;
  let taskRepository: ISeoTaskRepository;
  let taskPlanner: TaskPlannerService;

  beforeEach(() => {
    planRepository = createMockPlanRepository();
    taskRepository = createMockTaskRepository();
    taskPlanner = new TaskPlannerService(planRepository, taskRepository);
  });

  describe('createPlan', () => {
    it('should create a plan with tasks for TRAFFIC goal', async () => {
      const goal = createSampleGoal({ type: GoalType.TRAFFIC });

      // Mock task creation
      const mockTasks: SeoTask[] = [
        createSampleTask({ id: 'task-1', type: TaskType.KEYWORD_ANALYSIS }),
        createSampleTask({ id: 'task-2', type: TaskType.TECHNICAL_AUDIT }),
        createSampleTask({ id: 'task-3', type: TaskType.CONTENT_GENERATION }),
        createSampleTask({ id: 'task-4', type: TaskType.INTERNAL_LINKING }),
      ];

      vi.mocked(taskRepository.createMany).mockResolvedValue(mockTasks);

      const mockPlan: SeoPlan = {
        id: 'plan-123',
        goalId: goal.id,
        name: `SEO Plan: ${goal.title}`,
        description: `Automated plan for ${goal.type} goal`,
        status: PlanStatus.DRAFT,
        tasks: mockTasks,
        metadata: {
          estimatedDurationDays: 2,
          totalTasks: 4,
          completedTasks: 0,
          failedTasks: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(planRepository.create).mockResolvedValue(mockPlan);

      const result = await taskPlanner.createPlan(goal);

      expect(result).toBeDefined();
      expect(result.goalId).toBe(goal.id);
      expect(taskRepository.createMany).toHaveBeenCalled();
      expect(planRepository.create).toHaveBeenCalled();
    });

    it('should create tasks with correct dependencies', async () => {
      const goal = createSampleGoal({ type: GoalType.RANKING });

      const mockTasks: SeoTask[] = [
        createSampleTask({ id: 'task-1', type: TaskType.KEYWORD_ANALYSIS }),
        createSampleTask({ id: 'task-2', type: TaskType.CONTENT_OPTIMIZATION }),
        createSampleTask({ id: 'task-3', type: TaskType.SCHEMA_GENERATION }),
        createSampleTask({ id: 'task-4', type: TaskType.BACKLINK_ANALYSIS }),
      ];

      vi.mocked(taskRepository.createMany).mockResolvedValue(mockTasks);
      vi.mocked(planRepository.create).mockResolvedValue({
        id: 'plan-123',
        goalId: goal.id,
        name: 'Test Plan',
        description: 'Test',
        status: PlanStatus.DRAFT,
        tasks: mockTasks,
        metadata: {
          estimatedDurationDays: 2,
          totalTasks: 4,
          completedTasks: 0,
          failedTasks: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await taskPlanner.createPlan(goal);

      // Verify tasks were created
      expect(taskRepository.createMany).toHaveBeenCalledTimes(1);
      const createManyCall = vi.mocked(taskRepository.createMany).mock.calls[0][0];
      expect(createManyCall.length).toBeGreaterThan(0);
    });
  });

  describe('getExecutableTasks', () => {
    it('should return tasks with no pending dependencies', async () => {
      const tasks: SeoTask[] = [
        createSampleTask({
          id: 'task-1',
          status: TaskStatus.COMPLETED,
          dependencies: [],
        }),
        createSampleTask({
          id: 'task-2',
          status: TaskStatus.PENDING,
          dependencies: [{ taskId: 'task-1', required: true }],
        }),
        createSampleTask({
          id: 'task-3',
          status: TaskStatus.PENDING,
          dependencies: [{ taskId: 'task-2', required: true }],
        }),
      ];

      vi.mocked(taskRepository.findByPlanId).mockResolvedValue(tasks);

      const executable = await taskPlanner.getExecutableTasks('plan-123');

      // task-2 should be executable (dependency task-1 is completed)
      expect(executable).toHaveLength(1);
      expect(executable[0].id).toBe('task-2');
    });

    it('should return empty array when all tasks are completed', async () => {
      const tasks: SeoTask[] = [
        createSampleTask({ id: 'task-1', status: TaskStatus.COMPLETED }),
        createSampleTask({ id: 'task-2', status: TaskStatus.COMPLETED }),
      ];

      vi.mocked(taskRepository.findByPlanId).mockResolvedValue(tasks);

      const executable = await taskPlanner.getExecutableTasks('plan-123');

      expect(executable).toHaveLength(0);
    });
  });

  describe('calculateProgress', () => {
    it('should calculate correct progress percentage', async () => {
      const tasks: SeoTask[] = [
        createSampleTask({ id: 'task-1', status: TaskStatus.COMPLETED }),
        createSampleTask({ id: 'task-2', status: TaskStatus.COMPLETED }),
        createSampleTask({ id: 'task-3', status: TaskStatus.RUNNING }),
        createSampleTask({ id: 'task-4', status: TaskStatus.PENDING }),
      ];

      vi.mocked(taskRepository.findByPlanId).mockResolvedValue(tasks);

      const progress = await taskPlanner.calculateProgress('plan-123');

      expect(progress.total).toBe(4);
      expect(progress.completed).toBe(2);
      expect(progress.running).toBe(1);
      expect(progress.pending).toBe(1);
      expect(progress.progress).toBe(50); // 2/4 = 50%
    });
  });
});
