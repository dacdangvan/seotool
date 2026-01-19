/**
 * Memory Store
 * 
 * v1.0 - Persistent storage for agent learning and history
 * 
 * Responsibilities:
 * - Store past actions, outcomes, and approvals/rejections
 * - Query historical data for rule-based learning
 * - Track what worked and what didn't
 * - Enable the agent to improve over time
 */

import { v4 as uuidv4 } from 'uuid';
import {
  MemoryEntry,
  LearningRule,
  SEOGoalType,
  ActionType,
  ActionPlan,
  ExecutionStatus,
  SEOAction,
  ActionResult,
} from './models';

// In-memory storage (replace with PostgreSQL in production)
interface MemoryStorage {
  entries: Map<string, MemoryEntry>;
  rules: Map<string, LearningRule>;
}

// Query filters for memory retrieval
interface MemoryQuery {
  projectId?: string;
  type?: MemoryEntry['type'];
  goalType?: SEOGoalType;
  actionType?: ActionType;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// Learning statistics
interface LearningStats {
  totalEntries: number;
  byType: Record<string, number>;
  byGoalType: Record<string, number>;
  byActionType: Record<string, number>;
  successRate: number;
  avgTimeToEffect: number;
}

export class MemoryStore {
  private storage: MemoryStorage;
  private logger: Console;
  private persistPath?: string;

  constructor(config?: { persistPath?: string }) {
    this.storage = {
      entries: new Map(),
      rules: new Map(),
    };
    this.persistPath = config?.persistPath;
    this.logger = console;

    // Load persisted data if available
    if (this.persistPath) {
      this.loadFromDisk();
    }

    this.logger.log('[MemoryStore] Initialized');
  }

  // ============================================================================
  // MEMORY ENTRY OPERATIONS
  // ============================================================================

