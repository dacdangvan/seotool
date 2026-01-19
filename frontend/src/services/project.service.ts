/**
 * Project Service
 * 
 * v0.7 - Project API service with mock support
 */

import { Project, ProjectCreateInput, ProjectUpdateInput, ProjectAccess } from '@/types/auth';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

// Mock projects for development
const MOCK_PROJECTS: Project[] = [
  {
    id: 'project-1',
    name: 'VIB Main Website',
    domain: 'www.vib.com.vn',
    language: 'vi',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-03-15T10:30:00Z',
    ownerId: 'user-1',
    status: 'active',
  },
  {
    id: 'project-2',
    name: 'VIB Digital Banking',
    domain: 'digital.vib.com.vn',
    language: 'vi',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-03-14T08:20:00Z',
    ownerId: 'user-1',
    status: 'active',
  },
  {
    id: 'project-3',
    name: 'VIB Blog',
    domain: 'blog.vib.com.vn',
    language: 'vi',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-13T15:45:00Z',
    ownerId: 'user-1',
    status: 'active',
  },
];

// Mock project access (which user can access which project)
const MOCK_PROJECT_ACCESS: ProjectAccess[] = [
  // Admin has access to all projects
  { projectId: 'project-1', userId: 'user-1', role: 'owner', grantedAt: '2024-01-01T00:00:00Z' },
  { projectId: 'project-2', userId: 'user-1', role: 'owner', grantedAt: '2024-02-01T00:00:00Z' },
  { projectId: 'project-3', userId: 'user-1', role: 'owner', grantedAt: '2024-03-01T00:00:00Z' },
  // Editor 1 has access to project 1 and 2
  { projectId: 'project-1', userId: 'user-2', role: 'editor', grantedAt: '2024-01-15T00:00:00Z' },
  { projectId: 'project-2', userId: 'user-2', role: 'editor', grantedAt: '2024-02-15T00:00:00Z' },
  // Editor 2 has access only to project 3
  { projectId: 'project-3', userId: 'user-3', role: 'editor', grantedAt: '2024-03-01T00:00:00Z' },
];

// In-memory mock data (mutable for create/update/delete)
let mockProjects = [...MOCK_PROJECTS];
let mockAccess = [...MOCK_PROJECT_ACCESS];

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

// Extract user ID from mock token
const getUserIdFromToken = (token: string): string | null => {
  const parts = token.split('-');
  return parts.length >= 3 ? parts[2] : null;
};

class ProjectService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
  }

  /**
   * Get all projects accessible by current user
   */
  async getProjects(): Promise<Project[]> {
    if (USE_MOCK) {
      return this.mockGetProjects();
    }

    const token = getToken();
    const response = await fetch(`${this.baseUrl}/projects`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }

    return response.json();
  }

  /**
   * Get single project by ID
   */
  async getProject(projectId: string): Promise<Project> {
    if (USE_MOCK) {
      return this.mockGetProject(projectId);
    }

    const token = getToken();
    const response = await fetch(`${this.baseUrl}/projects/${projectId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Project not found');
    }

    return response.json();
  }

  /**
   * Create a new project
   */
  async createProject(input: ProjectCreateInput): Promise<Project> {
    if (USE_MOCK) {
      return this.mockCreateProject(input);
    }

    const token = getToken();
    const response = await fetch(`${this.baseUrl}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
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
    const response = await fetch(`${this.baseUrl}/projects/${projectId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
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
    const response = await fetch(`${this.baseUrl}/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete project');
    }
  }

  /**
   * Get project access list
   */
  async getProjectAccess(projectId: string): Promise<ProjectAccess[]> {
    if (USE_MOCK) {
      await mockDelay(200);
      return mockAccess.filter(a => a.projectId === projectId);
    }

    const token = getToken();
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/access`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch project access');
    }

    return response.json();
  }

  // Mock implementations
  private async mockGetProjects(): Promise<Project[]> {
    await mockDelay();

    const token = getToken();
    if (!token) return [];

    const userId = getUserIdFromToken(token);
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
    const token = getToken();
    if (token) {
      const userId = getUserIdFromToken(token);
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

    const token = getToken();
    const userId = token ? getUserIdFromToken(token) : 'user-1';

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

    // Add access for creator
    mockAccess.push({
      projectId: newProject.id,
      userId: userId || 'user-1',
      role: 'owner',
      grantedAt: new Date().toISOString(),
    });

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
    
    // Remove access
    mockAccess = mockAccess.filter(a => a.projectId !== projectId);
  }
}

export const projectService = new ProjectService();
export default projectService;
