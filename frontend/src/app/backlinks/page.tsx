'use client';

/**
 * Backlinks Page
 * 
 * v0.7 - Placeholder for backlink analysis
 */

import { RoleGuard } from '@/components/RoleGuard';
import { Sidebar } from '@/components/Sidebar';
import { useProject } from '@/context/ProjectContext';
import { Link2, ExternalLink, Shield } from 'lucide-react';

function BacklinksContent() {
  const { currentProject } = useProject();

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Backlink Analysis</h1>
          <p className="text-gray-600 mt-1">
            {currentProject ? `Backlinks for ${currentProject.domain}` : 'Monitor your backlink profile'}
          </p>
        </div>

        {/* Coming Soon */}
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Link2 className="w-8 h-8 text-purple-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Backlink Analysis Coming Soon</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-8">
            Track your backlink profile, monitor new and lost links, and identify link building opportunities.
          </p>
          <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              <span>Link Discovery</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Toxic Link Detection</span>
            </div>
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              <span>Competitor Analysis</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function BacklinksPage() {
  return (
    <RoleGuard requiredPermissions={['dashboard:view']}>
      <BacklinksContent />
    </RoleGuard>
  );
}
