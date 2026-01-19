'use client';

/**
 * Keywords Page
 * 
 * v0.7 - Placeholder for keyword research
 */

import { RoleGuard } from '@/components/RoleGuard';
import { Sidebar } from '@/components/Sidebar';
import { useProject } from '@/context/ProjectContext';
import { Search, TrendingUp, Target } from 'lucide-react';

function KeywordsContent() {
  const { currentProject } = useProject();

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Keyword Research</h1>
          <p className="text-gray-600 mt-1">
            {currentProject ? `Analyzing keywords for ${currentProject.name}` : 'Discover and track keywords'}
          </p>
        </div>

        {/* Coming Soon */}
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Search className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Keyword Research Coming Soon</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-8">
            Discover high-value keywords, track rankings, and find opportunities to improve your SEO.
          </p>
          <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Rank Tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span>Opportunity Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              <span>Competitor Research</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function KeywordsPage() {
  return (
    <RoleGuard requiredPermissions={['dashboard:view']}>
      <KeywordsContent />
    </RoleGuard>
  );
}
