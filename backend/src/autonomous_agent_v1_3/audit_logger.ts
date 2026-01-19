/**
 * Audit Logger
 * 
 * Provides immutable audit trail for all governance-related events.
 * 
 * Addresses v1.2 flaw: "Weight Manipulation Vulnerability"
 * - Admin could quietly change weights to favor approvals
 * - No audit trail for configuration changes
 * 
 * v1.3 Solutions:
 * - Immutable audit log with cryptographic checksums
 * - All weight/threshold changes are logged with actor ID
 * - Chain of custody for decision trail
 */

import * as crypto from 'crypto';
import {
  AuditEntry,
  AuditEventType,
  AgentRole,
  V13Config,
} from './models';
import { VotingWeights } from '../debate_engine/models';

/**
 * Calculate checksum for an audit entry (creates chain)
 */
export function calculateChecksum(
  entry: Omit<AuditEntry, 'checksum'>,
  previousChecksum?: string
): string {
  const data = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    eventType: entry.eventType,
    actorId: entry.actorId,
    projectId: entry.projectId,
    details: entry.details,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
    previousChecksum: previousChecksum || '',
  });
  
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verify the integrity of an audit entry
 */
export function verifyChecksum(entry: AuditEntry): boolean {
  const expectedChecksum = calculateChecksum(
    {
      id: entry.id,
      timestamp: entry.timestamp,
      eventType: entry.eventType,
      actorId: entry.actorId,
      projectId: entry.projectId,
      details: entry.details,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      previousEntryChecksum: entry.previousEntryChecksum,
    },
    entry.previousEntryChecksum
  );
  
  return entry.checksum === expectedChecksum;
}

/**
 * Verify the integrity of an entire audit chain
 */
export function verifyAuditChain(entries: AuditEntry[]): {
  valid: boolean;
  brokenAt?: number;
  reason?: string;
} {
  if (entries.length === 0) {
    return { valid: true };
  }
  
  // Sort by timestamp
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    
    // Verify checksum
    if (!verifyChecksum(entry)) {
      return {
        valid: false,
        brokenAt: i,
        reason: `Checksum mismatch at entry ${i} (${entry.id})`,
      };
    }
    
    // Verify chain link (except first entry)
    if (i > 0) {
      const previousEntry = sorted[i - 1];
      if (entry.previousEntryChecksum !== previousEntry.checksum) {
        return {
          valid: false,
          brokenAt: i,
          reason: `Chain broken at entry ${i} (${entry.id}): previousEntryChecksum doesn't match previous entry's checksum`,
        };
      }
    }
  }
  
  return { valid: true };
}

/**
 * Create a new audit entry with proper checksum
 */
export function createAuditEntry(
  eventType: AuditEventType,
  actorId: string,
  projectId: string,
  details: Record<string, unknown>,
  previousValue?: unknown,
  newValue?: unknown,
  previousEntry?: AuditEntry
): AuditEntry {
  const entry: Omit<AuditEntry, 'checksum'> = {
    id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    eventType,
    actorId,
    projectId,
    details,
    previousValue,
    newValue,
    previousEntryChecksum: previousEntry?.checksum,
  };
  
  return {
    ...entry,
    checksum: calculateChecksum(entry, previousEntry?.checksum),
  };
}

// ============================================================================
// SPECIFIC EVENT CREATORS
// ============================================================================

/**
 * Log weight change
 */
export function createWeightChangeEntry(
  projectId: string,
  actorId: string,
  agentRole: AgentRole,
  previousWeight: number,
  newWeight: number,
  reason: string,
  previousEntry?: AuditEntry
): AuditEntry {
  return createAuditEntry(
    AuditEventType.WEIGHT_CHANGED,
    actorId,
    projectId,
    {
      agentRole,
      reason,
    },
    { [agentRole]: previousWeight },
    { [agentRole]: newWeight },
    previousEntry
  );
}

/**
 * Log threshold change
 */
