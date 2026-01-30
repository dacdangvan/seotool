#!/usr/bin/env ts-node
/**
 * Example: How AI Agents push recommendations to the database
 * 
 * This script demonstrates how different AI agents can send their
 * generated recommendations to the backend API.
 * 
 * Usage: npx ts-node scripts/push-recommendations-example.ts
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// =============================================================================
// TYPES
// =============================================================================

interface RecommendationInput {
  category: 'technical' | 'content' | 'keywords' | 'backlinks' | 'ux';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  autoExecutable?: boolean;
  actionData?: Record<string, any>;
  estimatedTrafficGain?: number;
  affectedUrls?: string[];
  relatedKeywords?: string[];
}

interface PushRecommendationsRequest {
  source: string;
  recommendations: RecommendationInput[];
  options?: {
    refreshSource?: boolean;  // Delete old recommendations from this source first
    skipDuplicates?: boolean;
  };
}

// =============================================================================
// API CLIENT
// =============================================================================

async function pushRecommendations(
  projectId: string,
  payload: PushRecommendationsRequest
): Promise<any> {
  const url = `${BACKEND_URL}/projects/${projectId}/recommendations`;
  
  console.log(`\n📤 Pushing ${payload.recommendations.length} recommendations from ${payload.source}...`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API Error: ${error.error?.message || response.statusText}`);
  }

  return response.json();
}

// =============================================================================
// EXAMPLE: TECHNICAL SEO AGENT
// =============================================================================

async function pushTechnicalSEORecommendations(projectId: string) {
  console.log('\n🔧 Technical SEO Agent generating recommendations...');
  
  // These would come from actual audit results
  const recommendations: RecommendationInput[] = [
    {
      category: 'technical',
      title: 'Tối ưu Largest Contentful Paint (LCP)',
      description: 'LCP hiện tại là 3.2s, vượt ngưỡng 2.5s của Google. Cần tối ưu hình ảnh hero, implement lazy loading, và preload critical resources.',
      impact: 'high',
      effort: 'medium',
      actionData: {
        metric: 'LCP',
        currentValue: 3.2,
        targetValue: 2.5,
        issueType: 'cwv_lcp',
        suggestions: [
          'Compress hero images with WebP format',
          'Add preload hints for critical images',
          'Implement image lazy loading',
        ],
      },
      estimatedTrafficGain: 1500,
      affectedUrls: ['/trang-chu', '/vay-tieu-dung', '/the-tin-dung'],
    },
    {
      category: 'technical',
      title: 'Fix 12 broken internal links',
      description: 'Phát hiện 12 internal links trỏ đến trang 404. Cần cập nhật hoặc redirect các link này để cải thiện crawl efficiency.',
      impact: 'medium',
      effort: 'low',
      priority: 'high', // Override calculated priority
      autoExecutable: true,
      actionData: {
        issueType: 'broken_links',
        brokenLinks: [
          { from: '/vay-tieu-dung', to: '/san-pham-cu', status: 404 },
          { from: '/tin-tuc', to: '/bai-viet-da-xoa', status: 404 },
        ],
        autoFixAction: 'redirect_to_homepage',
      },
    },
    {
      category: 'technical',
      title: 'Thêm structured data cho Product pages',
      description: 'Các trang sản phẩm thiếu structured data. Thêm JSON-LD schema để enable rich results trong SERP.',
      impact: 'medium',
      effort: 'low',
      actionData: {
        schemaType: 'Product',
        pagesWithoutSchema: 15,
        richResultPotential: ['price', 'rating', 'availability'],
      },
      estimatedTrafficGain: 800,
    },
  ];

  const result = await pushRecommendations(projectId, {
    source: 'technical_seo_agent',
    recommendations,
    options: {
      refreshSource: true, // Replace old technical recommendations
    },
  });

  console.log('✅ Technical SEO recommendations pushed:', result.data);
}

// =============================================================================
// EXAMPLE: KEYWORD INTELLIGENCE AGENT
// =============================================================================

async function pushKeywordRecommendations(projectId: string) {
  console.log('\n🔑 Keyword Intelligence Agent generating recommendations...');
  
  const recommendations: RecommendationInput[] = [
    {
      category: 'keywords',
      title: 'Cơ hội từ khóa "lãi suất vay mua nhà 2024"',
      description: 'Từ khóa có volume 45,000/tháng, hiện chưa có ranking. Competition thấp (28/100). Suggest tạo landing page chuyên biệt.',
      impact: 'high',
      effort: 'medium',
      actionData: {
        keyword: 'lãi suất vay mua nhà 2024',
        searchVolume: 45000,
        difficulty: 28,
        currentPosition: null,
        targetPosition: 5,
        intent: 'commercial',
        suggestedAction: 'create_landing_page',
      },
      estimatedTrafficGain: 3500,
      relatedKeywords: ['vay mua nhà', 'lãi suất ngân hàng', 'vay mua nhà VIB'],
    },
    {
      category: 'keywords',
      title: 'Cải thiện ranking "thẻ tín dụng cashback"',
      description: 'Hiện rank #12, có thể lên top 5 bằng cách bổ sung internal links và cập nhật content với thông tin mới nhất.',
      impact: 'medium',
      effort: 'low',
      actionData: {
        keyword: 'thẻ tín dụng cashback',
        searchVolume: 22000,
        currentPosition: 12,
        targetPosition: 5,
        intent: 'transactional',
        improvements: ['add_internal_links', 'update_content', 'add_comparison_table'],
      },
      estimatedTrafficGain: 1800,
      affectedUrls: ['/the-tin-dung/cashback'],
    },
    {
      category: 'keywords',
      title: 'Theo dõi 5 từ khóa trending mới',
      description: 'Phát hiện 5 từ khóa trending trong ngành banking: "ứng dụng ngân hàng số", "thanh toán không tiếp xúc", etc.',
      impact: 'low',
      effort: 'low',
      actionData: {
        trendingKeywords: [
          { keyword: 'ứng dụng ngân hàng số', volume: 12000, trend: '+45%' },
          { keyword: 'thanh toán không tiếp xúc', volume: 8500, trend: '+62%' },
          { keyword: 'mở tài khoản online', volume: 18000, trend: '+28%' },
        ],
        suggestedAction: 'monitor_and_plan',
      },
    },
  ];

  const result = await pushRecommendations(projectId, {
    source: 'keyword_intelligence',
    recommendations,
    options: {
      skipDuplicates: true,
    },
  });

  console.log('✅ Keyword recommendations pushed:', result.data);
}

// =============================================================================
// EXAMPLE: MONITORING AGENT (from alerts)
// =============================================================================

async function pushMonitoringRecommendations(projectId: string) {
  console.log('\n📊 Monitoring Agent generating recommendations from alerts...');
  
  const recommendations: RecommendationInput[] = [
    {
      category: 'technical',
      title: 'Cảnh báo: Traffic drop 15% trong 7 ngày qua',
      description: 'Organic traffic giảm từ 46,077 xuống 39,165 (-15%). Nguyên nhân có thể từ: ranking drops, technical issues, hoặc seasonal trend. Khuyến nghị: kiểm tra GSC performance report.',
      impact: 'high',
      effort: 'low',
      priority: 'critical',
      actionData: {
        alertType: 'traffic_drop',
        metricType: 'organic_traffic',
        anomalyType: 'sudden_drop',
        previousValue: 46077,
        currentValue: 39165,
        changePercent: -15,
        detectedAt: new Date().toISOString(),
        suggestedActions: [
          'Check GSC for ranking changes',
          'Review recent site changes',
          'Check for crawl errors',
        ],
      },
    },
    {
      category: 'keywords',
      title: 'Cảnh báo: 3 keywords xuống hạng đáng kể',
      description: '"vay tiêu dùng" giảm từ #3 xuống #8, "thẻ tín dụng online" giảm từ #5 xuống #12. Cần review content và backlinks.',
      impact: 'high',
      effort: 'medium',
      actionData: {
        alertType: 'ranking_drop',
        affectedKeywords: [
          { keyword: 'vay tiêu dùng', from: 3, to: 8, volume: 33000 },
          { keyword: 'thẻ tín dụng online', from: 5, to: 12, volume: 18000 },
          { keyword: 'lãi suất tiết kiệm', from: 4, to: 9, volume: 25000 },
        ],
      },
      estimatedTrafficGain: -2500, // Negative = traffic being lost
    },
  ];

  const result = await pushRecommendations(projectId, {
    source: 'monitoring_agent',
    recommendations,
    options: {
      skipDuplicates: true,
    },
  });

  console.log('✅ Monitoring recommendations pushed:', result.data);
}

// =============================================================================
// EXAMPLE: CONTENT ENGINE
// =============================================================================

async function pushContentRecommendations(projectId: string) {
  console.log('\n📝 Content Engine generating recommendations...');
  
  const recommendations: RecommendationInput[] = [
    {
      category: 'content',
      title: 'Cập nhật 8 bài viết outdated (> 6 tháng)',
      description: 'Có 8 bài viết về lãi suất và sản phẩm đã cũ hơn 6 tháng. Thông tin lãi suất có thể đã thay đổi. Cần review và cập nhật.',
      impact: 'medium',
      effort: 'high',
      actionData: {
        issueType: 'outdated_content',
        outdatedPages: [
          { url: '/lai-suat-vay', lastUpdated: '2023-06-15', ageInDays: 230 },
          { url: '/so-sanh-the-tin-dung', lastUpdated: '2023-05-20', ageInDays: 256 },
        ],
        updatePriority: ['rate_info', 'product_features', 'faq'],
      },
      affectedUrls: ['/lai-suat-vay', '/so-sanh-the-tin-dung', '/vay-mua-xe'],
    },
    {
      category: 'content',
      title: 'Tối ưu meta description cho 15 trang',
      description: 'Có 15 trang có meta description quá dài (>160 ký tự) hoặc thiếu call-to-action. Cần viết lại ngắn gọn và hấp dẫn hơn.',
      impact: 'medium',
      effort: 'low',
      autoExecutable: true,
      actionData: {
        issueType: 'meta_description',
        pagesWithIssues: 15,
        issues: ['too_long', 'missing_cta', 'duplicate'],
        autoFixAvailable: true,
      },
      estimatedTrafficGain: 500,
    },
    {
      category: 'content',
      title: 'Thêm internal links vào 20 trang orphan',
      description: 'Phát hiện 20 trang có ít hơn 3 internal links pointing to them. Cần bổ sung contextual links để cải thiện discoverability.',
      impact: 'medium',
      effort: 'medium',
      actionData: {
        issueType: 'orphan_pages',
        orphanPages: 20,
        avgInternalLinks: 1.5,
        targetInternalLinks: 5,
        suggestedLinkSources: ['/blog', '/san-pham', '/huong-dan'],
      },
    },
  ];

  const result = await pushRecommendations(projectId, {
    source: 'content_engine',
    recommendations,
  });

  console.log('✅ Content recommendations pushed:', result.data);
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  // Use the VIB project ID from seed data
  const projectId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  
  console.log('🚀 AI Agents Recommendation Push Demo');
  console.log('=====================================');
  console.log(`Project ID: ${projectId}`);
  console.log(`Backend URL: ${BACKEND_URL}`);

  try {
    // Push recommendations from different agents
    await pushTechnicalSEORecommendations(projectId);
    await pushKeywordRecommendations(projectId);
    await pushMonitoringRecommendations(projectId);
    await pushContentRecommendations(projectId);

    console.log('\n✨ All recommendations pushed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Technical SEO Agent: 3 recommendations (refreshed)');
    console.log('- Keyword Intelligence: 3 recommendations');
    console.log('- Monitoring Agent: 2 recommendations');
    console.log('- Content Engine: 3 recommendations');
    console.log('\nTotal: ~11 new recommendations in database');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
