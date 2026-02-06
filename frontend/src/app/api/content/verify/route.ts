import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: Verify content accuracy against crawled data
 * POST /api/content/verify
 * 
 * Compares content against:
 * 1. Crawled pages in the project (detect duplicate/similar content)
 * 2. Fact-checking against existing content
 * 3. Brand consistency checks
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface VerifyRequest {
  projectId: string;
  content: string;
  title?: string;
  url?: string; // If validating an existing URL, exclude it from duplicate check
}

interface SimilarityMatch {
  url: string;
  title: string;
  similarity: number;
  matchedPhrases: string[];
  type: 'duplicate' | 'similar' | 'related';
}

interface FactCheck {
  claim: string;
  status: 'verified' | 'unverified' | 'contradicted';
  source?: string;
  sourceUrl?: string;
  details?: string;
}

interface BrandCheck {
  aspect: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  suggestion?: string;
}

interface VerificationResult {
  overallScore: number;
  duplicateScore: number;
  factScore: number;
  brandScore: number;
  similarContent: SimilarityMatch[];
  factChecks: FactCheck[];
  brandChecks: BrandCheck[];
  cannibalizationRisk: 'none' | 'low' | 'medium' | 'high';
  recommendations: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyRequest = await request.json();
    const { projectId, content, title, url } = body;

    if (!projectId || !content) {
      return NextResponse.json(
        { error: 'projectId and content are required' },
        { status: 400 }
      );
    }

    // Fetch crawled pages from backend
    let crawledPages: any[] = [];
    try {
      const response = await fetch(`${BACKEND_URL}/projects/${projectId}/crawl-results`);
      if (response.ok) {
        const data = await response.json();
        crawledPages = data.pages || [];
      }
    } catch (error) {
      console.error('Failed to fetch crawled pages:', error);
    }

    // Perform verification
    const result = await verifyContent(content, title, url, crawledPages);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Content verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}

async function verifyContent(
  content: string,
  title: string | undefined,
  sourceUrl: string | undefined,
  crawledPages: any[]
): Promise<VerificationResult> {
  const similarContent: SimilarityMatch[] = [];
  const factChecks: FactCheck[] = [];
  const brandChecks: BrandCheck[] = [];
  const recommendations: string[] = [];

  // 1. Check for duplicate/similar content (Cannibalization Detection)
  const contentLower = content.toLowerCase();
  const contentWords = extractSignificantWords(content);
  const contentPhrases = extractPhrases(content, 4); // 4-word phrases

  for (const page of crawledPages) {
    // Skip if it's the same URL being validated
    if (sourceUrl && page.url === sourceUrl) continue;
    
    const pageTitle = page.title || '';
    const pageContent = extractPageContent(page);
    
    if (!pageContent) continue;

    // Calculate similarity
    const similarity = calculateSimilarity(contentWords, extractSignificantWords(pageContent));
    const matchedPhrases = findMatchingPhrases(contentPhrases, pageContent);

    if (similarity > 0.3 || matchedPhrases.length >= 3) {
      let type: 'duplicate' | 'similar' | 'related' = 'related';
      if (similarity > 0.8) type = 'duplicate';
      else if (similarity > 0.5) type = 'similar';

      similarContent.push({
        url: page.url,
        title: pageTitle,
        similarity: Math.round(similarity * 100),
        matchedPhrases: matchedPhrases.slice(0, 5),
        type,
      });
    }
  }

  // Sort by similarity
  similarContent.sort((a, b) => b.similarity - a.similarity);

  // 2. Fact Checking - Extract claims and verify against crawled content
  const claims = extractClaims(content);
  
  for (const claim of claims.slice(0, 10)) { // Limit to 10 claims
    const verification = verifyClaim(claim, crawledPages);
    factChecks.push(verification);
  }

  // 3. Brand Consistency Checks
  brandChecks.push(...checkBrandConsistency(content, title, crawledPages));

  // 4. Calculate scores
  const duplicateScore = calculateDuplicateScore(similarContent);
  const factScore = calculateFactScore(factChecks);
  const brandScore = calculateBrandScore(brandChecks);

  // 5. Determine cannibalization risk
  const cannibalizationRisk = determineCannibalizationRisk(similarContent, title);

  // 6. Generate recommendations
  if (cannibalizationRisk !== 'none') {
    const topSimilar = similarContent[0];
    if (topSimilar) {
      recommendations.push(
        `⚠️ Nội dung có ${topSimilar.similarity}% tương tự với "${topSimilar.title}". Cân nhắc merge hoặc differentiate.`
      );
    }
  }

  if (factChecks.filter(f => f.status === 'contradicted').length > 0) {
    recommendations.push(
      '🔴 Có thông tin mâu thuẫn với nội dung đã publish. Vui lòng kiểm tra lại.'
    );
  }

  if (factChecks.filter(f => f.status === 'unverified').length > 3) {
    recommendations.push(
      '🟡 Nhiều thông tin chưa được xác minh. Cân nhắc thêm nguồn tham chiếu.'
    );
  }

  const failedBrandChecks = brandChecks.filter(b => b.status === 'fail');
  if (failedBrandChecks.length > 0) {
    recommendations.push(
      `🔴 ${failedBrandChecks.length} vấn đề về brand consistency cần sửa.`
    );
  }

  if (similarContent.length === 0 && factChecks.filter(f => f.status === 'verified').length > 2) {
    recommendations.push(
      '✅ Nội dung unique và có nhiều thông tin được xác minh từ nguồn đáng tin cậy.'
    );
  }

  const overallScore = Math.round(
    (duplicateScore * 0.4) + (factScore * 0.35) + (brandScore * 0.25)
  );

  return {
    overallScore,
    duplicateScore,
    factScore,
    brandScore,
    similarContent: similarContent.slice(0, 10), // Limit results
    factChecks,
    brandChecks,
    cannibalizationRisk,
    recommendations,
  };
}

