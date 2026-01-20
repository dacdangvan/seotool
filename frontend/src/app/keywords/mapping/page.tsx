'use client';

/**
 * Keyword Mapping Page
 * 
 * Display keyword-to-page mappings with:
 * - Overview statistics
 * - Mapping table with filters
 * - Cannibalization warnings
 * - Manual remap capability
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Module 1 – Keyword Intelligence Agent
 */

import React, { useState, useMemo } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import {
  KeywordMappingTable,
  type KeywordMappingRow,
} from '@/components/keywords/KeywordMappingTable';
import {
  MappingStatusLegend,
  CannibalizationWarning,
} from '@/components/keywords/MappingStatusBadge';
import {
  ArrowLeft,
  Link2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Link2Off,
  RefreshCw,
  Download,
  Settings,
  Info,
} from 'lucide-react';
import Link from 'next/link';

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_MAPPINGS: KeywordMappingRow[] = [
  {
    id: '1',
    keyword: 'thẻ tín dụng vib',
    searchVolume: 12500,
    difficulty: 45,
    intent: 'transactional',
    mappedUrls: ['https://www.vib.com.vn/vn/the-tin-dung'],
    competingKeywords: ['vib credit card', 'the tin dung vib online'],
    lastUpdated: '2025-01-18',
    autoMapped: true,
  },
  {
    id: '2',
    keyword: 'vib ivycard',
    searchVolume: 8200,
    difficulty: 32,
    intent: 'commercial',
    mappedUrls: ['https://www.vib.com.vn/vn/the-tin-dung/vib-ivycard'],
    competingKeywords: ['ivy card vib', 'thẻ ivy vib', 'ivycard'],
    lastUpdated: '2025-01-18',
    autoMapped: true,
  },
  {
    id: '3',
    keyword: 'mở thẻ tín dụng online',
    searchVolume: 15000,
    difficulty: 68,
    intent: 'transactional',
    mappedUrls: ['https://www.vib.com.vn/vn/the-tin-dung'],
    competingKeywords: ['mo the tin dung', 'đăng ký thẻ tín dụng', 'làm thẻ tín dụng online', 'thẻ tín dụng vib', 'vib credit card'],
    lastUpdated: '2025-01-17',
    autoMapped: true,
  },
  {
    id: '4',
    keyword: 'lãi suất thẻ tín dụng vib',
    searchVolume: 3200,
    difficulty: 25,
    intent: 'informational',
    mappedUrls: [],
    competingKeywords: [],
    lastUpdated: '2025-01-18',
  },
  {
    id: '5',
    keyword: 'so sánh thẻ tín dụng',
    searchVolume: 9800,
    difficulty: 55,
    intent: 'commercial',
    mappedUrls: [
      'https://www.vib.com.vn/vn/the-tin-dung',
      'https://www.vib.com.vn/vn/the-tin-dung/so-sanh',
    ],
    competingKeywords: [],
    lastUpdated: '2025-01-16',
    autoMapped: false,
    mappedBy: 'admin@vib.com.vn',
  },
  {
    id: '6',
    keyword: 'vib super card',
    searchVolume: 5600,
    difficulty: 28,
    intent: 'commercial',
    mappedUrls: ['https://www.vib.com.vn/vn/the-tin-dung/vib-supercard'],
    competingKeywords: [],
    lastUpdated: '2025-01-18',
    autoMapped: true,
  },
  {
    id: '7',
    keyword: 'ưu đãi thẻ tín dụng',
    searchVolume: 7400,
    difficulty: 42,
    intent: 'commercial',
    mappedUrls: [],
    competingKeywords: [],
    lastUpdated: '2025-01-17',
  },
  {
    id: '8',
    keyword: 'hoàn tiền thẻ tín dụng vib',
    searchVolume: 2100,
    difficulty: 22,
    intent: 'informational',
    mappedUrls: ['https://www.vib.com.vn/vn/the-tin-dung/cashback'],
    competingKeywords: ['cashback vib', 'vib hoàn tiền'],
    lastUpdated: '2025-01-18',
    autoMapped: true,
  },
  {
    id: '9',
    keyword: 'điều kiện mở thẻ tín dụng vib',
    searchVolume: 4500,
    difficulty: 35,
    intent: 'informational',
    mappedUrls: [],
    competingKeywords: [],
    lastUpdated: '2025-01-15',
  },
  {
    id: '10',
    keyword: 'vib online plus',
    searchVolume: 6800,
    difficulty: 30,
    intent: 'commercial',
    mappedUrls: ['https://www.vib.com.vn/vn/the-tin-dung/vib-online-plus'],
    competingKeywords: ['online plus vib', 'thẻ online plus'],
    lastUpdated: '2025-01-18',
    autoMapped: true,
  },
  {
    id: '11',
    keyword: 'phí thường niên thẻ tín dụng vib',
    searchVolume: 1800,
    difficulty: 18,
    intent: 'informational',
    mappedUrls: ['https://www.vib.com.vn/vn/the-tin-dung/bieu-phi'],
    competingKeywords: [],
    lastUpdated: '2025-01-17',
    autoMapped: true,
  },
  {
    id: '12',
    keyword: 'vib rewards unlimited',
    searchVolume: 4200,
    difficulty: 26,
    intent: 'commercial',
    mappedUrls: ['https://www.vib.com.vn/vn/the-tin-dung/vib-rewards-unlimited'],
    competingKeywords: ['rewards unlimited', 'thẻ rewards vib'],
    lastUpdated: '2025-01-18',
    autoMapped: true,
  },
];

