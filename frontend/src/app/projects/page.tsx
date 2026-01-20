'use client';

/**
 * Projects Page
 * 
 * v0.8 - Project management page with Crawl Status UI
 * - Display crawl status icon per project
 * - Real-time progress updates via polling
 * - Admin can trigger re-crawl, Editor can only view
 */

import { useState, useEffect } from 'react';
import { useProject } from '@/context/ProjectContext';
import { RoleGuard, useCanAccess } from '@/components/RoleGuard';
import { Sidebar } from '@/components/Sidebar';
import { UserRole, Project, ProjectCreateInput } from '@/types/auth';
import { CrawlStatusBadge } from '@/components/crawl/CrawlStatusIcon';
import { useCrawlStatus, useMultiProjectCrawlStatus } from '@/hooks/useCrawlStatus';
import {
  Plus,
  Globe,
  MoreVertical,
  Pencil,
  Trash2,
  Archive,
  ExternalLink,
  Search,
  Filter,
  Play,
  StopCircle,
  LayoutGrid,
  List,
  RefreshCw,
} from 'lucide-react';

function ProjectsContent() {
  const { projects, createProject, updateProject, deleteProject, isLoading } = useProject();
  const { canCreateProject, canDeleteProject } = useCanAccess();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Multi-project crawl status tracking
  const projectIds = projects.map(p => p.id);
  const { statusMap, hasRunningCrawl, refresh: refreshStatuses } = useMultiProjectCrawlStatus(
    projectIds,
    { pollingInterval: 2000 }
  );

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateProject = async (input: ProjectCreateInput) => {
    await createProject(input);
    setShowCreateModal(false);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject(projectId);
    }
    setOpenMenuId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-600 mt-1">Manage your SEO projects</p>
          </div>
          {canCreateProject && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Project
            </button>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}
              aria-label="List view"
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}
              aria-label="Grid view"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
          
          {/* Refresh Status */}
          {hasRunningCrawl && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Crawling...</span>
            </div>
          )}
          
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="w-5 h-5" />
            Filter
          </button>
        </div>

        {/* Projects List/Grid */}
        {isLoading ? (
          <ProjectsLoading viewMode={viewMode} />
        ) : filteredProjects.length === 0 ? (
          <EmptyProjects 
            searchQuery={searchQuery}
            canCreate={canCreateProject}
            onCreateClick={() => setShowCreateModal(true)}
          />
        ) : viewMode === 'list' ? (
          /* List View with Crawl Status */
          <div className="space-y-3">
            {filteredProjects.map((project) => (
              <ProjectListItem
                key={project.id}
                project={project}
                crawlStatus={statusMap[project.id]}
                isMenuOpen={openMenuId === project.id}
                onMenuToggle={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                onEdit={() => {
                  setEditingProject(project);
                  setOpenMenuId(null);
                }}
                onDelete={() => handleDeleteProject(project.id)}
                canDelete={canDeleteProject}
              />
            ))}
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectGridItem
                key={project.id}
                project={project}
                crawlStatus={statusMap[project.id]}
                isMenuOpen={openMenuId === project.id}
                onMenuToggle={() => setOpenMenuId(openMenuId === project.id ? null : project.id)}
                onEdit={() => {
                  setEditingProject(project);
                  setOpenMenuId(null);
                }}
                onDelete={() => handleDeleteProject(project.id)}
                canDelete={canDeleteProject}
              />
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || editingProject) && (
          <ProjectModal
            project={editingProject}
            onClose={() => {
              setShowCreateModal(false);
              setEditingProject(null);
            }}
            onSave={async (input) => {
              if (editingProject) {
                await updateProject(editingProject.id, input);
                setEditingProject(null);
              } else {
                await handleCreateProject(input);
              }
            }}
          />
        )}
      </main>
    </div>
  );
}

// Project Modal Component
interface ProjectModalProps {
  project: Project | null;
  onClose: () => void;
  onSave: (input: ProjectCreateInput) => Promise<void>;
}