function extractSignificantWords(text: string): Set<string> {
  const stopWords = new Set([
    'và', 'hoặc', 'của', 'là', 'các', 'được', 'có', 'cho', 'này', 'đó',
    'trong', 'với', 'để', 'từ', 'một', 'những', 'về', 'tại', 'khi', 'như',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'under', 'again', 'further', 'then', 'once',
  ]);

  const words = text.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  return new Set(words);
}

function extractPhrases(text: string, length: number): string[] {
  const words = text.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  const phrases: string[] = [];
  for (let i = 0; i <= words.length - length; i++) {
    phrases.push(words.slice(i, i + length).join(' '));
  }
  return phrases;
}

function findMatchingPhrases(phrases: string[], targetText: string): string[] {
  const targetLower = targetText.toLowerCase();
  return phrases.filter(phrase => targetLower.includes(phrase));
}

function calculateSimilarity(words1: Set<string>, words2: Set<string>): number {
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size; // Jaccard similarity
}

function extractPageContent(page: any): string {
  // Combine title, meta description, headings, and any available content
  const parts: string[] = [];
  
  if (page.title) parts.push(page.title);
  if (page.metaDescription) parts.push(page.metaDescription);
  if (page.h1Tags && Array.isArray(page.h1Tags)) parts.push(...page.h1Tags);
  if (page.h2Tags && Array.isArray(page.h2Tags)) parts.push(...page.h2Tags);
  if (page.content) parts.push(page.content);
  
  return parts.join(' ');
}

function extractClaims(content: string): string[] {
  // Extract sentences that look like factual claims
  const sentences = content
    .replace(/\n+/g, '. ')
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 200);

  // Filter for sentences that likely contain factual claims
  const claimPatterns = [
    /\d+%/,           // Percentages
    /\d+\s*(triệu|tỷ|nghìn|USD|VND|đồng)/i,  // Numbers with units
    /theo\s+/i,       // "theo" (according to)
    /nghiên cứu/i,    // "nghiên cứu" (research)
    /số liệu/i,       // "số liệu" (statistics)
    /báo cáo/i,       // "báo cáo" (report)
    /thống kê/i,      // "thống kê" (statistics)
    /năm\s+\d{4}/i,   // Year references
    /tăng|giảm|đạt/i, // Increase/decrease/achieve
    /lãi suất/i,      // Interest rate
    /phí/i,           // Fee
  ];

  const claims = sentences.filter(sentence =>
    claimPatterns.some(pattern => pattern.test(sentence))
  );

  return claims.slice(0, 15);
}