// =============================================================================
// STATS CARDS
// =============================================================================

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description?: string;
}

function StatCard({ label, value, icon, color, bgColor, description }: StatCardProps) {
  return (
    <div className={cn('rounded-lg border p-4', bgColor)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className={cn('mt-1 text-2xl font-bold', color)}>
            {formatNumber(value)}
          </p>
          {description && (
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          )}
        </div>
        <div className={cn('p-2 rounded-lg', bgColor)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function KeywordMappingPage() {
  // State
  const [mappings, setMappings] = useState<KeywordMappingRow[]>(MOCK_MAPPINGS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock user role (in real app, get from auth context)
  const userRole = 'admin' as 'viewer' | 'editor' | 'admin';
  const canEdit = userRole === 'editor' || userRole === 'admin';

  // Calculate stats
  const stats = useMemo(() => {
    let mapped = 0;
    let unmapped = 0;
    let cannibalization = 0;
    let conflict = 0;

    mappings.forEach(m => {
      if (m.mappedUrls.length === 0) {
        unmapped++;
      } else if (m.mappedUrls.length > 1) {
        conflict++;
      } else if (m.competingKeywords.length > 0) {
        cannibalization++;
        mapped++;
      } else {
        mapped++;
      }
    });

    return { total: mappings.length, mapped, unmapped, cannibalization, conflict };
  }, [mappings]);

  // High-risk cannibalization cases
  const highRiskCases = useMemo(() => {
    return mappings
      .filter(m => m.competingKeywords.length >= 3 && m.mappedUrls.length === 1)
      .slice(0, 3);
  }, [mappings]);

  // Handlers
  const handleRemap = (keywordId: string, newUrl: string) => {
    setMappings(prev => prev.map(m => 
      m.id === keywordId 
        ? { ...m, mappedUrls: [newUrl], competingKeywords: [] }
        : m
    ));
    console.log(`Remapped keyword ${keywordId} to ${newUrl}`);
  };

  const handleRemoveMapping = (keywordId: string) => {
    setMappings(prev => prev.map(m =>
      m.id === keywordId
        ? { ...m, mappedUrls: [], competingKeywords: [] }
        : m
    ));
    console.log(`Removed mapping for keyword ${keywordId}`);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };

  const handleExport = () => {
    // In real app, export to CSV
    console.log('Exporting mappings...');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/keywords"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-500" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Keyword to Page Mapping
                </h1>
                <p className="text-sm text-gray-500">
                  View and manage keyword-to-URL relationships
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium',
                  'text-gray-700 bg-white border border-gray-300 rounded-lg',
                  'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                Refresh
              </button>
              <button
                onClick={handleExport}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium',
                  'text-gray-700 bg-white border border-gray-300 rounded-lg',
                  'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500'
                )}
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard
            label="Total Keywords"
            value={stats.total}
            icon={<Link2 className="h-5 w-5 text-blue-600" />}
            color="text-blue-700"
            bgColor="bg-blue-50 border-blue-200"
          />
          <StatCard
            label="Properly Mapped"
            value={stats.mapped}
            icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
            color="text-green-700"
            bgColor="bg-green-50 border-green-200"
            description={`${((stats.mapped / stats.total) * 100).toFixed(0)}% coverage`}
          />
          <StatCard
            label="Unmapped"
            value={stats.unmapped}
            icon={<Link2Off className="h-5 w-5 text-gray-500" />}
            color="text-gray-700"
            bgColor="bg-gray-50 border-gray-200"
            description="Need target pages"
          />
          <StatCard
            label="Cannibalization"
            value={stats.cannibalization}
            icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
            color="text-amber-700"
            bgColor="bg-amber-50 border-amber-200"
            description="Keywords competing"
          />
          <StatCard
            label="Conflicts"
            value={stats.conflict}
            icon={<AlertCircle className="h-5 w-5 text-red-600" />}
            color="text-red-700"
            bgColor="bg-red-50 border-red-200"
            description="Need resolution"
          />
        </div>

        {/* High Risk Warnings */}
        {highRiskCases.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                High-Risk Cannibalization Issues
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {highRiskCases.map(item => (
                <CannibalizationWarning
                  key={item.id}
                  risk="high"
                  competingKeywords={item.competingKeywords}
                  targetUrl={item.mappedUrls[0]}
                  showDetails
                />
              ))}
            </div>
          </div>
        )}

        {/* Info Banner */}
        <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">
              About Keyword Mapping
            </h3>
            <p className="mt-1 text-sm text-blue-700">
              Keyword mapping connects your target keywords to specific pages on your website. 
              Proper mapping prevents <strong>cannibalization</strong> (multiple keywords competing for the same page) 
              and <strong>conflicts</strong> (same keyword targeting multiple pages). 
              {canEdit && ' Click the edit icon to manually adjust mappings.'}
            </p>
          </div>
        </div>

        {/* Mapping Table */}
        <KeywordMappingTable
          mappings={mappings}
          canEdit={canEdit}
          onRemap={handleRemap}
          onRemoveMapping={handleRemoveMapping}
          onViewPage={(url) => window.open(url, '_blank')}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </main>
    </div>
  );
}