export function createThresholdChangeEntry(
  projectId: string,
  actorId: string,
  thresholdName: string,
  previousValue: number,
  newValue: number,
  reason: string,
  previousEntry?: AuditEntry
): AuditEntry {
  return createAuditEntry(
    AuditEventType.THRESHOLD_CHANGED,
    actorId,
    projectId,
    {
      thresholdName,
      reason,
    },
    { [thresholdName]: previousValue },
    { [thresholdName]: newValue },
    previousEntry
  );
}

/**
 * Log agent enable/disable
 */
export function createAgentStateChangeEntry(
  projectId: string,
  actorId: string,
  agentRole: AgentRole,
  enabled: boolean,
  reason: string,
  previousEntry?: AuditEntry
): AuditEntry {
  return createAuditEntry(
    enabled ? AuditEventType.AGENT_ENABLED : AuditEventType.AGENT_DISABLED,
    actorId,
    projectId,
    {
      agentRole,
      reason,
    },
    { enabled: !enabled },
    { enabled },
    previousEntry
  );
}

/**
 * Log execution decision
 */
export function createExecutionDecisionEntry(
  projectId: string,
  actorId: string,
  actionId: string,
  decision: 'approved' | 'rejected' | 'vetoed' | 'blocked',
  reason: string,
  details: Record<string, unknown>,
  previousEntry?: AuditEntry
): AuditEntry {
  const eventTypeMap = {
    approved: AuditEventType.EXECUTION_APPROVED,
    rejected: AuditEventType.EXECUTION_REJECTED,
    vetoed: AuditEventType.EXECUTION_VETOED,
    blocked: AuditEventType.EXECUTION_BLOCKED,
  };
  
  return createAuditEntry(
    eventTypeMap[decision],
    actorId,
    projectId,
    {
      actionId,
      reason,
      ...details,
    },
    undefined,
    undefined,
    previousEntry
  );
}

/**
 * Log debate start
 */
export function createDebateStartEntry(
  projectId: string,
  actorId: string,
  debateId: string,
  actionId: string,
  enabledAgents: AgentRole[],
  previousEntry?: AuditEntry
): AuditEntry {
  return createAuditEntry(
    AuditEventType.DEBATE_STARTED,
    actorId,
    projectId,
    {
      debateId,
      actionId,
      enabledAgents,
    },
    undefined,
    undefined,
    previousEntry
  );
}

/**
 * Log debate completion
 */
export function createDebateCompleteEntry(
  projectId: string,
  actorId: string,
  debateId: string,
  actionId: string,
  decision: string,
  finalScore: number,
  previousEntry?: AuditEntry
): AuditEntry {
  return createAuditEntry(
    AuditEventType.DEBATE_COMPLETED,
    actorId,
    projectId,
    {
      debateId,
      actionId,
      decision,
      finalScore,
    },
    undefined,
    undefined,
    previousEntry
  );
}

// ============================================================================
// AUDIT LOGGER CLASS
// ============================================================================

export class AuditLogger {
  private projectId: string;
  private defaultActorId: string;
  private entries: AuditEntry[] = [];
  
  constructor(projectId: string, defaultActorId: string = 'system') {
    this.projectId = projectId;
    this.defaultActorId = defaultActorId;
  }
  
  private getLastEntry(): AuditEntry | undefined {
    return this.entries[this.entries.length - 1];
  }
  
  logWeightChange(
    agentRole: AgentRole,
    previousWeight: number,
    newWeight: number,
    reason: string,
    actorId?: string
  ): AuditEntry {
    const entry = createWeightChangeEntry(
      this.projectId,
      actorId || this.defaultActorId,
      agentRole,
      previousWeight,
      newWeight,
      reason,
      this.getLastEntry()
    );
    this.entries.push(entry);
    return entry;
  }
  
  logThresholdChange(
    thresholdName: string,
    previousValue: number,
    newValue: number,
    reason: string,
    actorId?: string
  ): AuditEntry {
    const entry = createThresholdChangeEntry(
      this.projectId,
      actorId || this.defaultActorId,
      thresholdName,
      previousValue,
      newValue,
      reason,
      this.getLastEntry()
    );
    this.entries.push(entry);
    return entry;
  }
  
