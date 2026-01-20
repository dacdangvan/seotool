'use client';

/**
 * Project Context
 * 
 * v0.7 - Global project state management
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { Project, ProjectCreateInput, ProjectUpdateInput, ProjectAccess } from '@/types/auth';
import { projectService } from '@/services/project.service';
import { useAuth } from './AuthContext';

// State interface
interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  accessList: ProjectAccess[];
  isLoading: boolean;
  error: string | null;
}

// Action types
type ProjectAction =
  | { type: 'SET_LOADING' }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'SET_CURRENT_PROJECT'; payload: Project | null }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'SET_ACCESS_LIST'; payload: ProjectAccess[] }
  | { type: 'SET_ERROR'; payload: string };

// Initial state
const initialState: ProjectState = {
  projects: [],
  currentProject: null,
  accessList: [],
  isLoading: false,
  error: null,
};

// Reducer
function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: true, error: null };
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload, isLoading: false };
    case 'SET_CURRENT_PROJECT':
      return { ...state, currentProject: action.payload };
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload], isLoading: false };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.id ? action.payload : p
        ),
        currentProject: state.currentProject?.id === action.payload.id
          ? action.payload
          : state.currentProject,
        isLoading: false,
      };
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.payload),
        currentProject: state.currentProject?.id === action.payload
          ? null
          : state.currentProject,
        isLoading: false,
      };
    case 'SET_ACCESS_LIST':
      return { ...state, accessList: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    default:
      return state;
  }
}

// Context interface
interface ProjectContextValue extends ProjectState {
  fetchProjects: () => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  selectProjectById: (projectId: string) => void;
  createProject: (input: ProjectCreateInput) => Promise<Project>;
  updateProject: (projectId: string, input: ProjectUpdateInput) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
}

// Create context
const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

// Provider component
interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  const { user, isAuthenticated } = useAuth();

  // Fetch projects on auth change
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchProjects();
    } else {
      dispatch({ type: 'SET_PROJECTS', payload: [] });
      dispatch({ type: 'SET_CURRENT_PROJECT', payload: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    dispatch({ type: 'SET_LOADING' });

    try {
      const projects = await projectService.getProjects();
      dispatch({ type: 'SET_PROJECTS', payload: projects });

      // Auto-select project if none selected
      if (!state.currentProject && projects.length > 0) {
        // Check localStorage for last selected project
        const lastProjectId = localStorage.getItem('currentProjectId');
        const lastProject = projects.find((p: Project) => p.id === lastProjectId);
        
        // Default to VIB Main Website (www.vib.com.vn) if no last project
        const vibMainProject = projects.find((p: Project) => p.domain === 'www.vib.com.vn');
        
        dispatch({ 
          type: 'SET_CURRENT_PROJECT', 
          payload: lastProject || vibMainProject || projects[0] 
        });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch projects' });
      console.error('Fetch projects error:', error);
    }
  }, [state.currentProject]);

  // Set current project
  const setCurrentProject = useCallback((project: Project | null) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: project });
    if (project) {
      localStorage.setItem('currentProjectId', project.id);
    } else {
      localStorage.removeItem('currentProjectId');
    }
  }, []);

  // Select project by ID
  const selectProjectById = useCallback((projectId: string) => {
    const project = state.projects.find(p => p.id === projectId);
    if (project) {
      setCurrentProject(project);
    }
  }, [state.projects, setCurrentProject]);

  // Create project
  const createProject = useCallback(async (input: ProjectCreateInput): Promise<Project> => {
    dispatch({ type: 'SET_LOADING' });

    try {
      const project = await projectService.createProject(input);
      dispatch({ type: 'ADD_PROJECT', payload: project });
      return project;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to create project' });
      throw error;
    }
  }, []);

  // Update project
  const updateProject = useCallback(async (projectId: string, input: ProjectUpdateInput): Promise<Project> => {
    dispatch({ type: 'SET_LOADING' });

    try {
      const project = await projectService.updateProject(projectId, input);
      dispatch({ type: 'UPDATE_PROJECT', payload: project });
      return project;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update project' });
      throw error;
    }
  }, []);

  // Delete project
  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    dispatch({ type: 'SET_LOADING' });

    try {
      await projectService.deleteProject(projectId);
      dispatch({ type: 'DELETE_PROJECT', payload: projectId });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete project' });
      throw error;
    }
  }, []);

  const value: ProjectContextValue = {
    ...state,
    fetchProjects,
    setCurrentProject,
    selectProjectById,
    createProject,
    updateProject,
    deleteProject,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

// Custom hook
export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

export default ProjectContext;
