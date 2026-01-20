'use client';

/**
 * Keyword Clusters Page
 * 
 * Displays keyword clusters as expandable cards for content planning:
 * - Cluster cards with topic, metrics, and keywords
 * - Search/filter clusters
 * - Select clusters for content planning
 * 
 * Tag: v2.10-keyword-clusters-mvp
 */

import React, { useState, useMemo } from 'react';
import { useKeywordClusters } from '@/hooks/useKeyword';
import { KeywordClusterCard } from '@/components/keywords';
import { formatCompact } from '@/lib/utils';
import type { ClusterSortField, SortDirection } from '@/types/keyword.types';
import { 
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Layers,
  TrendingUp,
  Target,
  CheckSquare,
  Lightbulb,
  ChevronDown,
  AlertCircle,
  Loader2,
  LayoutGrid,
  List as ListIcon,
} from 'lucide-react';

const PROJECT_ID = 'demo-project';

interface SortOption {
  field: ClusterSortField;
  direction: SortDirection;
  label: string;
}

const SORT_OPTIONS: SortOption[] = [
  { field: 'keywordCount', direction: 'desc', label: 'Most Keywords' },
  { field: 'keywordCount', direction: 'asc', label: 'Fewest Keywords' },
  { field: 'totalSearchVolume', direction: 'desc', label: 'Highest Volume' },
  { field: 'totalSearchVolume', direction: 'asc', label: 'Lowest Volume' },
  { field: 'avgDifficulty', direction: 'asc', label: 'Easiest First' },
  { field: 'avgDifficulty', direction: 'desc', label: 'Hardest First' },
  { field: 'name', direction: 'asc', label: 'Name A-Z' },
  { field: 'name', direction: 'desc', label: 'Name Z-A' },
];

function SummaryCard({ 
  icon: Icon, 
  label, 
  value, 
  iconColor,
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-lg font-semibold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

export default function KeywordClustersPage() {
  const { clusters, loading, error, refetch } = useKeywordClusters(PROJECT_ID);
  
  // Local state
  const [search, setSearch] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS[0]);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  
  // Filter and sort clusters
  const filteredClusters = useMemo(() => {
    let result = [...clusters];
    
    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(cluster => 
        cluster.name.toLowerCase().includes(searchLower) ||
        cluster.keywords.some(k => k.keyword.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortOption.field) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'keywordCount':
          comparison = a.keywords.length - b.keywords.length;
          break;
        case 'totalSearchVolume':
          comparison = a.totalSearchVolume - b.totalSearchVolume;
          break;
        case 'avgDifficulty':
          comparison = a.avgDifficulty - b.avgDifficulty;
          break;
      }
      return sortOption.direction === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [clusters, search, sortOption]);
  
  // Summary calculations
  const summary = useMemo(() => {
    const totalClusters = clusters.length;
    const totalKeywords = clusters.reduce((sum, c) => sum + c.keywords.length, 0);
    const totalVolume = clusters.reduce((sum, c) => sum + c.totalSearchVolume, 0);
    const avgDifficulty = clusters.length > 0 
      ? Math.round(clusters.reduce((sum, c) => sum + c.avgDifficulty, 0) / clusters.length)
      : 0;
    const highOpportunity = clusters.reduce(
      (sum, c) => sum + c.keywords.filter(k => k.opportunity === 'high').length, 
      0
    );
    
    return { totalClusters, totalKeywords, totalVolume, avgDifficulty, highOpportunity };
  }, [clusters]);
  
  // Toggle cluster expansion
  const toggleCluster = (clusterId: string) => {
    setExpandedClusters(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  };
  
  // Toggle cluster selection
  const toggleSelection = (clusterId: string) => {
    setSelectedClusters(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  };
  
  // Expand/collapse all
  const expandAll = () => {
    setExpandedClusters(new Set(clusters.map(c => c.id)));
  };
  
  const collapseAll = () => {
    setExpandedClusters(new Set());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-gray-600">Loading clusters...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg border border-red-200 p-6 max-w-md">
          <div className="flex items-center gap-3 text-red-600 mb-3">
            <AlertCircle className="w-6 h-6" />
            <span className="font-medium">Error loading clusters</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">{error?.message || 'Unknown error'}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Keyword Clusters</h1>
              <p className="text-sm text-gray-500 mt-1">
                Group related keywords for content planning and optimization
              </p>
            </div>
            
            {selectedClusters.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {selectedClusters.size} cluster{selectedClusters.size > 1 ? 's' : ''} selected
                </span>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Lightbulb className="w-4 h-4" />
                  Plan Content
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <SummaryCard
            icon={Layers}
            label="Total Clusters"
            value={summary.totalClusters}
            iconColor="bg-purple-100 text-purple-600"
          />
          <SummaryCard
            icon={TrendingUp}
            label="Total Keywords"
            value={summary.totalKeywords}
            iconColor="bg-blue-100 text-blue-600"
          />
          <SummaryCard
            icon={TrendingUp}
            label="Total Volume"
            value={formatCompact(summary.totalVolume)}
            iconColor="bg-green-100 text-green-600"
          />
          <SummaryCard
            icon={Target}
            label="Avg Difficulty"
            value={summary.avgDifficulty}
            iconColor="bg-orange-100 text-orange-600"
          />
          <SummaryCard
            icon={Lightbulb}
            label="High Opportunity"
            value={summary.highOpportunity}
            iconColor="bg-yellow-100 text-yellow-600"
          />
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[250px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search clusters or keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ArrowUpDown className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700">{sortOption.label}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                
                {showSortDropdown && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[180px]">
                    {SORT_OPTIONS.map((option, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSortOption(option);
                          setShowSortDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                          sortOption.label === option.label ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                        } ${i === 0 ? 'rounded-t-lg' : ''} ${i === SORT_OPTIONS.length - 1 ? 'rounded-b-lg' : ''}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Expand/Collapse */}
              <div className="flex items-center gap-1 border border-gray-300 rounded-lg">
                <button
                  onClick={expandAll}
                  className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-l-lg transition-colors"
                  title="Expand all"
                >
                  Expand All
                </button>
                <div className="w-px h-6 bg-gray-300" />
                <button
                  onClick={collapseAll}
                  className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-r-lg transition-colors"
                  title="Collapse all"
                >
                  Collapse
                </button>
              </div>
              
              {/* View toggle */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="List view"
                >
                  <ListIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Clusters List */}
        {filteredClusters.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No clusters found</h3>
            <p className="text-gray-500">
              {search ? 'Try adjusting your search terms' : 'No keyword clusters available'}
            </p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
            {filteredClusters.map(cluster => (
              <KeywordClusterCard
                key={cluster.id}
                cluster={cluster}
                isExpanded={expandedClusters.has(cluster.id)}
                isSelected={selectedClusters.has(cluster.id)}
                onToggle={() => toggleCluster(cluster.id)}
                onSelect={() => toggleSelection(cluster.id)}
              />
            ))}
          </div>
        )}
        
        {/* Results count */}
        {filteredClusters.length > 0 && (
          <div className="mt-4 text-sm text-gray-500 text-center">
            Showing {filteredClusters.length} of {clusters.length} clusters
          </div>
        )}
      </div>
    </div>
  );
}