function verifyClaim(claim: string, crawledPages: any[]): FactCheck {
  const claimLower = claim.toLowerCase();
  
  // Extract key terms from the claim
  const keyTerms = extractSignificantWords(claim);
  
  // Search for supporting evidence in crawled content
  let bestMatch: { page: any; score: number } | null = null;
  
  for (const page of crawledPages) {
    const pageContent = extractPageContent(page).toLowerCase();
    
    // Check if page content contains similar information
    const matchingTerms = [...keyTerms].filter(term => pageContent.includes(term));
    const score = matchingTerms.length / keyTerms.size;
    
    if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { page, score };
    }
  }

  // Check for contradictions (simplified)
  const contradictionPatterns = [
    { pattern: /không|chưa|miễn/i, opposite: /có|đã|phí/i },
    { pattern: /tăng/i, opposite: /giảm/i },
    { pattern: /cao/i, opposite: /thấp/i },
  ];

  let isContradicted = false;
  if (bestMatch) {
    const pageContent = extractPageContent(bestMatch.page).toLowerCase();
    for (const { pattern, opposite } of contradictionPatterns) {
      if (pattern.test(claimLower) && opposite.test(pageContent)) {
        // Check if the context is similar
        const claimNumbers = claimLower.match(/\d+/g) || [];
        const pageNumbers = pageContent.match(/\d+/g) || [];
        if (claimNumbers.length > 0 && pageNumbers.length > 0) {
          const claimNum = parseInt(claimNumbers[0] || '0');
          const pageNum = parseInt(pageNumbers[0] || '0');
          if (Math.abs(claimNum - pageNum) / Math.max(claimNum, pageNum) > 0.2) {
            isContradicted = true;
            break;
          }
        }
      }
    }
  }

  if (isContradicted && bestMatch) {
    return {
      claim,
      status: 'contradicted',
      source: bestMatch.page.title,
      sourceUrl: bestMatch.page.url,
      details: 'Thông tin có thể mâu thuẫn với nội dung đã publish',
    };
  }

  if (bestMatch && bestMatch.score > 0.6) {
    return {
      claim,
      status: 'verified',
      source: bestMatch.page.title,
      sourceUrl: bestMatch.page.url,
      details: `Xác minh từ nội dung đã publish (${Math.round(bestMatch.score * 100)}% match)`,
    };
  }

  return {
    claim,
    status: 'unverified',
    details: 'Không tìm thấy nguồn xác minh trong nội dung đã crawl',
  };
}

