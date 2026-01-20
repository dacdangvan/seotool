'use client';

/**
 * Keywords Overview Page
 * 
 * v0.8 - Keyword Research Overview MVP
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Module 1 – Keyword Intelligence Agent
 * 
 * Displays:
 * - KPI Cards: Total keywords, High opportunity, Transactional, Unmapped
 * - Charts: Search volume distribution, Difficulty distribution, Intent breakdown
 * - Top Opportunities table
 */

import { RoleGuard } from '@/components/RoleGuard';
import { Sidebar } from '@/components/Sidebar';
import { useProject } from '@/context/ProjectContext';
import { useKeywordOverview } from '@/hooks/useKeyword';
import { KeywordOverviewCards, KeywordCharts } from '@/components/keywords';
import { formatNumber, formatCompact } from '@/lib/utils';
import { 
  Search, 
  TrendingUp, 
  RefreshCw, 
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Minus,
  AlertCircle
} from 'lucide-react';
import type { Keyword, SearchIntent } from '@/types/keyword.types';

// Intent badge colors
const INTENT_COLORS: Record<SearchIntent, string> = {
  informational: 'bg-blue-100 text-blue-700',
  commercial: 'bg-violet-100 text-violet-700',
  transactional: 'bg-green-100 text-green-700',
  navigational: 'bg-gray-100 text-gray-700',
};

const INTENT_LABELS: Record<SearchIntent, string> = {
  informational: 'Tìm hiểu',
  commercial: 'So sánh',
  transactional: 'Mua hàng',
  navigational: 'Điều hướng',
};

function RankChangeBadge({ change }: { change: number | null }) {
  if (change === null) return <span className="text-gray-400">—</span>;
  if (change > 0) return (
    <span className="inline-flex items-center text-green-600 text-sm">
      <ArrowUp className="w-3 h-3 mr-1" />
      {change}
    </span>
  );
  if (change < 0) return (
    <span className="inline-flex items-center text-red-600 text-sm">
      <ArrowDown className="w-3 h-3 mr-1" />
      {Math.abs(change)}
    </span>
  );
  return (
    <span className="inline-flex items-center text-gray-500 text-sm">
      <Minus className="w-3 h-3 mr-1" />
      0
    </span>
  );
}

function TopOpportunitiesTable({ keywords }: { keywords: Keyword[] }) {
  if (!keywords.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        Chưa có dữ liệu cơ hội từ khóa
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Từ khóa</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Volume</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Độ khó</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Ý định</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Rank</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Thay đổi</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">URL ánh xạ</th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((kw) => (
            <tr key={kw.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 px-4">
                <span className="font-medium text-gray-900">{kw.keyword}</span>
              </td>
              <td className="py-3 px-4 text-right">
                <span className="text-gray-700">{formatCompact(kw.searchVolume)}</span>
              </td>
              <td className="py-3 px-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        kw.difficulty <= 30 ? 'bg-green-500' :
                        kw.difficulty <= 60 ? 'bg-amber-500' :
                        kw.difficulty <= 80 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${kw.difficulty}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600">{kw.difficulty}</span>
                </div>
              </td>
              <td className="py-3 px-4 text-center">
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${INTENT_COLORS[kw.intent]}`}>
                  {INTENT_LABELS[kw.intent]}
                </span>
              </td>
              <td className="py-3 px-4 text-center">
                <span className="text-gray-700">{kw.currentRank ?? '—'}</span>
              </td>
              <td className="py-3 px-4 text-center">
                <RankChangeBadge change={kw.rankChange} />
              </td>
              <td className="py-3 px-4">
                {kw.mappedUrl ? (
                  <a 
                    href={kw.mappedUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 truncate max-w-[200px]"
                  >
                    {kw.mappedUrl}
                    <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="text-amber-600 text-sm">Chưa ánh xạ</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeywordsContent() {
  const { currentProject } = useProject();
  const projectId = currentProject?.id || 'default';
  const { data, loading, error, refetch } = useKeywordOverview(projectId);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Keyword Research</h1>
            <p className="text-gray-600 mt-1">
              {currentProject ? `Phân tích từ khóa cho ${currentProject.name}` : 'Khám phá và theo dõi từ khóa'}
            </p>
          </div>
          <button 
            onClick={() => refetch()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-red-800 font-medium">Lỗi tải dữ liệu</p>
              <p className="text-red-600 text-sm">{error.message}</p>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <section className="mb-8">
          <KeywordOverviewCards 
            kpis={data?.kpis || {
              totalKeywords: 0,
              totalKeywordsChange: 0,
              highOpportunityKeywords: 0,
              highOpportunityChange: 0,
              transactionalKeywords: 0,
              transactionalChange: 0,
              unmappedKeywords: 0,
              unmappedChange: 0,
              avgSearchVolume: 0,
              avgDifficulty: 0,
              totalSearchVolume: 0,
              lastUpdated: new Date().toISOString(),
            }}
            loading={loading}
          />
        </section>

        {/* Charts */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Phân tích từ khóa</h2>
          <KeywordCharts 
            data={data?.charts || {
              searchVolumeDistribution: [],
              difficultyDistribution: [],
              intentDistribution: [],
              topOpportunities: [],
            }}
            loading={loading}
          />
        </section>

        {/* Top Opportunities */}
        <section>
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Cơ hội từ khóa hàng đầu</h2>
              <p className="text-sm text-gray-500 mt-1">
                Từ khóa có volume cao và độ khó thấp - ưu tiên tối ưu
              </p>
            </div>
            <TopOpportunitiesTable keywords={data?.charts.topOpportunities || []} />
          </div>
        </section>
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
