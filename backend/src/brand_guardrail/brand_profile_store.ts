/**
 * Brand Profile Store v1.4
 * 
 * Persistent storage for Brand Style Profiles.
 * 
 * Features:
 * - CRUD operations for brand profiles
 * - Profile versioning
 * - Profile comparison
 * - PostgreSQL persistence (interface-based)
 * 
 * Design Principles:
 * - Repository pattern for data access
 * - Version history for rollback
 * - Atomic updates
 */

import {
  BrandStyleProfile,
  BrandGuardrailConfig,
  LearningMetadata,
} from './models';

// ============================================================================
// PROFILE VERSION
// ============================================================================

export interface BrandProfileVersion {
  id: string;
  profileId: string;
  version: number;
  profile: BrandStyleProfile;
  changedBy: string;
  changeReason: string;
  createdAt: string;
}

// ============================================================================
// STORE INTERFACE
// ============================================================================

export interface IBrandProfileStore {
  // Core CRUD
  create(profile: BrandStyleProfile): Promise<BrandStyleProfile>;
  get(profileId: string): Promise<BrandStyleProfile | null>;
  update(profile: BrandStyleProfile, changedBy: string, changeReason: string): Promise<BrandStyleProfile>;
  delete(profileId: string): Promise<boolean>;
  
  // Query
  getByProjectId(projectId: string): Promise<BrandStyleProfile[]>;
  getActiveByProjectId(projectId: string): Promise<BrandStyleProfile | null>;
  
  // Versioning
  getVersionHistory(profileId: string): Promise<BrandProfileVersion[]>;
  restoreVersion(profileId: string, version: number, restoredBy: string): Promise<BrandStyleProfile>;
  
  // Comparison
  compareProfiles(profileId1: string, profileId2: string): Promise<ProfileComparison>;
}

// ============================================================================
// PROFILE COMPARISON
// ============================================================================

export interface ProfileComparison {
  profile1Id: string;
  profile2Id: string;
  differences: ProfileDifference[];
  similarityScore: number;
  comparedAt: string;
}

export interface ProfileDifference {
  path: string;
  description: string;
  value1: any;
  value2: any;
  percentageChange?: number;
}

// ============================================================================
// IN-MEMORY IMPLEMENTATION (for development/testing)
// ============================================================================

export class InMemoryBrandProfileStore implements IBrandProfileStore {
  private profiles: Map<string, BrandStyleProfile> = new Map();
  private versions: Map<string, BrandProfileVersion[]> = new Map();
  private logger: Console;
  
  constructor() {
    this.logger = console;
  }
  
