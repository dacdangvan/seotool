'use client';

/**
 * Keywords List Page
 * 
 * Full keyword list with advanced filtering, sorting, and pagination
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Module 1 – Keyword Intelligence Agent
 */

import { RoleGuard } from '@/components/RoleGuard';
import { Sidebar } from '@/components/Sidebar';
import { useProject } from '@/context/ProjectContext';
import { useKeywords } from '@/hooks/useKeyword';
import { KeywordFilters, KeywordTable } from '@/components/keywords';
import { 
  RefreshCw, 
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

function KeywordsListContent() {
  const { currentProject } = useProject();
  const projectId = currentProject?.id || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  
  const {
    keywords,
    total,
    totalPages,
    loading,
    error,
    filters,
    updateFilter,
    resetFilters,
    hasActiveFilters,
    sortField,
    sortDirection,
    updateSort,
    page,
    pageSize,
    goToPage,
    updatePageSize,
    refetch,
  } = useKeywords(projectId);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/keywords"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Keyword List</h1>
            </div>
            <p className="text-gray-600 ml-8">
              {currentProject 
                ? `All tracked keywords for ${currentProject.name}` 
                : 'Explore and filter your keyword inventory'}
            </p>
          </div>
          <button 
            onClick={() => refetch()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-red-800 font-medium">Error loading keywords</p>
              <p className="text-red-600 text-sm">{error.message}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <section className="mb-6">
          <KeywordFilters
            filters={filters}
            onFilterChange={updateFilter}
            onReset={resetFilters}
            hasActiveFilters={hasActiveFilters}
            totalResults={total}
          />
        </section>

        {/* Keyword Table */}
        <section>
          <KeywordTable
            keywords={keywords}
            loading={loading}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={updateSort}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            total={total}
            onPageChange={goToPage}
            onPageSizeChange={updatePageSize}
          />
        </section>
      </main>
    </div>
  );
}

export default function KeywordsListPage() {
  return (
    <RoleGuard requiredPermissions={['dashboard:view']}>
      <KeywordsListContent />
    </RoleGuard>
  );
}
