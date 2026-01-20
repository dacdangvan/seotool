/**
 * Auth Types
 * 
 * v0.7 - Authentication and authorization types
 */

// User roles - extensible enum
export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
}

// Role permissions mapping
export const RolePermissions = {
  [UserRole.ADMIN]: [
    'projects:create',
    'projects:edit',
    'projects:delete',
    'projects:view',
    'users:manage',
    'content:create',
    'content:edit',
    'content:delete',
    'content:view',
    'dashboard:view',
    'settings:manage',
  ],
  [UserRole.EDITOR]: [
    'projects:view',
    'content:create',
    'content:edit',
    'content:view',
    'dashboard:view',
  ],
} as const;

export type Permission = typeof RolePermissions[UserRole][number];

// User interface
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
}

// Auth state
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Login credentials
export interface LoginCredentials {
  email: string;
  password: string;
}

// Auth response from API
export interface AuthResponse {
  user: User;
  token: string;
  expiresAt: string;
}

// Project types
export type CrawlStatus = 'not_started' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Project {
  id: string;
  name: string;
  domain: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  status: 'active' | 'archived';
  // Crawl status fields
  crawlStatus?: CrawlStatus;
  crawlProgress?: number;
  lastCrawlAt?: string;
  crawlError?: string | null;
}

export interface ProjectCreateInput {
  name: string;
  domain: string;
  language: string;
}

export interface ProjectUpdateInput {
  name?: string;
  domain?: string;
  language?: string;
  status?: 'active' | 'archived';
}

// Project access for users
export interface ProjectAccess {
  projectId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  grantedAt: string;
}

// Content types
export type ContentStatus = 'draft' | 'review' | 'approved' | 'published';

export interface SEOContent {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  status: ContentStatus;
  primaryKeyword: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentCreateInput {
  title: string;
  primaryKeyword: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
}

export interface ContentUpdateInput {
  title?: string;
  primaryKeyword?: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
  status?: ContentStatus;
}
