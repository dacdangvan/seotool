'use client';

/**
 * Keywords Research Page - GSC Integration
 * 
 * Phân tích từ khóa từ Google Search Console để lập kế hoạch SEO
 * 
 * Features:
 * - Top queries với clicks, impressions, CTR, position
 * - Phân loại cơ hội: Quick wins, Long-tail, Brand, Non-brand
 * - Phân tích intent từ khóa
 * - Export dữ liệu
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { Sidebar } from '@/components/Sidebar';
import { useProject } from '@/context/ProjectContext';
import { formatNumber, formatCompact } from '@/lib/utils';
import { 
  Search, 
  RefreshCw, 
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Target,
  Zap,
  Star,
  Download,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  MousePointer2,
  Eye,
  Award,
  Lightbulb,
  ShoppingCart,
  Info,
  Navigation,
  X,
  FileText,
  Link2,
  Globe,
  CheckCircle2,
  BookOpen,
  TrendingUp,
  Layout,
  Image,
  ListChecks,
  ExternalLink,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types
interface GSCKeyword {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  // Computed fields
  opportunity?: 'quick-win' | 'low-hanging' | 'potential' | 'monitor';
  intent?: 'informational' | 'commercial' | 'transactional' | 'navigational';
  isBrand?: boolean;
}

interface KeywordKPIs {
  totalKeywords: number;
  totalClicks: number;
  totalImpressions: number;
  avgCTR: number;
  avgPosition: number;
  quickWins: number;
  lowHanging: number;
  brandKeywords: number;
  nonBrandKeywords: number;
}

type OpportunityFilter = 'all' | 'quick-win' | 'low-hanging' | 'potential' | 'monitor';
type IntentFilter = 'all' | 'informational' | 'commercial' | 'transactional' | 'navigational';
type SortField = 'clicks' | 'impressions' | 'ctr' | 'position';
type SortOrder = 'asc' | 'desc';

// Intent classification based on keyword patterns
function classifyIntent(query: string): GSCKeyword['intent'] {
  const q = query.toLowerCase();
  
  // Transactional
  if (/mua|đăng ký|mở|vay|gửi tiền|chuyển tiền|rút tiền|apply|register|buy|order/.test(q)) {
    return 'transactional';
  }
  
  // Commercial
  if (/so sánh|review|đánh giá|tốt nhất|nên chọn|lãi suất|phí|ưu đãi|khuyến mãi|compare|best/.test(q)) {
    return 'commercial';
  }
  
  // Navigational  
  if (/vib|ngân hàng|chi nhánh|atm|hotline|tổng đài|website|app/.test(q)) {
    return 'navigational';
  }
  
  // Default: Informational
  return 'informational';
}

// Opportunity classification based on position and CTR
function classifyOpportunity(position: number, ctr: number, impressions: number): GSCKeyword['opportunity'] {
  // Quick wins: Position 4-10, high impressions (on page 1 but not top 3)
  if (position >= 4 && position <= 10 && impressions >= 100) {
    return 'quick-win';
  }
  
  // Low-hanging fruit: Position 11-20 (page 2), decent impressions
  if (position >= 11 && position <= 20 && impressions >= 50) {
    return 'low-hanging';
  }
  
  // Potential: Position 21-50 with high impressions
  if (position >= 21 && position <= 50 && impressions >= 100) {
    return 'potential';
  }
  
  // Monitor: Top 3 or others
  return 'monitor';
}

// Check if keyword is brand-related
function isBrandKeyword(query: string): boolean {
  const brandTerms = ['vib', 'ngân hàng vib', 'vib bank', 'vib online', 'myvib'];
  const q = query.toLowerCase();
  return brandTerms.some(term => q.includes(term));
}

// Intent config
const INTENT_CONFIG = {
  informational: { label: 'Tìm hiểu', color: 'bg-blue-100 text-blue-700', icon: Info },
  commercial: { label: 'So sánh', color: 'bg-violet-100 text-violet-700', icon: BarChart3 },
  transactional: { label: 'Giao dịch', color: 'bg-green-100 text-green-700', icon: ShoppingCart },
  navigational: { label: 'Điều hướng', color: 'bg-gray-100 text-gray-700', icon: Navigation },
};

const OPPORTUNITY_CONFIG = {
  'quick-win': { label: 'Quick Win', color: 'bg-green-100 text-green-700', icon: Zap },
  'low-hanging': { label: 'Low Hanging', color: 'bg-yellow-100 text-yellow-700', icon: Star },
  'potential': { label: 'Tiềm năng', color: 'bg-blue-100 text-blue-700', icon: Lightbulb },
  'monitor': { label: 'Theo dõi', color: 'bg-gray-100 text-gray-700', icon: Eye },
};

// SEO Recommendations Generator
interface SEORecommendation {
  category: string;
  icon: React.ElementType;
  color: string;
  title: string;
  description: string;
  actions: string[];
  priority: 'high' | 'medium' | 'low';
}

function generateSEORecommendations(keyword: GSCKeyword): SEORecommendation[] {
  const recommendations: SEORecommendation[] = [];
  const position = keyword.position;
  const ctr = keyword.ctr * 100;
  const impressions = keyword.impressions;
  const isTopPosition = position <= 3;
  const isPage1 = position <= 10;
  const isPage2 = position > 10 && position <= 20;
  
  // Content Recommendations
  if (position > 3) {
    recommendations.push({
      category: 'content',
      icon: FileText,
      color: 'bg-blue-100 text-blue-600',
      title: 'Tối ưu nội dung',
      description: isPage1 
        ? 'Nội dung cần được làm sâu hơn để lên top 3'
        : 'Cần tạo/cải thiện nội dung toàn diện cho keyword này',
      actions: [
        `Tạo bài viết dài 2000-3000 từ về "${keyword.query}"`,
        'Thêm các heading H2, H3 với từ khóa liên quan',
        'Bổ sung hình ảnh, video, infographic minh họa',
        'Viết FAQ section trả lời các câu hỏi phổ biến',
        'Cập nhật nội dung mới nhất, thêm số liệu thống kê',
        keyword.intent === 'commercial' 
          ? 'Thêm bảng so sánh với đối thủ cạnh tranh' 
          : 'Cung cấp thông tin chi tiết và hữu ích nhất',
      ],
      priority: isPage1 ? 'high' : 'medium',
    });
  }

  // On-page SEO
  recommendations.push({
    category: 'onpage',
    icon: Layout,
    color: 'bg-purple-100 text-purple-600',
    title: 'On-page SEO',
    description: 'Tối ưu các yếu tố SEO trên trang',
    actions: [
      `Đặt "${keyword.query}" vào Title tag (60 ký tự)`,
      `Viết Meta Description hấp dẫn chứa "${keyword.query}" (160 ký tự)`,
      'Sử dụng keyword trong URL (ngắn gọn, có dấu gạch ngang)',
      'Đặt keyword trong H1 và các heading phụ',
      'Thêm Alt text cho hình ảnh chứa keyword',
      'Sử dụng Schema Markup phù hợp (Article, FAQ, Product...)',
      'Tối ưu Internal Linking từ các trang liên quan',
    ],
    priority: position > 10 ? 'high' : 'medium',
  });

  // Link Building
  if (position > 5) {
    recommendations.push({
      category: 'linkbuilding',
      icon: Link2,
      color: 'bg-green-100 text-green-600',
      title: 'Xây dựng Backlinks',
      description: isPage2 
        ? 'Backlinks chất lượng sẽ giúp từ trang 2 lên trang 1'
        : 'Tăng authority của trang với backlinks',
      actions: [
        'Guest posting trên các blog tài chính uy tín',
        'Liên hệ báo chí để có backlinks từ trang tin tức',
        'Tạo nội dung viral để nhận natural backlinks',
        'Xây dựng quan hệ với KOLs/Influencers trong ngành',
        'Đăng ký trên các directory uy tín (trang vàng, liên kết ngành)',
        'Broken link building: tìm và thay thế link hỏng',
      ],
      priority: isPage2 ? 'high' : 'medium',
    });
  }

  // Technical SEO
  recommendations.push({
    category: 'technical',
    icon: Globe,
    color: 'bg-orange-100 text-orange-600',
    title: 'Technical SEO',
    description: 'Đảm bảo trang được tối ưu kỹ thuật',
    actions: [
      'Kiểm tra Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1)',
      'Đảm bảo trang Mobile-friendly',
      'Tối ưu tốc độ tải trang (nén hình, lazy load, cache)',
      'Kiểm tra Index status trong Google Search Console',
      'Đảm bảo không có lỗi crawl (robots.txt, sitemap)',
      'HTTPS và certificate hợp lệ',
    ],
    priority: 'medium',
  });

  // CTR Optimization
  if (isPage1 && ctr < 5) {
    recommendations.push({
      category: 'ctr',
      icon: TrendingUp,
      color: 'bg-pink-100 text-pink-600',
      title: 'Tối ưu CTR',
      description: `CTR hiện tại ${ctr.toFixed(2)}% - cần cải thiện để tăng traffic`,
      actions: [
        'Viết Title hấp dẫn hơn (dùng số, power words)',
        'Cải thiện Meta Description với CTA rõ ràng',
        'Thêm Featured Snippet-friendly content (lists, tables)',
        'Sử dụng Schema để hiển thị Rich Snippets (star rating, FAQ)',
        'A/B test các phiên bản Title/Description khác nhau',
        'Thêm năm hiện tại vào title nếu phù hợp (vd: "2026")',
      ],
      priority: 'high',
    });
  }

  // Page/Landing Page Creation
  if (position > 20 && impressions >= 100) {
    recommendations.push({
      category: 'newpage',
      icon: Sparkles,
      color: 'bg-cyan-100 text-cyan-600',
      title: 'Tạo Landing Page mới',
      description: 'Keyword có tiềm năng cao - nên tạo trang riêng',
      actions: [
        `Tạo landing page chuyên biệt cho "${keyword.query}"`,
        'Thiết kế UX tối ưu cho conversion',
        'Đặt CTA rõ ràng (Đăng ký, Liên hệ, Tìm hiểu thêm)',
        'Tạo nội dung pillar + supporting pages (topic cluster)',
        'Xây dựng internal links từ các trang có traffic cao',
        'Chạy A/B test để tối ưu conversion rate',
      ],
      priority: 'medium',
    });
  }

  // Brand Keyword specific
  if (keyword.isBrand) {
    recommendations.push({
      category: 'brand',
      icon: Award,
      color: 'bg-indigo-100 text-indigo-600',
      title: 'Bảo vệ Brand Keywords',
      description: 'Đảm bảo thương hiệu luôn ở top',
      actions: [
        'Theo dõi SERP để phát hiện đối thủ chiếm rank',
        'Tối ưu tất cả các trang chính của website',
        'Claim và tối ưu Google Business Profile',
        'Quản lý danh tiếng online (reviews, mentions)',
        'Tạo content mới thường xuyên về thương hiệu',
        'Social media presence mạnh mẽ',
      ],
      priority: isTopPosition ? 'low' : 'high',
    });
  }

  // Intent-specific recommendations
  if (keyword.intent === 'transactional') {
    recommendations.push({
      category: 'conversion',
      icon: ShoppingCart,
      color: 'bg-emerald-100 text-emerald-600',
      title: 'Tối ưu Conversion',
      description: 'Keyword có ý định giao dịch cao',
      actions: [
        'Tạo landing page với form đăng ký rõ ràng',
        'Thêm Trust signals (chứng nhận, testimonials)',
        'Hiển thị USP (Unique Selling Points) nổi bật',
        'Tối ưu tốc độ và UX cho mobile',
        'Thêm Live Chat hoặc Chatbot hỗ trợ',
        'Remarketing cho users chưa convert',
      ],
      priority: 'high',
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// API Analysis Response Types
interface SEOAnalysisResponse {
  keyword: string;
  gsc: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    rankingPages: string[];
  } | null;
  relatedKeywords: Array<{
    query: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;
  crawledPages: Array<{
    url: string;
    title: string;
    metaDescription: string;
    headings: Array<{ level: number; text: string }>;
    hasKeywordInTitle: boolean;
    hasKeywordInMeta: boolean;
    hasKeywordInH1: boolean;
    wordCount: number;
    internalLinksCount: number;
    externalLinksCount: number;
    httpStatus: number;
    responseTime: number;
  }>;
  cwv: Array<{
    url: string;
    device: string;
    lcp: { value: number | null; status: string };
    inp: { value: number | null; status: string };
    cls: { value: number | null; status: string };
    performanceScore: number | null;
    overallStatus: string;
  }>;
  competitors: Array<{
    page: string;
    avgPosition: number;
    totalClicks: number;
    totalImpressions: number;
  }>;
  analysis: {
    score: number;
    issues: Array<{
      type: string;
      severity: 'critical' | 'warning' | 'info';
      message: string;
      action: string;
    }>;
    recommendations: Array<{
      category: string;
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      actions: string[];
      estimatedImpact: string;
    }>;
    contentBriefSuggestion: {
      suggestedTitle: string;
      suggestedMetaDescription: string;
      suggestedH1: string;
      suggestedOutline: string[];
      targetWordCount: number;
      relatedKeywordsToInclude: string[];
    };
  };
}

// Keyword Detail Panel Component
function KeywordDetailPanel({ 
  keyword, 
  projectId,
  onClose,
  onCreateContent,
}: { 
  keyword: GSCKeyword; 
  projectId: string;
  onClose: () => void;
  onCreateContent?: (keyword: string, brief: SEOAnalysisResponse['analysis']['contentBriefSuggestion']) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [analysisData, setAnalysisData] = useState<SEOAnalysisResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'crawl' | 'cwv' | 'brief'>('recommendations');
  
  const OpportunityIcon = OPPORTUNITY_CONFIG[keyword.opportunity!]?.icon || Eye;
  const IntentIcon = INTENT_CONFIG[keyword.intent!]?.icon || Info;
  
  // Fetch analysis data from API
  useEffect(() => {
    const fetchAnalysis = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${API_BASE}/projects/${projectId}/keywords/${encodeURIComponent(keyword.query)}/analysis`
        );
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setAnalysisData(result.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch analysis:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalysis();
  }, [projectId, keyword.query]);

  // Fallback to rule-based recommendations if API fails
  const recommendations = analysisData?.analysis.recommendations || generateSEORecommendations(keyword).map(r => ({
    category: r.category,
    priority: r.priority,
    title: r.title,
    description: r.description,
    actions: r.actions,
    estimatedImpact: '',
  }));
  
  const priorityColors = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-yellow-200 bg-yellow-50',
    low: 'border-gray-200 bg-gray-50',
  };
  
  const priorityLabels = {
    high: { label: 'Ưu tiên cao', color: 'bg-red-100 text-red-700' },
    medium: { label: 'Ưu tiên TB', color: 'bg-yellow-100 text-yellow-700' },
    low: { label: 'Ưu tiên thấp', color: 'bg-gray-100 text-gray-600' },
  };
  
  const severityColors = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-white shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-bold">Phân tích SEO chi tiết</h2>
                {analysisData && (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    analysisData.analysis.score >= 70 ? 'bg-green-500' :
                    analysisData.analysis.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}>
                    Score: {analysisData.analysis.score}/100
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-blue-100">
                <Search className="w-4 h-4" />
                <span className="text-lg font-medium text-white">{keyword.query}</span>
                {keyword.isBrand && (
                  <span className="px-2 py-0.5 bg-white/20 rounded text-xs">Brand</span>
                )}
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Keyword Stats */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{formatNumber(keyword.clicks)}</div>
              <div className="text-xs text-blue-100">Clicks</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{formatNumber(keyword.impressions)}</div>
              <div className="text-xs text-blue-100">Impressions</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{(keyword.ctr * 100).toFixed(1)}%</div>
              <div className="text-xs text-blue-100">CTR</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">#{keyword.position.toFixed(0)}</div>
              <div className="text-xs text-blue-100">Position</div>
            </div>
          </div>
          
          {/* Tags */}
          <div className="flex items-center gap-2 mt-4">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-white/20`}>
              <OpportunityIcon className="w-4 h-4" />
              {OPPORTUNITY_CONFIG[keyword.opportunity!]?.label}
            </span>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-white/20`}>
              <IntentIcon className="w-4 h-4" />
              {INTENT_CONFIG[keyword.intent!]?.label}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex">
            {[
              { id: 'recommendations', label: 'Hướng dẫn SEO', icon: Lightbulb },
              { id: 'crawl', label: 'Dữ liệu Crawl', icon: Globe },
              { id: 'cwv', label: 'Core Web Vitals', icon: TrendingUp },
              { id: 'brief', label: 'Content Brief', icon: FileText },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-4" />
              <p className="text-gray-500">Đang phân tích dữ liệu SEO...</p>
            </div>
          ) : (
            <>
              {/* Issues Summary */}
              {analysisData && analysisData.analysis.issues.length > 0 && activeTab === 'recommendations' && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                    Vấn đề phát hiện ({analysisData.analysis.issues.length})
                  </h3>
                  <div className="space-y-2">
                    {analysisData.analysis.issues.map((issue, idx) => (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg border ${severityColors[issue.severity]} flex items-start gap-3`}
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{issue.message}</p>
                          <p className="text-xs mt-1 opacity-80">→ {issue.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations Tab */}
              {activeTab === 'recommendations' && (
                <>
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                      Chiến lược nâng hạng ({recommendations.length} hành động)
                    </h3>
                  </div>
                  
                  <div className="space-y-4">
                    {recommendations.map((rec, idx) => (
                      <div 
                        key={idx} 
                        className={`rounded-xl border-2 ${priorityColors[rec.priority]} overflow-hidden`}
                      >
                        <div className="p-4 border-b border-gray-100 bg-white">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                              <p className="text-sm text-gray-500 mt-1">{rec.description}</p>
                              {rec.estimatedImpact && (
                                <p className="text-xs text-green-600 mt-2 font-medium">
                                  📈 {rec.estimatedImpact}
                                </p>
                              )}
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${priorityLabels[rec.priority].color}`}>
                              {priorityLabels[rec.priority].label}
                            </span>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-white/50">
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-3 flex items-center gap-2">
                            <ListChecks className="w-4 h-4" />
                            Các bước thực hiện
                          </h5>
                          <ul className="space-y-2">
                            {rec.actions.map((action, actionIdx) => (
                              <li key={actionIdx} className="flex items-start gap-2 text-sm text-gray-700">
                                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Related Keywords */}
                  {analysisData && analysisData.relatedKeywords.length > 0 && (
                    <div className="mt-6 bg-blue-50 rounded-xl border border-blue-200 p-4">
                      <h4 className="font-semibold text-blue-800 flex items-center gap-2 mb-3">
                        <Search className="w-5 h-5" />
                        Từ khóa liên quan (nên target cùng)
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisData.relatedKeywords.map((k, idx) => (
                          <span 
                            key={idx} 
                            className="px-3 py-1 bg-white rounded-full text-sm text-blue-700 border border-blue-200"
                          >
                            {k.query} <span className="text-blue-400">({formatNumber(k.impressions)} imp)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Crawl Data Tab */}
              {activeTab === 'crawl' && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
                    Trang đã crawl liên quan đến keyword
                  </h3>
                  
                  {analysisData && analysisData.crawledPages.length > 0 ? (
                    <div className="space-y-4">
                      {analysisData.crawledPages.map((page, idx) => (
                        <div key={idx} className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex items-start justify-between mb-3">
                            <a 
                              href={page.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm font-medium truncate flex-1"
                            >
                              {page.url}
                            </a>
                            <span className={`px-2 py-1 rounded text-xs ${
                              page.httpStatus === 200 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {page.httpStatus}
                            </span>
                          </div>
                          
                          <h4 className="font-medium text-gray-900 mb-2">{page.title || '(Không có title)'}</h4>
                          <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                            {page.metaDescription || '(Không có meta description)'}
                          </p>
                          
                          {/* On-page SEO Checks */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              page.hasKeywordInTitle ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {page.hasKeywordInTitle ? '✓' : '✗'} Keyword in Title
                            </span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              page.hasKeywordInMeta ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {page.hasKeywordInMeta ? '✓' : '✗'} Keyword in Meta
                            </span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              page.hasKeywordInH1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {page.hasKeywordInH1 ? '✓' : '✗'} Keyword in H1
                            </span>
                          </div>
                          
                          {/* Stats */}
                          <div className="grid grid-cols-4 gap-2 text-center text-xs">
                            <div className="bg-gray-50 rounded p-2">
                              <div className="font-medium text-gray-900">{formatNumber(page.wordCount)}</div>
                              <div className="text-gray-500">Words</div>
                            </div>
                            <div className="bg-gray-50 rounded p-2">
                              <div className="font-medium text-gray-900">{page.internalLinksCount}</div>
                              <div className="text-gray-500">Int. Links</div>
                            </div>
                            <div className="bg-gray-50 rounded p-2">
                              <div className="font-medium text-gray-900">{page.externalLinksCount}</div>
                              <div className="text-gray-500">Ext. Links</div>
                            </div>
                            <div className="bg-gray-50 rounded p-2">
                              <div className="font-medium text-gray-900">{page.responseTime}ms</div>
                              <div className="text-gray-500">Response</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl">
                      <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Không tìm thấy trang nào target keyword này</p>
                      <p className="text-sm text-gray-400 mt-2">Hãy tạo landing page mới cho keyword này</p>
                    </div>
                  )}
                </div>
              )}

              {/* CWV Tab */}
              {activeTab === 'cwv' && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
                    Core Web Vitals của trang ranking
                  </h3>
                  
                  {analysisData && analysisData.cwv.length > 0 ? (
                    <div className="space-y-4">
                      {analysisData.cwv.map((cwv, idx) => (
                        <div key={idx} className="bg-white rounded-lg border border-gray-200 p-4">
                          <div className="flex items-center justify-between mb-4">
                            <a 
                              href={cwv.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm font-medium truncate flex-1"
                            >
                              {cwv.url}
                            </a>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              cwv.overallStatus === 'good' ? 'bg-green-100 text-green-700' :
                              cwv.overallStatus === 'needs-improvement' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {cwv.device} • Score: {cwv.performanceScore}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                            {/* LCP */}
                            <div className={`p-3 rounded-lg ${
                              cwv.lcp?.status === 'good' ? 'bg-green-50' :
                              cwv.lcp?.status === 'needs-improvement' ? 'bg-yellow-50' : 'bg-red-50'
                            }`}>
                              <div className="text-xs text-gray-500 mb-1">LCP</div>
                              <div className="font-bold text-lg">
                                {cwv.lcp?.value != null ? ((cwv.lcp.value / 1000).toFixed(2) + 's') : 'N/A'}
                              </div>
                              <div className={`text-xs ${
                                cwv.lcp?.status === 'good' ? 'text-green-600' :
                                cwv.lcp?.status === 'needs-improvement' ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {cwv.lcp?.status === 'good' ? '✓ Tốt' : cwv.lcp?.status === 'needs-improvement' ? '⚠ Cần cải thiện' : '✗ Kém'}
                              </div>
                            </div>
                            
                            {/* INP */}
                            <div className={`p-3 rounded-lg ${
                              cwv.inp?.status === 'good' ? 'bg-green-50' :
                              cwv.inp?.status === 'needs-improvement' ? 'bg-yellow-50' : 'bg-red-50'
                            }`}>
                              <div className="text-xs text-gray-500 mb-1">INP</div>
                              <div className="font-bold text-lg">
                                {cwv.inp?.value != null ? (cwv.inp.value + 'ms') : 'N/A'}
                              </div>
                              <div className={`text-xs ${
                                cwv.inp?.status === 'good' ? 'text-green-600' :
                                cwv.inp?.status === 'needs-improvement' ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {cwv.inp?.status === 'good' ? '✓ Tốt' : cwv.inp?.status === 'needs-improvement' ? '⚠ Cần cải thiện' : '✗ Kém'}
                              </div>
                            </div>
                            
                            {/* CLS */}
                            <div className={`p-3 rounded-lg ${
                              cwv.cls?.status === 'good' ? 'bg-green-50' :
                              cwv.cls?.status === 'needs-improvement' ? 'bg-yellow-50' : 'bg-red-50'
                            }`}>
                              <div className="text-xs text-gray-500 mb-1">CLS</div>
                              <div className="font-bold text-lg">
                                {cwv.cls?.value != null ? cwv.cls.value.toFixed(3) : 'N/A'}
                              </div>
                              <div className={`text-xs ${
                                cwv.cls?.status === 'good' ? 'text-green-600' :
                                cwv.cls?.status === 'needs-improvement' ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {cwv.cls?.status === 'good' ? '✓ Tốt' : cwv.cls?.status === 'needs-improvement' ? '⚠ Cần cải thiện' : '✗ Kém'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl">
                      <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Chưa có dữ liệu Core Web Vitals</p>
                      <p className="text-sm text-gray-400 mt-2">Chạy CWV Worker để đo lường</p>
                    </div>
                  )}
                </div>
              )}

              {/* Content Brief Tab */}
              {activeTab === 'brief' && analysisData && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
                    Gợi ý Content Brief cho &quot;{keyword.query}&quot;
                  </h3>
                  
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Title Suggestion */}
                    <div className="p-4 border-b border-gray-100">
                      <label className="text-xs font-medium text-gray-500 uppercase">Title gợi ý</label>
                      <p className="mt-1 font-medium text-gray-900">
                        {analysisData.analysis.contentBriefSuggestion.suggestedTitle}
                      </p>
                    </div>
                    
                    {/* Meta Description */}
                    <div className="p-4 border-b border-gray-100">
                      <label className="text-xs font-medium text-gray-500 uppercase">Meta Description gợi ý</label>
                      <p className="mt-1 text-gray-700 text-sm">
                        {analysisData.analysis.contentBriefSuggestion.suggestedMetaDescription}
                      </p>
                    </div>
                    
                    {/* H1 */}
                    <div className="p-4 border-b border-gray-100">
                      <label className="text-xs font-medium text-gray-500 uppercase">H1 gợi ý</label>
                      <p className="mt-1 font-medium text-gray-900">
                        {analysisData.analysis.contentBriefSuggestion.suggestedH1}
                      </p>
                    </div>
                    
                    {/* Outline */}
                    <div className="p-4 border-b border-gray-100">
                      <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Outline gợi ý</label>
                      <ol className="space-y-2">
                        {analysisData.analysis.contentBriefSuggestion.suggestedOutline.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium shrink-0">
                              H2
                            </span>
                            {item}
                          </li>
                        ))}
                      </ol>
                    </div>
                    
                    {/* Word Count & Keywords */}
                    <div className="p-4 border-b border-gray-100 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Độ dài khuyến nghị</label>
                        <p className="mt-1 font-bold text-2xl text-blue-600">
                          {formatNumber(analysisData.analysis.contentBriefSuggestion.targetWordCount)} từ
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Từ khóa cần include</label>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {analysisData.analysis.contentBriefSuggestion.relatedKeywordsToInclude.map((kw, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* CTA to Content Generator */}
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                      <a
                        href={`/content/generate?keyword=${encodeURIComponent(keyword.query)}&brief=${encodeURIComponent(JSON.stringify(analysisData.analysis.contentBriefSuggestion))}&relatedKeywords=${encodeURIComponent(JSON.stringify(analysisData.relatedKeywords.slice(0, 10).map(k => k.query)))}`}
                        className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        <Sparkles className="w-5 h-5" />
                        Tạo Content với AI Content Writer
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex items-center justify-between">
          <a 
            href={`https://www.google.com/search?q=${encodeURIComponent(keyword.query)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <ExternalLink className="w-4 h-4" />
            Xem kết quả Google
          </a>
          <div className="flex items-center gap-2">
            {analysisData && (
              <a
                href={`/content/generate?keyword=${encodeURIComponent(keyword.query)}&brief=${encodeURIComponent(JSON.stringify(analysisData.analysis.contentBriefSuggestion))}&relatedKeywords=${encodeURIComponent(JSON.stringify(analysisData.relatedKeywords.slice(0, 10).map(k => k.query)))}`}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Tạo Content
              </a>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// KPI Card Component
function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  color,
  subtitle,
  trend,
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType; 
  color: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {subtitle && (
        <div className="flex items-center gap-1 mt-1">
          {trend === 'up' && <ArrowUp className="w-3 h-3 text-green-500" />}
          {trend === 'down' && <ArrowDown className="w-3 h-3 text-red-500" />}
          <span className="text-sm text-gray-500">{subtitle}</span>
        </div>
      )}
    </div>
  );
}

// Position Badge
function PositionBadge({ position }: { position: number }) {
  let color = 'bg-gray-100 text-gray-700';
  if (position <= 3) color = 'bg-green-100 text-green-700';
  else if (position <= 10) color = 'bg-blue-100 text-blue-700';
  else if (position <= 20) color = 'bg-yellow-100 text-yellow-700';
  else color = 'bg-red-100 text-red-700';
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      #{position.toFixed(0)}
    </span>
  );
}

// CTR Badge
function CTRBadge({ ctr }: { ctr: number }) {
  const percentage = ctr * 100;
  let color = 'bg-gray-100 text-gray-700';
  if (percentage >= 5) color = 'bg-green-100 text-green-700';
  else if (percentage >= 2) color = 'bg-yellow-100 text-yellow-700';
  else if (percentage < 1) color = 'bg-red-100 text-red-700';
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {percentage.toFixed(2)}%
    </span>
  );
}

// Main Content Component
function KeywordsContent() {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data
  const [keywords, setKeywords] = useState<GSCKeyword[]>([]);
  const [kpis, setKPIs] = useState<KeywordKPIs | null>(null);
  
  // Selected keyword for detail panel
  const [selectedKeyword, setSelectedKeyword] = useState<GSCKeyword | null>(null);
  
  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 25;
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [opportunityFilter, setOpportunityFilter] = useState<OpportunityFilter>('all');
  const [intentFilter, setIntentFilter] = useState<IntentFilter>('all');
  const [sortField, setSortField] = useState<SortField>('clicks');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showBrandOnly, setShowBrandOnly] = useState(false);
  const [showNonBrandOnly, setShowNonBrandOnly] = useState(false);

  // Fetch keywords from GSC
  const fetchKeywords = useCallback(async () => {
    if (!currentProject?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        dimension: 'query',
        limit: '500', // Fetch more to compute KPIs
        offset: '0',
        sortBy: sortField,
        sortOrder,
      });
      
      const response = await fetch(
        `${API_BASE}/projects/${currentProject.id}/gsc/analytics?${params}`
      );
      
      if (!response.ok) throw new Error('Failed to fetch GSC data');
      
      const data = await response.json();
      
      if (data.success) {
        // Process keywords with opportunity and intent classification
        const processedKeywords: GSCKeyword[] = data.data.items.map((item: any) => ({
          query: item.query,
          clicks: item.clicks,
          impressions: item.impressions,
          ctr: item.ctr,
          position: item.position,
          opportunity: classifyOpportunity(item.position, item.ctr, item.impressions),
          intent: classifyIntent(item.query),
          isBrand: isBrandKeyword(item.query),
        }));
        
        setKeywords(processedKeywords);
        
        // Calculate KPIs
        const totalClicks = processedKeywords.reduce((sum, k) => sum + k.clicks, 0);
        const totalImpressions = processedKeywords.reduce((sum, k) => sum + k.impressions, 0);
        const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
        const avgPosition = processedKeywords.length > 0 
          ? processedKeywords.reduce((sum, k) => sum + k.position, 0) / processedKeywords.length 
          : 0;
        
        setKPIs({
          totalKeywords: data.data.pagination.total,
          totalClicks,
          totalImpressions,
          avgCTR,
          avgPosition,
          quickWins: processedKeywords.filter(k => k.opportunity === 'quick-win').length,
          lowHanging: processedKeywords.filter(k => k.opportunity === 'low-hanging').length,
          brandKeywords: processedKeywords.filter(k => k.isBrand).length,
          nonBrandKeywords: processedKeywords.filter(k => !k.isBrand).length,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id, sortField, sortOrder]);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  // Filter and paginate keywords
  const filteredKeywords = useMemo(() => {
    let result = [...keywords];
    
    // Search filter
    if (searchQuery) {
      result = result.filter(k => 
        k.query.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Opportunity filter
    if (opportunityFilter !== 'all') {
      result = result.filter(k => k.opportunity === opportunityFilter);
    }
    
    // Intent filter
    if (intentFilter !== 'all') {
      result = result.filter(k => k.intent === intentFilter);
    }
    
    // Brand filter
    if (showBrandOnly) {
      result = result.filter(k => k.isBrand);
    }
    if (showNonBrandOnly) {
      result = result.filter(k => !k.isBrand);
    }
    
    return result;
  }, [keywords, searchQuery, opportunityFilter, intentFilter, showBrandOnly, showNonBrandOnly]);

  const paginatedKeywords = useMemo(() => {
    const start = page * pageSize;
    return filteredKeywords.slice(start, start + pageSize);
  }, [filteredKeywords, page, pageSize]);

  // Export to CSV
  const exportCSV = () => {
    const headers = ['Query', 'Clicks', 'Impressions', 'CTR', 'Position', 'Opportunity', 'Intent', 'Brand'];
    const rows = filteredKeywords.map(k => [
      k.query,
      k.clicks,
      k.impressions,
      (k.ctr * 100).toFixed(2) + '%',
      k.position.toFixed(1),
      k.opportunity,
      k.intent,
      k.isBrand ? 'Yes' : 'No',
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keywords-${currentProject?.name || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (!currentProject) {
    return (
      <main className="ml-64 p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Vui lòng chọn dự án</p>
        </div>
      </main>
    );
  }

  return (
    <main className="ml-64 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Search className="w-7 h-7 text-blue-600" />
            Keyword Research
          </h1>
          <p className="text-gray-500 mt-1">
            Phân tích từ khóa từ GSC để lập kế hoạch SEO - {currentProject.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button 
            onClick={fetchKeywords}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <KPICard
            title="Tổng Queries"
            value={formatCompact(kpis.totalKeywords)}
            icon={Search}
            color="bg-blue-100 text-blue-600"
          />
          <KPICard
            title="Tổng Clicks"
            value={formatCompact(kpis.totalClicks)}
            icon={MousePointer2}
            color="bg-green-100 text-green-600"
          />
          <KPICard
            title="Vị trí TB"
            value={kpis.avgPosition.toFixed(1)}
            icon={Award}
            color="bg-purple-100 text-purple-600"
            subtitle={kpis.avgPosition <= 10 ? 'Top 10' : 'Cần cải thiện'}
          />
          <KPICard
            title="Quick Wins"
            value={kpis.quickWins}
            icon={Zap}
            color="bg-yellow-100 text-yellow-600"
            subtitle="Pos 4-10, high imp"
          />
          <KPICard
            title="Low Hanging"
            value={kpis.lowHanging}
            icon={Star}
            color="bg-orange-100 text-orange-600"
            subtitle="Pos 11-20"
          />
          <KPICard
            title="Non-Brand"
            value={kpis.nonBrandKeywords}
            icon={Target}
            color="bg-indigo-100 text-indigo-600"
            subtitle={`${((kpis.nonBrandKeywords / Math.max(kpis.totalKeywords, 1)) * 100).toFixed(0)}% of total`}
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm từ khóa..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Opportunity Filter */}
          <select
            value={opportunityFilter}
            onChange={(e) => { setOpportunityFilter(e.target.value as OpportunityFilter); setPage(0); }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả cơ hội</option>
            <option value="quick-win">🚀 Quick Wins (Pos 4-10)</option>
            <option value="low-hanging">⭐ Low Hanging (Pos 11-20)</option>
            <option value="potential">💡 Tiềm năng (Pos 21-50)</option>
            <option value="monitor">👁 Theo dõi</option>
          </select>
          
          {/* Intent Filter */}
          <select
            value={intentFilter}
            onChange={(e) => { setIntentFilter(e.target.value as IntentFilter); setPage(0); }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả intent</option>
            <option value="transactional">🛒 Giao dịch</option>
            <option value="commercial">📊 So sánh</option>
            <option value="informational">ℹ️ Tìm hiểu</option>
            <option value="navigational">🧭 Điều hướng</option>
          </select>
          
          {/* Brand Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowBrandOnly(!showBrandOnly); setShowNonBrandOnly(false); setPage(0); }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showBrandOnly ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Brand
            </button>
            <button
              onClick={() => { setShowNonBrandOnly(!showNonBrandOnly); setShowBrandOnly(false); setPage(0); }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showNonBrandOnly ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Non-Brand
            </button>
          </div>
        </div>
        
        {/* Active filters count */}
        <div className="mt-3 text-sm text-gray-500">
          Hiển thị {filteredKeywords.length.toLocaleString()} / {keywords.length.toLocaleString()} từ khóa
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Đang tải dữ liệu từ khóa...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Keywords Table */}
      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Từ khóa</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Cơ hội</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Intent</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                      onClick={() => { setSortField('clicks'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}>
                    Clicks {sortField === 'clicks' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                      onClick={() => { setSortField('impressions'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}>
                    Impressions {sortField === 'impressions' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">CTR</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                      onClick={() => { setSortField('position'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    Position {sortField === 'position' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {paginatedKeywords.map((kw, idx) => {
                  const OpportunityIcon = OPPORTUNITY_CONFIG[kw.opportunity!]?.icon || Eye;
                  const IntentIcon = INTENT_CONFIG[kw.intent!]?.icon || Info;
                  
                  return (
                    <tr 
                      key={idx} 
                      className="border-t border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedKeyword(kw)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Search className="w-4 h-4 text-gray-400 shrink-0" />
                          <div>
                            <span className="text-gray-900 font-medium">{kw.query}</span>
                            {kw.isBrand && (
                              <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">Brand</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${OPPORTUNITY_CONFIG[kw.opportunity!]?.color}`}>
                          <OpportunityIcon className="w-3 h-3" />
                          {OPPORTUNITY_CONFIG[kw.opportunity!]?.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${INTENT_CONFIG[kw.intent!]?.color}`}>
                          <IntentIcon className="w-3 h-3" />
                          {INTENT_CONFIG[kw.intent!]?.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-blue-600">
                        {formatNumber(kw.clicks)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">
                        {formatNumber(kw.impressions)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <CTRBadge ctr={kw.ctr} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <PositionBadge position={kw.position} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedKeyword(kw); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                        >
                          <Lightbulb className="w-3 h-3" />
                          Hướng dẫn SEO
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              Hiển thị {page * pageSize + 1} - {Math.min((page + 1) * pageSize, filteredKeywords.length)} / {filteredKeywords.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">
                Trang {page + 1} / {Math.ceil(filteredKeywords.length / pageSize) || 1}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * pageSize >= filteredKeywords.length}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEO Recommendations */}
      {kpis && kpis.quickWins > 0 && (
        <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
          <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5" />
            Gợi ý SEO Action Plan
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-medium text-gray-900 mb-2">🚀 Quick Wins ({kpis.quickWins} keywords)</h4>
              <p className="text-sm text-gray-600 mb-2">
                Từ khóa đang ở vị trí 4-10 với impressions cao. Cải thiện content và on-page SEO để lên top 3.
              </p>
              <button 
                onClick={() => { setOpportunityFilter('quick-win'); setPage(0); }}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Xem danh sách →
              </button>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-medium text-gray-900 mb-2">⭐ Low Hanging Fruit ({kpis.lowHanging} keywords)</h4>
              <p className="text-sm text-gray-600 mb-2">
                Từ khóa ở trang 2 (vị trí 11-20). Tăng backlinks và optimize content để lên trang 1.
              </p>
              <button 
                onClick={() => { setOpportunityFilter('low-hanging'); setPage(0); }}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                Xem danh sách →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyword Detail Panel */}
      {selectedKeyword && currentProject && (
        <KeywordDetailPanel 
          keyword={selectedKeyword}
          projectId={currentProject.id}
          onClose={() => setSelectedKeyword(null)} 
        />
      )}
    </main>
  );
}

// Main Page Component
export default function KeywordsPage() {
  return (
    <RoleGuard requiredPermissions={['dashboard:view']}>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <KeywordsContent />
      </div>
    </RoleGuard>
  );
}
