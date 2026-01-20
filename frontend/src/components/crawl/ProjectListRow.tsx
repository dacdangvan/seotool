/**
 * ProjectListRow Component
 * 
 * Displays a single project row with crawl status
 * - Shows project info, crawl status, and actions
 * - Admin can trigger re-crawl
 * - Editor can only view status
 */

'use client';

import { useState } from 'react';
import { 
  Globe, 
  Settings, 
  ExternalLink,
  Play,
  StopCircle,
  MoreVertical,
  Trash2,
  Edit
} from 'lucide-react';
import { Project, UserRole } from '@/types/auth';
import { CrawlStatusBadge } from './CrawlStatusIcon';
import { useCrawlStatus } from '@/hooks/useCrawlStatus';

interface ProjectListRowProps {
  project: Project;
  userRole: UserRole;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onSelect?: (project: Project) => void;
  isSelected?: boolean;
}

export function ProjectListRow({
  project,
  userRole,
  onEdit,
  onDelete,
  onSelect,
  isSelected = false,
}: ProjectListRowProps) {
  const [showActions, setShowActions] = useState(false);
  
  const {
    status,
    progress,
    isRunning,
    canTrigger,
    lastCrawlAt,
    isLoading,
    triggerCrawl,
    cancelCrawl,
  } = useCrawlStatus(project.id, {
    pollingInterval: 2000,
    onComplete: () => {
      console.log(`Crawl completed for project: ${project.name}`);
    },
    onError: (error) => {
      console.error(`Crawl failed for project: ${project.name}`, error);
    },
  });

  const canManageCrawl = userRole === UserRole.ADMIN;

  const handleTriggerCrawl = async () => {
    try {
      await triggerCrawl();
    } catch (error) {
      console.error('Failed to trigger crawl:', error);
    }
  };

  const handleCancelCrawl = async () => {
    try {
      await cancelCrawl();
    } catch (error) {
      console.error('Failed to cancel crawl:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div
      className={`
        group relative
        flex items-center gap-4 
        p-4 
        bg-white 
        border border-gray-200 
        rounded-lg
        hover:border-blue-300
        hover:shadow-sm
        transition-all duration-200
        ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''}
      `}
      role="listitem"
      aria-label={`Project: ${project.name}`}
    >
      {/* Project Icon */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
          <Globe className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Project Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 
            className="font-semibold text-gray-900 truncate cursor-pointer hover:text-blue-600"
            onClick={() => onSelect?.(project)}
          >
            {project.name}
          </h3>
          <a
            href={`https://${project.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-blue-500 transition-colors"
            aria-label={`Open ${project.domain} in new tab`}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
        <p className="text-sm text-gray-500 truncate">{project.domain}</p>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-xs text-gray-400">
            Created: {formatDate(project.createdAt)}
          </span>
          {lastCrawlAt && (
            <span className="text-xs text-gray-400">
              Last crawl: {formatDate(lastCrawlAt)}
            </span>
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

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Crawl Actions - Only for Admin/Owner */}
        {canManageCrawl && (
          <>
            {isRunning ? (
              <button
                onClick={handleCancelCrawl}
                disabled={isLoading}
                className="
                  flex items-center gap-1.5
                  px-3 py-1.5
                  text-sm font-medium
                  text-red-600 
                  bg-red-50 
                  hover:bg-red-100
                  rounded-lg
                  transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
                aria-label="Cancel crawl"
              >
                <StopCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Cancel</span>
              </button>
            ) : (
              <button
                onClick={handleTriggerCrawl}
                disabled={isLoading || !canTrigger}
                className="
                  flex items-center gap-1.5
                  px-3 py-1.5
                  text-sm font-medium
                  text-blue-600 
                  bg-blue-50 
                  hover:bg-blue-100
                  rounded-lg
                  transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
                aria-label="Trigger crawl"
              >
                <Play className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {status === 'not_started' ? 'Start Crawl' : 'Re-crawl'}
                </span>
              </button>
            )}
          </>
        )}

        {/* More Actions Menu */}
        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="
              p-2
              text-gray-400
              hover:text-gray-600
              hover:bg-gray-100
              rounded-lg
              transition-colors
            "
            aria-label="More actions"
            aria-expanded={showActions}
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Dropdown Menu */}
          {showActions && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-10"
                onClick={() => setShowActions(false)}
              />
              
              {/* Menu */}
              <div className="
                absolute right-0 top-full mt-1
                w-48
                bg-white
                border border-gray-200
                rounded-lg
                shadow-lg
                z-20
                py-1
              ">
                <button
                  onClick={() => {
                    onEdit?.(project);
                    setShowActions(false);
                  }}
                  className="
                    w-full flex items-center gap-2
                    px-4 py-2
                    text-sm text-gray-700
                    hover:bg-gray-50
                    transition-colors
                  "
                >
                  <Edit className="w-4 h-4" />
                  Edit Project
                </button>
                <button
                  onClick={() => {
                    onSelect?.(project);
                    setShowActions(false);
                  }}
                  className="
                    w-full flex items-center gap-2
                    px-4 py-2
                    text-sm text-gray-700
                    hover:bg-gray-50
                    transition-colors
                  "
                >
                  <Settings className="w-4 h-4" />
                  Project Settings
                </button>
                {canManageCrawl && (
                  <button
                    onClick={() => {
                      onDelete?.(project);
                      setShowActions(false);
                    }}
                    className="
                      w-full flex items-center gap-2
                      px-4 py-2
                      text-sm text-red-600
                      hover:bg-red-50
                      transition-colors
                    "
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Project
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

export default ProjectListRow;
