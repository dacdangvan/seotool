'use client';

/**
 * ProjectSelector Component
 * 
 * v0.7 - Dropdown to select current project
 */

import { useState, useRef, useEffect } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useCanAccess } from '@/components/RoleGuard';
import { ChevronDown, Plus, Globe, Check } from 'lucide-react';
import Link from 'next/link';

export function ProjectSelector() {
  const { projects, currentProject, setCurrentProject, isLoading } = useProject();
  const { canCreateProject } = useCanAccess();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
            <div className="h-3 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="px-4 py-3 border-b border-gray-200">
        <p className="text-sm text-gray-500">No projects available</p>
        {canCreateProject && (
          <Link
            href="/projects/new"
            className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </Link>
        )}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative px-4 py-3 border-b border-gray-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <Globe className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-900 truncate">
            {currentProject?.name || 'Select Project'}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {currentProject?.domain || 'No domain'}
          </p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-4 right-4 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-64 overflow-auto">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => {
                setCurrentProject(project);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors ${
                currentProject?.id === project.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                <Globe className="w-3 h-3 text-gray-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-900 truncate">{project.name}</p>
                <p className="text-xs text-gray-500 truncate">{project.domain}</p>
              </div>
              {currentProject?.id === project.id && (
                <Check className="w-4 h-4 text-blue-600" />
              )}
            </button>
          ))}

          {/* Create new project (Admin only) */}
          {canCreateProject && (
            <>
              <div className="border-t border-gray-200 my-1"></div>
              <Link
                href="/projects/new"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-blue-600"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Create New Project</span>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectSelector;