function ProjectModal({ project, onClose, onSave }: ProjectModalProps) {
  const [name, setName] = useState(project?.name || '');
  const [domain, setDomain] = useState(project?.domain || '');
  const [language, setLanguage] = useState(project?.language || 'vi');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSave({ name, domain, language });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 m-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {project ? 'Edit Project' : 'Create New Project'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="My SEO Project"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Domain
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="www.example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="vi">Vietnamese</option>
              <option value="en">English</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="zh">Chinese</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Saving...' : project ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-components for Project List
// ===========================================================================

// Loading state component
function ProjectsLoading({ viewMode }: { viewMode: 'grid' | 'list' }) {
  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg p-4 animate-pulse flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
            <div className="w-20 h-8 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-xl p-6 animate-pulse">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  );
}

// Empty state component
function EmptyProjects({
  searchQuery,
  canCreate,
  onCreateClick,
}: {
  searchQuery: string;
  canCreate: boolean;
  onCreateClick: () => void;
}) {
  return (
    <div className="text-center py-12">
      <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
      <p className="text-gray-500 mb-6">
        {searchQuery
          ? 'Try adjusting your search query'
          : 'Get started by creating your first project'}
      </p>
      {canCreate && !searchQuery && (
        <button
          onClick={onCreateClick}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Project
        </button>
      )}
    </div>
  );
}

// Crawl Status Data Type
interface CrawlStatusData {
  status: 'not_started' | 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
  progress: number;
  isRunning: boolean;
  canTrigger: boolean;
  lastCrawlAt: string | null;
}

// Project List Item with Crawl Status
function ProjectListItem({
  project,
  crawlStatus,
  isMenuOpen,
  onMenuToggle,
  onEdit,
  onDelete,
  canDelete,
}: {
  project: Project;
  crawlStatus: CrawlStatusData | null;
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { 
    status, 
    progress, 
    isRunning, 
    canTrigger, 
    lastCrawlAt,
    triggerCrawl,
    cancelCrawl,
    isLoading: crawlLoading,
  } = useCrawlStatus(project.id);

  const handleTriggerCrawl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await triggerCrawl();
    } catch (error) {
      console.error('Failed to trigger crawl:', error);
    }
  };

  const handleCancelCrawl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await cancelCrawl();
    } catch (error) {
      console.error('Failed to cancel crawl:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all">
      <div className="flex items-center gap-4">
        {/* Project Icon */}
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Globe className="w-5 h-5 text-white" />
        </div>

        {/* Project Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
            <a
              href={`https://${project.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-blue-500"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{project.domain}</span>
            <span>•</span>
            <span>{project.language.toUpperCase()}</span>
            {lastCrawlAt && (
              <>
                <span>•</span>
                <span className="text-xs">
                  Last crawl: {new Date(lastCrawlAt).toLocaleDateString('vi-VN')}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Crawl Status */}
        <div className="flex-shrink-0">
          <CrawlStatusBadge
            status={status}
            progress={progress}
            lastCrawlAt={lastCrawlAt}
            size="md"
          />
        </div>

        {/* Crawl Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isRunning ? (
            <button
              onClick={handleCancelCrawl}
              disabled={crawlLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Cancel crawl"
            >
              <StopCircle className="w-4 h-4" />
              <span className="hidden md:inline">Cancel</span>
            </button>
          ) : (
            <button
              onClick={handleTriggerCrawl}
              disabled={crawlLoading || !canTrigger}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Trigger crawl"
            >
              <Play className="w-4 h-4" />
              <span className="hidden md:inline">
                {status === 'not_started' ? 'Crawl' : 'Re-crawl'}
              </span>
            </button>
          )}
        </div>

        {/* Actions Menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-gray-400" />
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={onMenuToggle} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={onEdit}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={onMenuToggle}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
                {canDelete && (
                  <button
                    onClick={onDelete}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Project Grid Item with Crawl Status
function ProjectGridItem({
  project,
  crawlStatus,
  isMenuOpen,
  onMenuToggle,
  onEdit,
  onDelete,
  canDelete,
}: {
  project: Project;
  crawlStatus: CrawlStatusData | null;
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { 
    status, 
    progress, 
    isRunning, 
    canTrigger, 
    lastCrawlAt,
    triggerCrawl,
    cancelCrawl,
    isLoading: crawlLoading,
  } = useCrawlStatus(project.id);

  const handleTriggerCrawl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await triggerCrawl();
    } catch (error) {
      console.error('Failed to trigger crawl:', error);
    }
  };

  const handleCancelCrawl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await cancelCrawl();
    } catch (error) {
      console.error('Failed to cancel crawl:', error);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{project.name}</h3>
            <a
              href={`https://${project.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1"
            >
              {project.domain}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative">
          <button
            onClick={onMenuToggle}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-gray-400" />
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={onMenuToggle} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={onEdit}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={onMenuToggle}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
                {canDelete && (
                  <button
                    onClick={onDelete}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Crawl Status Section */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Crawl Status
          </span>
          <CrawlStatusBadge status={status} size="sm" />
        </div>
        
        {isRunning && (
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Crawl Action Button */}
        <div className="mt-2">
          {isRunning ? (
            <button
              onClick={handleCancelCrawl}
              disabled={crawlLoading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <StopCircle className="w-4 h-4" />
              Cancel Crawl
            </button>
          ) : (
            <button
              onClick={handleTriggerCrawl}
              disabled={crawlLoading || !canTrigger}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {status === 'not_started' ? 'Start Crawl' : 'Re-crawl'}
            </button>
          )}
        </div>
      </div>

      {/* Project Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Active
        </span>
        <span>Language: {project.language.toUpperCase()}</span>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          {lastCrawlAt 
            ? `Last crawl: ${new Date(lastCrawlAt).toLocaleDateString('vi-VN')}`
            : `Created: ${new Date(project.createdAt).toLocaleDateString('vi-VN')}`
          }
        </p>
      </div>
    </div>
  );
}

// Export with RoleGuard (Admin only for full access)
export default function ProjectsPage() {
  return (
    <RoleGuard requiredPermissions={['projects:view']}>
      <ProjectsContent />
    </RoleGuard>
  );
}