function checkBrandConsistency(
  content: string,
  title: string | undefined,
  crawledPages: any[]
): BrandCheck[] {
  const checks: BrandCheck[] = [];
  const contentLower = content.toLowerCase();

  // 1. Brand name consistency
  const brandVariations = [
    { correct: 'VIB', variations: ['vib', 'V.I.B', 'V-I-B'] },
    { correct: 'MyVIB', variations: ['myvib', 'My VIB', 'my-vib', 'MYVIB'] },
  ];

  for (const brand of brandVariations) {
    const hasIncorrect = brand.variations.some(v => 
      content.includes(v) && v !== brand.correct
    );
    
    if (hasIncorrect) {
      checks.push({
        aspect: `Brand Name: ${brand.correct}`,
        status: 'warning',
        message: `Phát hiện cách viết không nhất quán cho "${brand.correct}"`,
        suggestion: `Sử dụng "${brand.correct}" thay vì các biến thể khác`,
      });
    }
  }

  // 2. Product name consistency (check against crawled pages)
  const productNames = new Set<string>();
  for (const page of crawledPages) {
    const pageTitle = page.title || '';
    // Extract product names from titles
    const productMatch = pageTitle.match(/VIB\s+[\w\s]+(?=\s*[-|])/i);
    if (productMatch) {
      productNames.add(productMatch[0].trim());
    }
  }

  // 3. Tone and voice consistency
  const formalIndicators = ['quý khách', 'kính mời', 'trân trọng'];
  const informalIndicators = ['bạn', 'mình', 'nhé', 'nha'];
  
  const formalCount = formalIndicators.filter(i => contentLower.includes(i)).length;
  const informalCount = informalIndicators.filter(i => contentLower.includes(i)).length;
  
  if (formalCount > 0 && informalCount > 0) {
    checks.push({
      aspect: 'Tone Consistency',
      status: 'warning',
      message: 'Nội dung mix giữa tone formal và informal',
      suggestion: 'Chọn một tone nhất quán phù hợp với đối tượng độc giả',
    });
  } else if (formalCount > 0) {
    checks.push({
      aspect: 'Tone Consistency',
      status: 'pass',
      message: 'Sử dụng tone formal nhất quán ✓',
    });
  } else if (informalCount > 0) {
    checks.push({
      aspect: 'Tone Consistency',
      status: 'pass',
      message: 'Sử dụng tone thân thiện nhất quán ✓',
    });
  }

  // 4. Check for sensitive terms
  const sensitiveTerms = [
    { term: 'đảm bảo', issue: 'Tránh hứa hẹn tuyệt đối', suggestion: 'Sử dụng "cam kết" hoặc "nỗ lực"' },
    { term: 'lãi suất thấp nhất', issue: 'Claim có thể không chính xác', suggestion: 'Thêm điều kiện cụ thể' },
    { term: 'miễn phí hoàn toàn', issue: 'Cần làm rõ điều kiện', suggestion: 'Ghi rõ các điều kiện áp dụng' },
  ];

  for (const { term, issue, suggestion } of sensitiveTerms) {
    if (contentLower.includes(term)) {
      checks.push({
        aspect: `Sensitive Term: "${term}"`,
        status: 'warning',
        message: issue,
        suggestion,
      });
    }
  }

  // 5. Call-to-action presence
  const ctaPatterns = [
    /đăng ký ngay/i,
    /liên hệ/i,
    /tìm hiểu thêm/i,
    /mở tài khoản/i,
    /tải app/i,
    /hotline/i,
  ];

  const hasCTA = ctaPatterns.some(pattern => pattern.test(content));
  checks.push({
    aspect: 'Call-to-Action',
    status: hasCTA ? 'pass' : 'warning',
    message: hasCTA 
      ? 'Có call-to-action rõ ràng ✓' 
      : 'Thiếu call-to-action',
    suggestion: hasCTA 
      ? undefined 
      : 'Thêm CTA như "Đăng ký ngay", "Liên hệ hotline", "Tìm hiểu thêm"',
  });

  // 6. Contact information
  const hasPhone = /\d{4}\s*\d{3}\s*\d{3}|\d{10,11}|1800|1900/.test(content);
  if (!hasPhone) {
    checks.push({
      aspect: 'Contact Information',
      status: 'warning',
      message: 'Không có số điện thoại liên hệ',
      suggestion: 'Thêm hotline VIB: 1800 8180',
    });
  }

  return checks;
}

function calculateDuplicateScore(similarContent: SimilarityMatch[]): number {
  if (similarContent.length === 0) return 100;
  
  const maxSimilarity = Math.max(...similarContent.map(s => s.similarity));
  const duplicateCount = similarContent.filter(s => s.type === 'duplicate').length;
  
  let score = 100;
  score -= maxSimilarity * 0.5; // Deduct based on max similarity
  score -= duplicateCount * 20; // Heavy penalty for duplicates
  score -= similarContent.filter(s => s.type === 'similar').length * 10;
  
  return Math.max(0, Math.round(score));
}

function calculateFactScore(factChecks: FactCheck[]): number {
  if (factChecks.length === 0) return 80; // No claims to verify
  
  const verified = factChecks.filter(f => f.status === 'verified').length;
  const contradicted = factChecks.filter(f => f.status === 'contradicted').length;
  const unverified = factChecks.filter(f => f.status === 'unverified').length;
  
  const score = (verified * 100 + unverified * 60 + contradicted * 0) / factChecks.length;
  return Math.round(score);
}

function calculateBrandScore(brandChecks: BrandCheck[]): number {
  if (brandChecks.length === 0) return 100;
  
  const passed = brandChecks.filter(b => b.status === 'pass').length;
  const warnings = brandChecks.filter(b => b.status === 'warning').length;
  const failed = brandChecks.filter(b => b.status === 'fail').length;
  
  const score = (passed * 100 + warnings * 60 + failed * 0) / brandChecks.length;
  return Math.round(score);
}

function determineCannibalizationRisk(
  similarContent: SimilarityMatch[],
  title: string | undefined
): 'none' | 'low' | 'medium' | 'high' {
  if (similarContent.length === 0) return 'none';
  
  const duplicates = similarContent.filter(s => s.type === 'duplicate');
  const highSimilar = similarContent.filter(s => s.similarity > 60);
  
  if (duplicates.length > 0) return 'high';
  if (highSimilar.length >= 3) return 'high';
  if (highSimilar.length >= 1) return 'medium';
  if (similarContent.length >= 3) return 'low';
  
  return 'none';
}