  /**
   * Store a new memory entry
   */
  async store(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<MemoryEntry> {
    const fullEntry: MemoryEntry = {
      ...entry,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };

    this.storage.entries.set(fullEntry.id, fullEntry);
    this.logger.log(`[MemoryStore] Stored entry: ${fullEntry.id} (${fullEntry.type})`);

    // Persist if configured
    await this.persistToDisk();

    return fullEntry;
  }

  /**
   * Store action execution outcome
   */
  async storeActionOutcome(
    projectId: string,
    action: SEOAction,
    result: ActionResult,
    metricsBefore: Record<string, number>,
    metricsAfter: Record<string, number>,
    timeToEffectDays: number
  ): Promise<MemoryEntry> {
    return this.store({
      projectId,
      type: 'outcome',
      actionId: action.id,
      description: `Action "${action.title}" ${result.success ? 'succeeded' : 'failed'}: ${result.message}`,
      context: {
        actionType: action.type,
        targetMetric: action.expectedImpact.metric,
      },
      outcome: {
        success: result.success,
        metricsBefore,
        metricsAfter,
        timeToEffect: timeToEffectDays,
      },
      learnings: this.extractLearnings(action, result, metricsBefore, metricsAfter),
      tags: [action.category, action.type, result.success ? 'success' : 'failure'],
    });
  }

  /**
   * Store plan approval/rejection
   */
  async storePlanDecision(
    projectId: string,
    plan: ActionPlan,
    decision: 'approved' | 'rejected',
    approvedBy: string,
    comments?: string
  ): Promise<MemoryEntry> {
    return this.store({
      projectId,
      type: decision === 'approved' ? 'approval' : 'rejection',
      planId: plan.id,
      description: `Plan ${plan.id} ${decision} by ${approvedBy}${comments ? `: ${comments}` : ''}`,
      context: {
        goalType: undefined, // Could extract from plan goals
      },
      learnings: comments ? [comments] : undefined,
      tags: [decision, `actions_${plan.actions.length}`],
    });
  }

  /**
   * Store a learning insight
   */
  async storeLearning(
    projectId: string,
    learning: string,
    context: MemoryEntry['context'],
    tags: string[]
  ): Promise<MemoryEntry> {
    return this.store({
      projectId,
      type: 'learning',
      description: learning,
      context,
      learnings: [learning],
      tags,
    });
  }

  /**
   * Query memory entries
   */
  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    let results = Array.from(this.storage.entries.values());

    // Apply filters
    if (query.projectId) {
      results = results.filter(e => e.projectId === query.projectId);
    }
    if (query.type) {
      results = results.filter(e => e.type === query.type);
    }
    if (query.goalType) {
      results = results.filter(e => e.context.goalType === query.goalType);
    }
    if (query.actionType) {
      results = results.filter(e => e.context.actionType === query.actionType);
    }
    if (query.startDate) {
      results = results.filter(e => e.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter(e => e.timestamp <= query.endDate!);
    }
    if (query.tags && query.tags.length > 0) {
      results = results.filter(e => query.tags!.some(tag => e.tags.includes(tag)));
    }

    // Sort by timestamp descending (most recent first)
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get success rate for a specific action type
   */
  async getActionSuccessRate(actionType: ActionType, projectId?: string): Promise<number> {
    const outcomes = await this.query({
      projectId,
      type: 'outcome',
      actionType,
    });

    if (outcomes.length === 0) return 0;

    const successes = outcomes.filter(e => e.outcome?.success).length;
    return successes / outcomes.length;
  }

  /**
   * Get average time to effect for an action type
   */
  async getAvgTimeToEffect(actionType: ActionType, projectId?: string): Promise<number> {
    const outcomes = await this.query({
      projectId,
      type: 'outcome',
      actionType,
    });

    const withTimeToEffect = outcomes.filter(e => e.outcome?.timeToEffect != null);
    if (withTimeToEffect.length === 0) return 0;

    const total = withTimeToEffect.reduce((sum, e) => sum + (e.outcome?.timeToEffect || 0), 0);
    return total / withTimeToEffect.length;
  }

  // ============================================================================
  // LEARNING RULES
  // ============================================================================

  /**
   * Create or update a learning rule
   */
  async upsertRule(rule: Omit<LearningRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<LearningRule> {
    // Check for existing rule with same condition
    const existing = await this.findMatchingRule(rule.condition);

    if (existing) {
      // Update existing rule
      const updated: LearningRule = {
        ...existing,
        ...rule,
        updatedAt: new Date().toISOString(),
        evidenceCount: existing.evidenceCount + 1,
        successRate: (existing.successRate * existing.evidenceCount + rule.successRate) / (existing.evidenceCount + 1),
      };
      this.storage.rules.set(updated.id, updated);
      await this.persistToDisk();
      return updated;
    }

    // Create new rule
    const newRule: LearningRule = {
      ...rule,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evidenceCount: 1,
    };
    this.storage.rules.set(newRule.id, newRule);
    await this.persistToDisk();
    return newRule;
  }

  /**
   * Find a matching learning rule
   */
  async findMatchingRule(condition: LearningRule['condition']): Promise<LearningRule | null> {
    for (const rule of this.storage.rules.values()) {
      if (
        rule.condition.goalType === condition.goalType &&
        rule.condition.actionType === condition.actionType &&
        rule.condition.contextPattern === condition.contextPattern
      ) {
        return rule;
      }
    }
    return null;
  }

  /**
   * Get applicable rules for a given context
   */
  async getApplicableRules(
    goalType?: SEOGoalType,
    actionType?: ActionType
  ): Promise<LearningRule[]> {
    const rules: LearningRule[] = [];

    for (const rule of this.storage.rules.values()) {
      const matches =
        (!rule.condition.goalType || rule.condition.goalType === goalType) &&
        (!rule.condition.actionType || rule.condition.actionType === actionType);

      if (matches && rule.evidenceCount >= 3) {
        // Only apply rules with sufficient evidence
        rules.push(rule);
      }
    }

    return rules;
  }

  /**
   * Apply priority adjustments based on learning rules
   */
  async applyPriorityAdjustments(
    action: SEOAction,
    goalType?: SEOGoalType
  ): Promise<{ adjustedPriority: number; appliedRules: string[] }> {
    const rules = await this.getApplicableRules(goalType, action.type);
    let adjustedPriority = action.priority;
    const appliedRules: string[] = [];

    for (const rule of rules) {
      switch (rule.adjustment.type) {
        case 'priority_boost':
          adjustedPriority += rule.adjustment.value;
          appliedRules.push(`+${rule.adjustment.value}: ${rule.adjustment.reason}`);
          break;
        case 'priority_reduce':
          adjustedPriority -= rule.adjustment.value;
          appliedRules.push(`-${rule.adjustment.value}: ${rule.adjustment.reason}`);
          break;
        case 'avoid':
          if (rule.successRate < 0.3) {
            adjustedPriority = Math.max(1, adjustedPriority - 5);
            appliedRules.push(`Deprioritized: Low success rate (${Math.round(rule.successRate * 100)}%)`);
          }
          break;
        case 'prefer':
          if (rule.successRate > 0.7) {
            adjustedPriority = Math.min(10, adjustedPriority + 2);
            appliedRules.push(`Prioritized: High success rate (${Math.round(rule.successRate * 100)}%)`);
          }
          break;
      }

      // Update rule last applied
      rule.lastApplied = new Date().toISOString();
      this.storage.rules.set(rule.id, rule);
    }

    // Clamp priority to valid range
    adjustedPriority = Math.max(1, Math.min(10, adjustedPriority));

    return { adjustedPriority, appliedRules };
  }

  // ============================================================================
  // STATISTICS & INSIGHTS
  // ============================================================================

  /**
   * Get learning statistics for a project
   */
  async getStats(projectId?: string): Promise<LearningStats> {
    const entries = await this.query({ projectId });

    const stats: LearningStats = {
      totalEntries: entries.length,
      byType: {},
      byGoalType: {},
      byActionType: {},
      successRate: 0,
      avgTimeToEffect: 0,
    };

    // Count by type
    for (const entry of entries) {
      stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;

      if (entry.context.goalType) {
        stats.byGoalType[entry.context.goalType] = (stats.byGoalType[entry.context.goalType] || 0) + 1;
      }
      if (entry.context.actionType) {
        stats.byActionType[entry.context.actionType] = (stats.byActionType[entry.context.actionType] || 0) + 1;
      }
    }

    // Calculate success rate from outcomes
    const outcomes = entries.filter(e => e.type === 'outcome' && e.outcome);
    if (outcomes.length > 0) {
      const successes = outcomes.filter(e => e.outcome?.success).length;
      stats.successRate = successes / outcomes.length;

      const withTime = outcomes.filter(e => e.outcome?.timeToEffect != null);
      if (withTime.length > 0) {
        stats.avgTimeToEffect = withTime.reduce((sum, e) => sum + (e.outcome?.timeToEffect || 0), 0) / withTime.length;
      }
    }

    return stats;
  }

  /**
   * Get similar past actions and their outcomes
   */
  async getSimilarActions(
    action: SEOAction,
    projectId?: string,
    limit: number = 5
  ): Promise<MemoryEntry[]> {
    const outcomes = await this.query({
      projectId,
      type: 'outcome',
      actionType: action.type,
      limit: limit * 2,
    });

    // Score similarity based on category and tags
    const scored = outcomes.map(entry => {
      let score = 0;
      if (entry.tags.includes(action.category)) score += 2;
      if (entry.context.targetMetric === action.expectedImpact.metric) score += 3;
      return { entry, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.entry);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Extract learnings from action outcome
   */
  private extractLearnings(
    action: SEOAction,
    result: ActionResult,
    metricsBefore: Record<string, number>,
    metricsAfter: Record<string, number>
  ): string[] {
    const learnings: string[] = [];

    // Calculate metric changes
    const targetMetric = action.expectedImpact.metric;
    const before = metricsBefore[targetMetric];
    const after = metricsAfter[targetMetric];

    if (before != null && after != null) {
      const change = ((after - before) / before) * 100;
      const expected = action.expectedImpact.estimatedChange;

      if (result.success) {
        if (change >= expected * 0.8) {
          learnings.push(`${action.type} achieved expected results: ${change.toFixed(1)}% change in ${targetMetric}`);
        } else {
          learnings.push(`${action.type} underperformed: ${change.toFixed(1)}% vs expected ${expected}%`);
        }
      } else {
        learnings.push(`${action.type} failed: ${result.message}`);
      }
    }

    return learnings;
  }

  /**
   * Persist data to disk (placeholder for file/DB persistence)
   */
  private async persistToDisk(): Promise<void> {
    if (!this.persistPath) return;

    // In production, this would write to PostgreSQL or file system
    // For now, it's a no-op placeholder
    this.logger.log('[MemoryStore] Persist triggered (placeholder)');
  }

  /**
   * Load data from disk (placeholder for file/DB loading)
   */
  private loadFromDisk(): void {
    if (!this.persistPath) return;

    // In production, this would read from PostgreSQL or file system
    // For now, it's a no-op placeholder
    this.logger.log('[MemoryStore] Load triggered (placeholder)');
  }

  /**
   * Clear all memory (use with caution!)
   */
  async clear(): Promise<void> {
    this.storage.entries.clear();
    this.storage.rules.clear();
    this.logger.log('[MemoryStore] All memory cleared');
    await this.persistToDisk();
  }

  /**
   * Get memory size statistics
   */
  getMemorySize(): { entries: number; rules: number } {
    return {
      entries: this.storage.entries.size,
      rules: this.storage.rules.size,
    };
  }
}

export default MemoryStore;