  async create(profile: BrandStyleProfile): Promise<BrandStyleProfile> {
    if (this.profiles.has(profile.id)) {
      throw new Error(`Profile ${profile.id} already exists`);
    }
    
    const now = new Date().toISOString();
    const newProfile: BrandStyleProfile = {
      ...profile,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    
    this.profiles.set(profile.id, newProfile);
    
    // Create initial version
    const version: BrandProfileVersion = {
      id: `${profile.id}-v1`,
      profileId: profile.id,
      version: 1,
      profile: newProfile,
      changedBy: 'system',
      changeReason: 'Initial creation',
      createdAt: now,
    };
    
    this.versions.set(profile.id, [version]);
    
    this.logger.log(`[BrandProfileStore] Created profile: ${profile.id}`);
    return newProfile;
  }
  
  async get(profileId: string): Promise<BrandStyleProfile | null> {
    return this.profiles.get(profileId) || null;
  }
  
  async update(
    profile: BrandStyleProfile,
    changedBy: string,
    changeReason: string
  ): Promise<BrandStyleProfile> {
    const existing = this.profiles.get(profile.id);
    if (!existing) {
      throw new Error(`Profile ${profile.id} not found`);
    }
    
    const now = new Date().toISOString();
    const newVersion = existing.version + 1;
    
    const updatedProfile: BrandStyleProfile = {
      ...profile,
      version: newVersion,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    
    this.profiles.set(profile.id, updatedProfile);
    
    // Add version
    const version: BrandProfileVersion = {
      id: `${profile.id}-v${newVersion}`,
      profileId: profile.id,
      version: newVersion,
      profile: updatedProfile,
      changedBy,
      changeReason,
      createdAt: now,
    };
    
    const versions = this.versions.get(profile.id) || [];
    versions.push(version);
    this.versions.set(profile.id, versions);
    
    this.logger.log(`[BrandProfileStore] Updated profile: ${profile.id} (v${newVersion})`);
    return updatedProfile;
  }
  
  async delete(profileId: string): Promise<boolean> {
    const existed = this.profiles.has(profileId);
    this.profiles.delete(profileId);
    this.versions.delete(profileId);
    
    if (existed) {
      this.logger.log(`[BrandProfileStore] Deleted profile: ${profileId}`);
    }
    
    return existed;
  }
  
  async getByProjectId(projectId: string): Promise<BrandStyleProfile[]> {
    const profiles: BrandStyleProfile[] = [];
    for (const profile of this.profiles.values()) {
      if (profile.projectId === projectId) {
        profiles.push(profile);
      }
    }
    return profiles.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  
  async getActiveByProjectId(projectId: string): Promise<BrandStyleProfile | null> {
    const profiles = await this.getByProjectId(projectId);
    // Return most recently updated profile
    return profiles[0] || null;
  }
  
  async getVersionHistory(profileId: string): Promise<BrandProfileVersion[]> {
    return this.versions.get(profileId) || [];
  }
  
  async restoreVersion(
    profileId: string,
    version: number,
    restoredBy: string
  ): Promise<BrandStyleProfile> {
    const versions = this.versions.get(profileId);
    if (!versions) {
      throw new Error(`No version history for profile ${profileId}`);
    }
    
    const targetVersion = versions.find(v => v.version === version);
    if (!targetVersion) {
      throw new Error(`Version ${version} not found for profile ${profileId}`);
    }
    
    // Restore by creating a new version
    return this.update(
      targetVersion.profile,
      restoredBy,
      `Restored from version ${version}`
    );
  }
  
  async compareProfiles(profileId1: string, profileId2: string): Promise<ProfileComparison> {
    const profile1 = await this.get(profileId1);
    const profile2 = await this.get(profileId2);
    
    if (!profile1 || !profile2) {
      throw new Error('One or both profiles not found');
    }
    
    const differences: ProfileDifference[] = [];
    
    // Compare style attributes
    const attrs1 = profile1.styleAttributes;
    const attrs2 = profile2.styleAttributes;
    
    for (const key of Object.keys(attrs1) as (keyof typeof attrs1)[]) {
      if (attrs1[key] !== attrs2[key]) {
        differences.push({
          path: `styleAttributes.${key}`,
          description: `${key} changed`,
          value1: attrs1[key],
          value2: attrs2[key],
          percentageChange: ((attrs2[key] - attrs1[key]) / Math.max(attrs1[key], 0.01)) * 100,
        });
      }
    }
    
    // Compare tone profile
    if (profile1.toneProfile.primaryTone !== profile2.toneProfile.primaryTone) {
      differences.push({
        path: 'toneProfile.primaryTone',
        description: 'Primary tone changed',
        value1: profile1.toneProfile.primaryTone,
        value2: profile2.toneProfile.primaryTone,
      });
    }
    
    // Compare structure patterns
    const struct1 = profile1.structurePatterns;
    const struct2 = profile2.structurePatterns;
    
    if (Math.abs(struct1.avgSentenceLength - struct2.avgSentenceLength) > 2) {
      differences.push({
        path: 'structurePatterns.avgSentenceLength',
        description: 'Average sentence length changed significantly',
        value1: struct1.avgSentenceLength,
        value2: struct2.avgSentenceLength,
        percentageChange: ((struct2.avgSentenceLength - struct1.avgSentenceLength) / struct1.avgSentenceLength) * 100,
      });
    }
    
    // Calculate similarity score
    const totalChecks = 10; // Number of attributes checked
    const similarityScore = 1 - (differences.length / totalChecks);
    
    return {
      profile1Id: profileId1,
      profile2Id: profileId2,
      differences,
      similarityScore,
      comparedAt: new Date().toISOString(),
    };
  }
  
  // Utility: Get all profiles
  async getAll(): Promise<BrandStyleProfile[]> {
    return Array.from(this.profiles.values());
  }
  
  // Utility: Clear all (for testing)
  async clear(): Promise<void> {
    this.profiles.clear();
    this.versions.clear();
    this.logger.log('[BrandProfileStore] Cleared all profiles');
  }
}

// ============================================================================
// POSTGRESQL IMPLEMENTATION STUB
// ============================================================================

/**
 * PostgreSQL implementation (stub - would need pg client)
 */
export class PostgresBrandProfileStore implements IBrandProfileStore {
  private connectionString: string;
  private logger: Console;
  
  constructor(connectionString: string) {
    this.connectionString = connectionString;
    this.logger = console;
  }
  
  async create(profile: BrandStyleProfile): Promise<BrandStyleProfile> {
    // TODO: Implement with pg client
    throw new Error('PostgreSQL implementation not yet available');
  }
  
  async get(profileId: string): Promise<BrandStyleProfile | null> {
    // TODO: Implement with pg client
    throw new Error('PostgreSQL implementation not yet available');
  }
  
  async update(
    profile: BrandStyleProfile,
    changedBy: string,
    changeReason: string
  ): Promise<BrandStyleProfile> {
    // TODO: Implement with pg client
    throw new Error('PostgreSQL implementation not yet available');
  }
  
  async delete(profileId: string): Promise<boolean> {
    // TODO: Implement with pg client
    throw new Error('PostgreSQL implementation not yet available');
  }
  
  async getByProjectId(projectId: string): Promise<BrandStyleProfile[]> {
    // TODO: Implement with pg client
    throw new Error('PostgreSQL implementation not yet available');
  }
  
  async getActiveByProjectId(projectId: string): Promise<BrandStyleProfile | null> {
    // TODO: Implement with pg client
    throw new Error('PostgreSQL implementation not yet available');
  }
  
  async getVersionHistory(profileId: string): Promise<BrandProfileVersion[]> {
    // TODO: Implement with pg client
    throw new Error('PostgreSQL implementation not yet available');
  }
  
  async restoreVersion(
    profileId: string,
    version: number,
    restoredBy: string
  ): Promise<BrandStyleProfile> {
    // TODO: Implement with pg client
    throw new Error('PostgreSQL implementation not yet available');
  }
  
  async compareProfiles(profileId1: string, profileId2: string): Promise<ProfileComparison> {
    // TODO: Implement with pg client
    throw new Error('PostgreSQL implementation not yet available');
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export type StoreType = 'memory' | 'postgres';

export function createBrandProfileStore(
  type: StoreType,
  options?: { connectionString?: string }
): IBrandProfileStore {
  switch (type) {
    case 'memory':
      return new InMemoryBrandProfileStore();
    case 'postgres':
      if (!options?.connectionString) {
        throw new Error('PostgreSQL connection string required');
      }
      return new PostgresBrandProfileStore(options.connectionString);
    default:
      throw new Error(`Unknown store type: ${type}`);
  }
}
