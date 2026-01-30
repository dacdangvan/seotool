/**
 * Crawl Dashboard Page
 * 
 * High-level crawl health overview per project
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { RoleGuard } from '@/components/RoleGuard';
import { CrawlDashboard } from '@/components/crawl';
import { UserRole } from '@/types/auth';
import { useProject } from '@/context/ProjectContext';

export default function CrawlDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProject } = useProject();
  
  // Get project ID from context, URL param, or fallback to real project UUID
  const projectId = currentProject?.id || searchParams.get('projectId') || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  // Handle navigation to pages view
  const handleNavigateToPages = (filter?: string) => {
    if (filter === 'start-crawl') {
      // Navigate to projects page to trigger crawl
      router.push('/projects');
      return;
    }

    // Build query params for pages filter
    const params = new URLSearchParams();
    params.set('projectId', projectId);
    
    if (filter) {
      params.set('filter', filter);
    }

    router.push(`/crawl?${params.toString()}`);
  };

  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.EDITOR]}>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        
        <main className="ml-64 p-8">
          {/* Page Header */}
          <div className="mb-8">
            <nav className="text-sm text-gray-500 mb-2">
              <span className="hover:text-gray-700 cursor-pointer" onClick={() => router.push('/projects')}>
                Projects
              </span>
              <span className="mx-2">/</span>
              <span className="text-gray-700">Crawl Dashboard</span>
            </nav>
          </div>

          {/* Dashboard Content */}
          <CrawlDashboard
            projectId={projectId}
            onNavigateToPages={handleNavigateToPages}
          />
        </main>
      </div>
    </RoleGuard>
  );
}
