/**
 * Project Service
 * 
 * v0.9 - Project API service with crawl status tracking
 * Updated: Support hybrid mode (mock auth + real data)
 */

import { Project, ProjectCreateInput, ProjectUpdateInput, ProjectAccess, CrawlStatus } from '@/types/auth';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
const USE_REAL_DATA = process.env.NEXT_PUBLIC_USE_REAL_DATA === 'true';
// If USE_REAL_DATA is true, always fetch from API regardless of USE_MOCK
const FETCH_FROM_API = USE_REAL_DATA || !USE_MOCK;

const STORAGE_KEY = 'seo_tool_projects';
const ACCESS_STORAGE_KEY = 'seo_tool_project_access';

// Default projects for VIB - Only main website
const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'VIB Main Website',
    domain: 'www.vib.com.vn',
    language: 'vi',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-03-15T10:30:00Z',
    ownerId: 'user-1',
    status: 'active',
    crawlStatus: 'completed',
    crawlProgress: 100,
    lastCrawlAt: '2026-01-20T03:57:32.843Z',
    crawlError: null,
  },
];

// Default project access
const DEFAULT_PROJECT_ACCESS: ProjectAccess[] = [
  // Admin has access to VIB Main Website (user-1 matches mock user)
  { projectId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', userId: 'user-1', role: 'owner', grantedAt: '2024-01-01T00:00:00Z' },
];

// Force reset localStorage on version change
const STORAGE_VERSION = 'v4'; // Increment to force reset
const VERSION_KEY = 'seo_tool_storage_version';

// Load projects from localStorage or use defaults
function loadProjects(): Project[] {
  if (typeof window === 'undefined') return DEFAULT_PROJECTS;
  
  try {
    // Check version - if different, clear old data
    const storedVersion = localStorage.getItem(VERSION_KEY);
    if (storedVersion !== STORAGE_VERSION) {
      console.log('Storage version changed, resetting to defaults...');
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ACCESS_STORAGE_KEY);
      localStorage.removeItem('currentProjectId');
      localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
      return DEFAULT_PROJECTS;
    }
    
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load projects from localStorage:', e);
  }
  return DEFAULT_PROJECTS;
}

// Save projects to localStorage
function saveProjects(projects: Project[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects to localStorage:', e);
  }
}

// Load project access from localStorage or use defaults
function loadProjectAccess(): ProjectAccess[] {
  if (typeof window === 'undefined') return DEFAULT_PROJECT_ACCESS;
  try {
    // Version check already done in loadProjects()
    const saved = localStorage.getItem(ACCESS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load project access from localStorage:', e);
  }
  return DEFAULT_PROJECT_ACCESS;
}

// Save project access to localStorage
function saveProjectAccess(access: ProjectAccess[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(access));
  } catch (e) {
    console.error('Failed to save project access to localStorage:', e);
  }
}

// In-memory mock data (persisted to localStorage)
let mockProjects = loadProjects();
let mockAccess = loadProjectAccess();

// Simulated delay for mock API
const mockDelay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

// Get token from localStorage
const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const auth = localStorage.getItem('auth');
  if (!auth) return null;
  try {
    return JSON.parse(auth).token;
  } catch {
    return null;
  }
};

// Get user ID from localStorage auth data
const getUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const auth = localStorage.getItem('auth');
  if (!auth) return null;
  try {
    const parsed = JSON.parse(auth);
    return parsed.user?.id || null;
  } catch {
    return null;
  }
};