  logAgentStateChange(
    agentRole: AgentRole,
    enabled: boolean,
    reason: string,
    actorId?: string
  ): AuditEntry {
    const entry = createAgentStateChangeEntry(
      this.projectId,
      actorId || this.defaultActorId,
      agentRole,
      enabled,
      reason,
      this.getLastEntry()
    );
    this.entries.push(entry);
    return entry;
  }
  
  logExecutionDecision(
    actionId: string,
    decision: 'approved' | 'rejected' | 'vetoed' | 'blocked',
    reason: string,
    details: Record<string, unknown> = {},
    actorId?: string
  ): AuditEntry {
    const entry = createExecutionDecisionEntry(
      this.projectId,
      actorId || this.defaultActorId,
      actionId,
      decision,
      reason,
      details,
      this.getLastEntry()
    );
    this.entries.push(entry);
    return entry;
  }
  
  logDebateStart(
    debateId: string,
    actionId: string,
    enabledAgents: AgentRole[],
    actorId?: string
  ): AuditEntry {
    const entry = createDebateStartEntry(
      this.projectId,
      actorId || this.defaultActorId,
      debateId,
      actionId,
      enabledAgents,
      this.getLastEntry()
    );
    this.entries.push(entry);
    return entry;
  }
  
  logDebateComplete(
    debateId: string,
    actionId: string,
    decision: string,
    finalScore: number,
    actorId?: string
  ): AuditEntry {
    const entry = createDebateCompleteEntry(
      this.projectId,
      actorId || this.defaultActorId,
      debateId,
      actionId,
      decision,
      finalScore,
      this.getLastEntry()
    );
    this.entries.push(entry);
    return entry;
  }
  
  /**
   * Add a generic custom entry
   */
  logCustom(
    eventType: AuditEventType,
    details: Record<string, unknown>,
    previousValue?: unknown,
    newValue?: unknown,
    actorId?: string
  ): AuditEntry {
    const entry = createAuditEntry(
      eventType,
      actorId || this.defaultActorId,
      this.projectId,
      details,
      previousValue,
      newValue,
      this.getLastEntry()
    );
    this.entries.push(entry);
    return entry;
  }
  
  /**
   * Get all entries
   */
  getEntries(): AuditEntry[] {
    return [...this.entries];
  }
  
  /**
   * Get entries by event type
   */
  getEntriesByType(eventType: AuditEventType): AuditEntry[] {
    return this.entries.filter(e => e.eventType === eventType);
  }
  
  /**
   * Get entries by actor
   */
  getEntriesByActor(actorId: string): AuditEntry[] {
    return this.entries.filter(e => e.actorId === actorId);
  }
  
  /**
   * Get entries in time range
   */
  getEntriesInRange(startTime: Date, endTime: Date): AuditEntry[] {
    return this.entries.filter(e => {
      const time = new Date(e.timestamp);
      return time >= startTime && time <= endTime;
    });
  }
  
  /**
   * Verify the integrity of the audit chain
   */
  verifyIntegrity(): { valid: boolean; brokenAt?: number; reason?: string } {
    return verifyAuditChain(this.entries);
  }
  
  /**
   * Export entries for external storage
   */
  export(): string {
    return JSON.stringify(this.entries, null, 2);
  }
  
  /**
   * Import entries from external storage
   */
  import(json: string): { success: boolean; error?: string } {
    try {
      const imported = JSON.parse(json) as AuditEntry[];
      
      // Verify integrity before importing
      const verification = verifyAuditChain(imported);
      if (!verification.valid) {
        return {
          success: false,
          error: `Imported chain is invalid: ${verification.reason}`,
        };
      }
      
      this.entries = imported;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse JSON: ${error}`,
      };
    }
  }
  
  /**
   * Get entry count
   */
  get count(): number {
    return this.entries.length;
  }
}