class ProjectService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api';
  }

  /**
   * Get all projects accessible by current user
   */
  async getProjects(): Promise<Project[]> {
    // Use real API if FETCH_FROM_API is true
    if (!FETCH_FROM_API) {
      return this.mockGetProjects();
    }

    try {
      const token = getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${this.baseUrl}/projects`, {
        headers,
      });

      if (!response.ok) {
        console.warn('[ProjectService] API failed, falling back to mock');
        return this.mockGetProjects();
      }

      const data = await response.json();
      // Backend returns { success: true, data: { projects: [...] }}
      const projects = data.data?.projects || data.projects || data || [];
      console.log('[ProjectService] Loaded projects from API:', projects.length);
      return projects;
    } catch (error) {
      console.warn('[ProjectService] API error, falling back to mock:', error);
      return this.mockGetProjects();
    }
  }

  /**
   * Get single project by ID
   */
  async getProject(projectId: string): Promise<Project> {
    // Use real API if FETCH_FROM_API is true
    if (!FETCH_FROM_API) {
      return this.mockGetProject(projectId);
    }

    try {
      const token = getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${this.baseUrl}/projects/${projectId}`, {
        headers,
      });

      if (!response.ok) {
        console.warn('[ProjectService] API failed for project, falling back to mock');
        return this.mockGetProject(projectId);
      }

      const data = await response.json();
      // Backend returns { success: true, data: {...} }
      return data.data || data;
    } catch (error) {
      console.warn('[ProjectService] API error for project, falling back to mock:', error);
      return this.mockGetProject(projectId);
    }
  }

  /**
   * Create a new project
   */
  async createProject(input: ProjectCreateInput): Promise<Project> {
    if (USE_MOCK) {
      return this.mockCreateProject(input);
    }

    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${this.baseUrl}/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Failed to create project');
    }

    return response.json();
  }

  /**
   * Update a project
   */
  async updateProject(projectId: string, input: ProjectUpdateInput): Promise<Project> {
    if (USE_MOCK) {
      return this.mockUpdateProject(projectId, input);
    }

    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${this.baseUrl}/projects/${projectId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Failed to update project');
    }

    return response.json();
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    if (USE_MOCK) {
      return this.mockDeleteProject(projectId);
    }

    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${this.baseUrl}/projects/${projectId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to delete project');
    }
  }

  /**
   * Get project access list
   */
  async getProjectAccess(projectId: string): Promise<ProjectAccess[]> {
    // TODO: Implement when backend endpoint is available
    return [];
  }

  // Mock implementations
  private async mockGetProjects(): Promise<Project[]> {
    await mockDelay();

    const userId = getUserId();
    if (!userId) return [];

    // Filter projects based on user access
    const accessibleProjectIds = mockAccess
      .filter(a => a.userId === userId)
      .map(a => a.projectId);

    return mockProjects.filter(p => 
      accessibleProjectIds.includes(p.id) && p.status === 'active'
    );
  }

  private async mockGetProject(projectId: string): Promise<Project> {
    await mockDelay(200);

    const project = mockProjects.find(p => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Check access
    const userId = getUserId();
    if (userId) {
      const hasAccess = mockAccess.some(
        a => a.projectId === projectId && a.userId === userId
      );
      if (!hasAccess) {
        throw new Error('Access denied');
      }
    }

    return project;
  }

  private async mockCreateProject(input: ProjectCreateInput): Promise<Project> {
    await mockDelay();

    const userId = getUserId() || 'user-1';

    const newProject: Project = {
      id: `project-${Date.now()}`,
      name: input.name,
      domain: input.domain,
      language: input.language,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: userId || 'user-1',
      status: 'active',
    };

    mockProjects.push(newProject);
    saveProjects(mockProjects); // Persist to localStorage

    // Add access for creator
    mockAccess.push({
      projectId: newProject.id,
      userId: userId || 'user-1',
      role: 'owner',
      grantedAt: new Date().toISOString(),
    });
    saveProjectAccess(mockAccess); // Persist to localStorage

    return newProject;
  }

  private async mockUpdateProject(projectId: string, input: ProjectUpdateInput): Promise<Project> {
    await mockDelay();

    const index = mockProjects.findIndex(p => p.id === projectId);
    if (index === -1) {
      throw new Error('Project not found');
    }

    const updated: Project = {
      ...mockProjects[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };

    mockProjects[index] = updated;
    saveProjects(mockProjects); // Persist to localStorage
    return updated;
  }

  private async mockDeleteProject(projectId: string): Promise<void> {
    await mockDelay();

    const index = mockProjects.findIndex(p => p.id === projectId);
    if (index === -1) {
      throw new Error('Project not found');
    }

    // Soft delete by setting status to archived
    mockProjects[index] = { ...mockProjects[index], status: 'archived' };
    saveProjects(mockProjects); // Persist to localStorage
    
    // Remove access
    mockAccess = mockAccess.filter(a => a.projectId !== projectId);
    saveProjectAccess(mockAccess); // Persist to localStorage
  }

  // ===========================================================================
  // CRAWL APIs
  // ===========================================================================

  /**
   * Trigger a crawl for a project
   */
  async triggerCrawl(projectId: string, options?: {
    maxPages?: number;
    maxDepth?: number;
  }): Promise<{ success: boolean; jobId: string; message: string; status: CrawlStatus }> {
    if (USE_MOCK) {
      return this.mockTriggerCrawl(projectId, options);
    }

    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/crawl`, {
      method: 'POST',
      headers,
      body: JSON.stringify(options || {}),
    });

    if (!response.ok) {
      throw new Error('Failed to trigger crawl');
    }

    return response.json();
  }

  /**
   * Get crawl status for a project
   */
  async getCrawlStatus(projectId: string): Promise<{
    projectId: string;
    status: CrawlStatus;
    progress: number;
    isRunning: boolean;
    canTrigger: boolean;
    lastCrawlAt: string | null;
    error?: string;
  }> {
    if (USE_MOCK) {
      return this.mockGetCrawlStatus(projectId);
    }

    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/crawl-status`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch crawl status');
    }

    return response.json();
  }

  /**
   * Cancel a running crawl
   */
  async cancelCrawl(projectId: string): Promise<{ success: boolean; message: string }> {
    if (USE_MOCK) {
      return this.mockCancelCrawl(projectId);
    }

    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/crawl/cancel`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to cancel crawl');
    }

    return response.json();
  }

  // Mock crawl implementations
  private async mockTriggerCrawl(projectId: string, options?: {
    maxPages?: number;
    maxDepth?: number;
  }): Promise<{ success: boolean; jobId: string; message: string; status: CrawlStatus }> {
    await mockDelay(300);

    const index = mockProjects.findIndex(p => p.id === projectId);
    if (index === -1) {
      throw new Error('Project not found');
    }

    const project = mockProjects[index];
    
    // Check if already running
    if (project.crawlStatus === 'running' || project.crawlStatus === 'queued') {
      return {
        success: true,
        jobId: `job-${projectId}-existing`,
        message: 'Crawl already in progress',
        status: project.crawlStatus,
      };
    }

    // Start crawl simulation
    mockProjects[index] = {
      ...project,
      crawlStatus: 'queued',
      crawlProgress: 0,
      crawlError: null,
    };
    saveProjects(mockProjects);

    // Simulate crawl progress in background
    this.simulateCrawlProgress(projectId);

    return {
      success: true,
      jobId: `job-${Date.now()}`,
      message: 'Crawl job created and queued',
      status: 'queued',
    };
  }

  private async mockGetCrawlStatus(projectId: string): Promise<{
    projectId: string;
    status: CrawlStatus;
    progress: number;
    isRunning: boolean;
    canTrigger: boolean;
    lastCrawlAt: string | null;
    error?: string;
  }> {
    await mockDelay(100);

    const project = mockProjects.find(p => p.id === projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const status = project.crawlStatus || 'not_started';
    const isRunning = status === 'running' || status === 'queued';

    return {
      projectId,
      status,
      progress: project.crawlProgress || 0,
      isRunning,
      canTrigger: !isRunning,
      lastCrawlAt: project.lastCrawlAt || null,
      error: project.crawlError || undefined,
    };
  }

  private async mockCancelCrawl(projectId: string): Promise<{ success: boolean; message: string }> {
    await mockDelay(200);

    const index = mockProjects.findIndex(p => p.id === projectId);
    if (index === -1) {
      throw new Error('Project not found');
    }

    const project = mockProjects[index];
    if (project.crawlStatus !== 'running' && project.crawlStatus !== 'queued') {
      return {
        success: false,
        message: 'No active crawl to cancel',
      };
    }

    mockProjects[index] = {
      ...project,
      crawlStatus: 'cancelled',
      crawlProgress: project.crawlProgress || 0,
    };
    saveProjects(mockProjects);

    return {
      success: true,
      message: 'Crawl cancelled successfully',
    };
  }

  private simulateCrawlProgress(projectId: string): void {
    let progress = 0;
    
    const interval = setInterval(() => {
      const index = mockProjects.findIndex(p => p.id === projectId);
      if (index === -1) {
        clearInterval(interval);
        return;
      }

      const project = mockProjects[index];
      
      // Check if cancelled
      if (project.crawlStatus === 'cancelled') {
        clearInterval(interval);
        return;
      }

      // Update status to running
      if (project.crawlStatus === 'queued') {
        mockProjects[index] = { ...project, crawlStatus: 'running' };
        saveProjects(mockProjects);
      }

      // Increment progress
      progress += Math.random() * 15 + 5;
      
      if (progress >= 100) {
        // Complete
        mockProjects[index] = {
          ...mockProjects[index],
          crawlStatus: 'completed',
          crawlProgress: 100,
          lastCrawlAt: new Date().toISOString(),
        };
        saveProjects(mockProjects);
        clearInterval(interval);
      } else {
        mockProjects[index] = {
          ...mockProjects[index],
          crawlProgress: Math.min(Math.round(progress), 99),
        };
        saveProjects(mockProjects);
      }
    }, 1000);
  }
}

export const projectService = new ProjectService();
export default projectService;
