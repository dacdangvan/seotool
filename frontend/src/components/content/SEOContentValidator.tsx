'use client';

/**
 * SEO Content Validator Component
 * 
 * Validates content from URL or direct text input against SEO best practices
 * Provides actionable optimization suggestions
 * Now includes Content Accuracy verification against crawled data
 */

import { useState, useEffect, useCallback } from 'react';
import { useProject } from '@/context/ProjectContext';
import {
  Link2,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Search,
  Target,
  Type,
  Hash,
  Image,
  ExternalLink,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  FileWarning,
  Link as LinkIcon,
  BadgeCheck,
  AlertOctagon,
  BookOpen,
  History,
  Clock,
  Trash2,
  Eye,
  X,
} from 'lucide-react';

interface SEOCheck {
  id: string;
  category: string;
  name: string;
  status: 'pass' | 'warning' | 'fail';
  score: number;
  maxScore: number;
  message: string;
  suggestion?: string;
  details?: string;
}

// Content Verification Types
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

interface ContentVerificationResult {
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

// Validation History Types
interface ValidationHistoryItem {
  id: string;
  project_id: string;
  input_type: 'url' | 'text';
  input_url: string | null;
  input_text_preview: string | null;
  target_keyword: string | null;
  seo_score: number | null;
  accuracy_score: number | null;
  duplicate_score: number | null;
  fact_score: number | null;
  brand_score: number | null;
  created_at: string;
}

interface ValidationHistoryDetail extends ValidationHistoryItem {
  input_text: string | null;
  seo_results: SEOCheck[] | null;
  accuracy_results: ContentVerificationResult | null;
}

interface SEOValidationResult {
  overallScore: number;
  grade: string;
  gradeColor: string;
  checks: SEOCheck[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
  };
  extractedData?: {
    title?: string;
    metaDescription?: string;
    h1?: string[];
    h2?: string[];
    wordCount?: number;
    images?: number;
    imagesWithoutAlt?: number;
    internalLinks?: number;
    externalLinks?: number;
  };
}

const SEO_CRITERIA = {
  title: {
    minLength: 30,
    maxLength: 60,
    weight: 10,
  },
  metaDescription: {
    minLength: 120,
    maxLength: 160,
    weight: 10,
  },
  h1: {
    required: true,
    maxCount: 1,
    weight: 10,
  },
  h2: {
    minCount: 2,
    weight: 8,
  },
  wordCount: {
    minWords: 300,
    recommendedWords: 1500,
    weight: 15,
  },
  keyword: {
    inTitle: true,
    inH1: true,
    inFirstParagraph: true,
    density: { min: 0.5, max: 2.5 },
    weight: 15,
  },
  images: {
    hasAlt: true,
    weight: 8,
  },
  internalLinks: {
    minCount: 2,
    weight: 7,
  },
  externalLinks: {
    minCount: 1,
    weight: 5,
  },
  readability: {
    avgSentenceLength: 20,
    weight: 12,
  },
};

export function SEOContentValidator() {
  const { currentProject } = useProject();
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<SEOValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['all']));
  
  // Content Verification State
  const [verificationResult, setVerificationResult] = useState<ContentVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyEnabled, setVerifyEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'seo' | 'accuracy'>('seo');

  // Validation History State
  const [historyItems, setHistoryItems] = useState<ValidationHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ValidationHistoryDetail | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Load validation history
  const loadHistory = useCallback(async () => {
    if (!currentProject) return;
    
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/content/validation-history?projectId=${currentProject.id}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setHistoryItems(data.items || []);
        setHistoryTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Error loading validation history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [currentProject]);

  // Load history on project change
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Save validation result to history
  const saveToHistory = async (
    seoResult: SEOValidationResult,
    verifyResult: ContentVerificationResult | null
  ) => {
    if (!currentProject) return;

    try {
      await fetch('/api/content/validation-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          inputType: inputMode,
          inputUrl: inputMode === 'url' ? urlInput : null,
          inputText: inputMode === 'text' ? textInput : null,
          targetKeyword: keywordInput || null,
          seoScore: seoResult.overallScore,
          seoResults: seoResult.checks,
          accuracyScore: verifyResult?.overallScore || null,
          duplicateScore: verifyResult?.duplicateScore || null,
          factScore: verifyResult?.factScore || null,
          brandScore: verifyResult?.brandScore || null,
          accuracyResults: verifyResult || null,
        }),
      });
      
      // Reload history
      loadHistory();
    } catch (err) {
      console.error('Error saving validation history:', err);
    }
  };

  // View history item details
  const viewHistoryDetail = async (id: string) => {
    try {
      const response = await fetch(`/api/content/validation-history?id=${id}`);
      if (response.ok) {
        const detail = await response.json();
        setSelectedHistoryItem(detail);
        setShowHistoryModal(true);
        setHistoryModalTab('seo'); // Reset to SEO tab when opening
      }
    } catch (err) {
      console.error('Error loading history detail:', err);
    }
  };

  // History Modal Tab State
  const [historyModalTab, setHistoryModalTab] = useState<'seo' | 'accuracy'>('seo');

  // Delete history item
  const deleteHistoryItem = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa bản ghi này?')) return;
    
    try {
      await fetch(`/api/content/validation-history?id=${id}`, { method: 'DELETE' });
      loadHistory();
    } catch (err) {
      console.error('Error deleting history item:', err);
    }
  };

  // Verify content accuracy against crawled data - returns result for saving
  const verifyContentAccuracy = async (content: string, title?: string, url?: string): Promise<ContentVerificationResult | null> => {
    if (!currentProject || !verifyEnabled) return null;
    
    setIsVerifying(true);
    try {
      const response = await fetch('/api/content/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          content,
          title,
          url,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setVerificationResult(data);
        return data; // Return the result for saving
      }
      return null;
    } catch (err) {
      console.error('Content verification error:', err);
      return null;
    } finally {
      setIsVerifying(false);
    }
  };

  const validateFromURL = async (url: string): Promise<{ seoResult: SEOValidationResult; verifyResult: ContentVerificationResult | null }> => {
    // Fetch the page content
    const response = await fetch(`/api/content/extract?url=${encodeURIComponent(url)}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch content from URL');
    }
    
    const data = await response.json();
    const seoResult = analyzeContent(data, keywordInput);
    
    // Also verify content accuracy and wait for result
    let verifyResult: ContentVerificationResult | null = null;
    if (data.content) {
      verifyResult = await verifyContentAccuracy(data.content, data.title, url);
    }
    
    return { seoResult, verifyResult };
  };

  const validateFromText = async (text: string): Promise<{ seoResult: SEOValidationResult; verifyResult: ContentVerificationResult | null }> => {
    // Parse the text content
    const lines = text.split('\n');
    const title = lines[0] || '';
    
    // Extract headings (lines starting with # or ##)
    const h1Tags = lines.filter(line => line.match(/^#\s+/) || line.match(/^<h1>/i))
      .map(h => h.replace(/^#\s+/, '').replace(/<\/?h1>/gi, ''));
    const h2Tags = lines.filter(line => line.match(/^##\s+/) || line.match(/^<h2>/i))
      .map(h => h.replace(/^##\s+/, '').replace(/<\/?h2>/gi, ''));
    
    // Count words (excluding markdown/html)
    const cleanText = text.replace(/[#*_\[\]()]/g, '').replace(/<[^>]+>/g, '');
    const wordCount = cleanText.split(/\s+/).filter(w => w.length > 0).length;
    
    // Count images (markdown format)
    const imageMatches = text.match(/!\[([^\]]*)\]\([^)]+\)/g) || [];
    const imagesWithoutAlt = imageMatches.filter(img => img.match(/!\[\s*\]/)).length;
    
    // Count links
    const linkMatches = text.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
    const internalLinks = linkMatches.filter(link => !link.includes('http')).length;
    const externalLinks = linkMatches.filter(link => link.includes('http')).length;
    
    const extractedData = {
      title: h1Tags[0] || title,
      metaDescription: lines.slice(0, 3).join(' ').substring(0, 160),
      h1: h1Tags,
      h2: h2Tags,
      wordCount,
      images: imageMatches.length,
      imagesWithoutAlt,
      internalLinks,
      externalLinks,
    };
    
    const seoResult = analyzeContent(extractedData, keywordInput, cleanText);
    
    // Also verify content accuracy for text input and wait for result
    const verifyResult = await verifyContentAccuracy(cleanText, h1Tags[0] || title);
    
    return { seoResult, verifyResult };
  };

  const analyzeContent = (
    data: any, 
    keyword: string, 
    fullText?: string
  ): SEOValidationResult => {
    const checks: SEOCheck[] = [];
    const targetKeyword = keyword.toLowerCase().trim();
    const content = fullText || data.content || '';
    
    // 1. Title Check
    const title = data.title || '';
    const titleLength = title.length;
    let titleStatus: 'pass' | 'warning' | 'fail' = 'pass';
    let titleMessage = '';
    let titleSuggestion = '';
    
    if (!title) {
      titleStatus = 'fail';
      titleMessage = 'Missing title tag';
      titleSuggestion = 'Add a compelling title tag that includes your target keyword';
    } else if (titleLength < SEO_CRITERIA.title.minLength) {
      titleStatus = 'warning';
      titleMessage = `Title too short (${titleLength} chars). Recommended: ${SEO_CRITERIA.title.minLength}-${SEO_CRITERIA.title.maxLength} chars`;
      titleSuggestion = 'Expand your title to include more descriptive keywords';
    } else if (titleLength > SEO_CRITERIA.title.maxLength) {
      titleStatus = 'warning';
      titleMessage = `Title too long (${titleLength} chars). May be truncated in search results`;
      titleSuggestion = `Shorten to under ${SEO_CRITERIA.title.maxLength} characters`;
    } else {
      titleMessage = `Title length is optimal (${titleLength} chars)`;
    }
    
    checks.push({
      id: 'title-length',
      category: 'Meta Tags',
      name: 'Title Tag Length',
      status: titleStatus,
      score: titleStatus === 'pass' ? 10 : titleStatus === 'warning' ? 5 : 0,
      maxScore: 10,
      message: titleMessage,
      suggestion: titleSuggestion,
      details: title ? `"${title}"` : undefined,
    });

    // 2. Title contains keyword
    if (targetKeyword) {
      const keywordInTitle = title.toLowerCase().includes(targetKeyword);
      checks.push({
        id: 'title-keyword',
        category: 'Keyword Optimization',
        name: 'Keyword in Title',
        status: keywordInTitle ? 'pass' : 'fail',
        score: keywordInTitle ? 10 : 0,
        maxScore: 10,
        message: keywordInTitle 
          ? 'Target keyword found in title' 
          : 'Target keyword not found in title',
        suggestion: keywordInTitle 
          ? undefined 
          : `Include "${keyword}" in your title, preferably near the beginning`,
      });
    }

    // 3. Meta Description Check
    const metaDesc = data.metaDescription || '';
    const metaLength = metaDesc.length;
    let metaStatus: 'pass' | 'warning' | 'fail' = 'pass';
    let metaMessage = '';
    let metaSuggestion = '';
    
    if (!metaDesc) {
      metaStatus = 'fail';
      metaMessage = 'Missing meta description';
      metaSuggestion = 'Add a compelling meta description with your target keyword and call-to-action';
    } else if (metaLength < SEO_CRITERIA.metaDescription.minLength) {
      metaStatus = 'warning';
      metaMessage = `Meta description too short (${metaLength} chars)`;
      metaSuggestion = `Expand to ${SEO_CRITERIA.metaDescription.minLength}-${SEO_CRITERIA.metaDescription.maxLength} characters`;
    } else if (metaLength > SEO_CRITERIA.metaDescription.maxLength) {
      metaStatus = 'warning';
      metaMessage = `Meta description too long (${metaLength} chars). May be truncated`;
      metaSuggestion = `Shorten to under ${SEO_CRITERIA.metaDescription.maxLength} characters`;
    } else {
      metaMessage = `Meta description length is optimal (${metaLength} chars)`;
    }
    
    checks.push({
      id: 'meta-description',
      category: 'Meta Tags',
      name: 'Meta Description',
      status: metaStatus,
      score: metaStatus === 'pass' ? 10 : metaStatus === 'warning' ? 5 : 0,
      maxScore: 10,
      message: metaMessage,
      suggestion: metaSuggestion,
      details: metaDesc ? `"${metaDesc.substring(0, 100)}${metaDesc.length > 100 ? '...' : ''}"` : undefined,
    });

    // 4. H1 Tag Check
    const h1Tags = data.h1 || [];
    let h1Status: 'pass' | 'warning' | 'fail' = 'pass';
    let h1Message = '';
    let h1Suggestion = '';
    
    if (h1Tags.length === 0) {
      h1Status = 'fail';
      h1Message = 'Missing H1 tag';
      h1Suggestion = 'Add exactly one H1 tag with your target keyword';
    } else if (h1Tags.length > 1) {
      h1Status = 'warning';
      h1Message = `Multiple H1 tags found (${h1Tags.length}). Use only one H1 per page`;
      h1Suggestion = 'Keep only one H1 tag and convert others to H2';
    } else {
      h1Message = 'Single H1 tag present ✓';
    }
    
    checks.push({
      id: 'h1-tag',
      category: 'Heading Structure',
      name: 'H1 Tag',
      status: h1Status,
      score: h1Status === 'pass' ? 10 : h1Status === 'warning' ? 5 : 0,
      maxScore: 10,
      message: h1Message,
      suggestion: h1Suggestion,
      details: h1Tags.length > 0 ? h1Tags.map((h: string) => `"${h}"`).join(', ') : undefined,
    });

    // 5. H1 contains keyword
    if (targetKeyword && h1Tags.length > 0) {
      const keywordInH1 = h1Tags.some((h: string) => h.toLowerCase().includes(targetKeyword));
      checks.push({
        id: 'h1-keyword',
        category: 'Keyword Optimization',
        name: 'Keyword in H1',
        status: keywordInH1 ? 'pass' : 'warning',
        score: keywordInH1 ? 8 : 0,
        maxScore: 8,
        message: keywordInH1 
          ? 'Target keyword found in H1' 
          : 'Target keyword not found in H1',
        suggestion: keywordInH1 
          ? undefined 
          : `Include "${keyword}" in your H1 heading`,
      });
    }

    // 6. H2 Tags Check
    const h2Tags = data.h2 || [];
    const h2Count = h2Tags.length;
    let h2Status: 'pass' | 'warning' | 'fail' = 'pass';
    
    if (h2Count === 0) {
      h2Status = 'fail';
    } else if (h2Count < SEO_CRITERIA.h2.minCount) {
      h2Status = 'warning';
    }
    
    checks.push({
      id: 'h2-tags',
      category: 'Heading Structure',
      name: 'H2 Subheadings',
      status: h2Status,
      score: h2Status === 'pass' ? 8 : h2Status === 'warning' ? 4 : 0,
      maxScore: 8,
      message: h2Count === 0 
        ? 'No H2 subheadings found' 
        : `${h2Count} H2 subheading${h2Count > 1 ? 's' : ''} found`,
      suggestion: h2Count < SEO_CRITERIA.h2.minCount 
        ? `Add at least ${SEO_CRITERIA.h2.minCount} H2 subheadings to structure your content` 
        : undefined,
      details: h2Tags.length > 0 ? h2Tags.slice(0, 5).map((h: string) => `"${h}"`).join(', ') + (h2Tags.length > 5 ? '...' : '') : undefined,
    });

    // 7. Word Count Check
    const wordCount = data.wordCount || 0;
    let wordStatus: 'pass' | 'warning' | 'fail' = 'pass';
    let wordMessage = '';
    let wordSuggestion = '';
    
    if (wordCount < SEO_CRITERIA.wordCount.minWords) {
      wordStatus = 'fail';
      wordMessage = `Content too short (${wordCount} words)`;
      wordSuggestion = `Expand to at least ${SEO_CRITERIA.wordCount.minWords} words. Aim for ${SEO_CRITERIA.wordCount.recommendedWords}+ for comprehensive coverage`;
    } else if (wordCount < SEO_CRITERIA.wordCount.recommendedWords) {
      wordStatus = 'warning';
      wordMessage = `Content is adequate (${wordCount} words) but could be more comprehensive`;
      wordSuggestion = `Consider expanding to ${SEO_CRITERIA.wordCount.recommendedWords}+ words for better ranking potential`;
    } else {
      wordMessage = `Excellent content length (${wordCount} words)`;
    }
    
    checks.push({
      id: 'word-count',
      category: 'Content Quality',
      name: 'Content Length',
      status: wordStatus,
      score: wordStatus === 'pass' ? 15 : wordStatus === 'warning' ? 10 : 5,
      maxScore: 15,
      message: wordMessage,
      suggestion: wordSuggestion,
    });

    // 8. Keyword Density Check
    if (targetKeyword && content) {
      const keywordCount = (content.toLowerCase().match(new RegExp(targetKeyword, 'g')) || []).length;
      const totalWords = content.split(/\s+/).length;
      const density = totalWords > 0 ? (keywordCount / totalWords) * 100 : 0;
      
      let densityStatus: 'pass' | 'warning' | 'fail' = 'pass';
      let densityMessage = '';
      let densitySuggestion = '';
      
      if (density < SEO_CRITERIA.keyword.density.min) {
        densityStatus = 'warning';
        densityMessage = `Keyword density too low (${density.toFixed(2)}%)`;
        densitySuggestion = `Increase keyword usage. Aim for ${SEO_CRITERIA.keyword.density.min}-${SEO_CRITERIA.keyword.density.max}% density`;
      } else if (density > SEO_CRITERIA.keyword.density.max) {
        densityStatus = 'warning';
        densityMessage = `Keyword density too high (${density.toFixed(2)}%). Risk of keyword stuffing`;
        densitySuggestion = `Reduce keyword usage to avoid over-optimization. Use synonyms and related terms`;
      } else {
        densityMessage = `Optimal keyword density (${density.toFixed(2)}%)`;
      }
      
      checks.push({
        id: 'keyword-density',
        category: 'Keyword Optimization',
        name: 'Keyword Density',
        status: densityStatus,
        score: densityStatus === 'pass' ? 10 : 5,
        maxScore: 10,
        message: densityMessage,
        suggestion: densitySuggestion,
        details: `"${keyword}" appears ${keywordCount} times`,
      });
    }

    // 9. Images Check
    const imageCount = data.images || 0;
    const imagesWithoutAlt = data.imagesWithoutAlt || 0;
    let imageStatus: 'pass' | 'warning' | 'fail' = 'pass';
    let imageMessage = '';
    let imageSuggestion = '';
    
    if (imageCount === 0) {
      imageStatus = 'warning';
      imageMessage = 'No images found';
      imageSuggestion = 'Add relevant images to improve engagement and SEO';
    } else if (imagesWithoutAlt > 0) {
      imageStatus = 'warning';
      imageMessage = `${imagesWithoutAlt} of ${imageCount} images missing alt text`;
      imageSuggestion = 'Add descriptive alt text to all images for accessibility and SEO';
    } else {
      imageMessage = `${imageCount} image${imageCount > 1 ? 's' : ''} with alt text ✓`;
    }
    
    checks.push({
      id: 'images',
      category: 'Media & Links',
      name: 'Images',
      status: imageStatus,
      score: imageStatus === 'pass' ? 8 : imageStatus === 'warning' ? 4 : 0,
      maxScore: 8,
      message: imageMessage,
      suggestion: imageSuggestion,
    });

    // 10. Internal Links Check
    const internalLinks = data.internalLinks || 0;
    let internalStatus: 'pass' | 'warning' | 'fail' = 'pass';
    
    if (internalLinks === 0) {
      internalStatus = 'fail';
    } else if (internalLinks < SEO_CRITERIA.internalLinks.minCount) {
      internalStatus = 'warning';
    }
    
    checks.push({
      id: 'internal-links',
      category: 'Media & Links',
      name: 'Internal Links',
      status: internalStatus,
      score: internalStatus === 'pass' ? 7 : internalStatus === 'warning' ? 3 : 0,
      maxScore: 7,
      message: `${internalLinks} internal link${internalLinks !== 1 ? 's' : ''} found`,
      suggestion: internalLinks < SEO_CRITERIA.internalLinks.minCount 
        ? `Add at least ${SEO_CRITERIA.internalLinks.minCount} internal links to related content` 
        : undefined,
    });

    // 11. External Links Check
    const externalLinks = data.externalLinks || 0;
    let externalStatus: 'pass' | 'warning' | 'fail' = 'pass';
    
    if (externalLinks === 0) {
      externalStatus = 'warning';
    }
    
    checks.push({
      id: 'external-links',
      category: 'Media & Links',
      name: 'External Links',
      status: externalStatus,
      score: externalStatus === 'pass' ? 5 : externalStatus === 'warning' ? 2 : 0,
      maxScore: 5,
      message: `${externalLinks} external link${externalLinks !== 1 ? 's' : ''} found`,
      suggestion: externalLinks === 0 
        ? 'Add external links to authoritative sources to improve credibility' 
        : undefined,
    });

    // 12. First Paragraph Keyword Check
    if (targetKeyword && content) {
      const firstParagraph = content.split(/\n\n/)[0] || content.substring(0, 300);
      const keywordInFirst = firstParagraph.toLowerCase().includes(targetKeyword);
      
      checks.push({
        id: 'first-paragraph-keyword',
        category: 'Keyword Optimization',
        name: 'Keyword in First Paragraph',
        status: keywordInFirst ? 'pass' : 'warning',
        score: keywordInFirst ? 5 : 0,
        maxScore: 5,
        message: keywordInFirst 
          ? 'Target keyword found in first paragraph ✓' 
          : 'Target keyword not found in first paragraph',
        suggestion: keywordInFirst 
          ? undefined 
          : `Include "${keyword}" within the first 100-150 words`,
      });
    }

    // Calculate overall score
    const totalScore = checks.reduce((sum, check) => sum + check.score, 0);
    const maxScore = checks.reduce((sum, check) => sum + check.maxScore, 0);
    const overallScore = Math.round((totalScore / maxScore) * 100);
    
    // Determine grade
    let grade = 'F';
    let gradeColor = 'text-red-600';
    if (overallScore >= 90) {
      grade = 'A';
      gradeColor = 'text-green-600';
    } else if (overallScore >= 80) {
      grade = 'B';
      gradeColor = 'text-blue-600';
    } else if (overallScore >= 70) {
      grade = 'C';
      gradeColor = 'text-yellow-600';
    } else if (overallScore >= 60) {
      grade = 'D';
      gradeColor = 'text-orange-600';
    }
    
    return {
      overallScore,
      grade,
      gradeColor,
      checks,
      summary: {
        passed: checks.filter(c => c.status === 'pass').length,
        warnings: checks.filter(c => c.status === 'warning').length,
        failed: checks.filter(c => c.status === 'fail').length,
      },
      extractedData: data,
    };
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setError(null);
    setResult(null);
    setVerificationResult(null);
    
    try {
      let seoResult: SEOValidationResult;
      let verifyResult: ContentVerificationResult | null = null;
      
      if (inputMode === 'url') {
        if (!urlInput.trim()) {
          throw new Error('Please enter a URL');
        }
        const result = await validateFromURL(urlInput);
        seoResult = result.seoResult;
        verifyResult = result.verifyResult;
      } else {
        if (!textInput.trim()) {
          throw new Error('Please enter content to validate');
        }
        const result = await validateFromText(textInput);
        seoResult = result.seoResult;
        verifyResult = result.verifyResult;
      }
      
      setResult(seoResult);
      
      // Save to history with both SEO and accuracy results
      await saveToHistory(seoResult, verifyResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const getStatusIcon = (status: 'pass' | 'warning' | 'fail') => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const groupedChecks = result?.checks.reduce((acc, check) => {
    if (!acc[check.category]) {
      acc[check.category] = [];
    }
    acc[check.category].push(check);
    return acc;
  }, {} as Record<string, SEOCheck[]>) || {};

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
            <Search className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">SEO Content Validator</h2>
            <p className="text-sm text-gray-600">Analyze and optimize your content for search engines</p>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="p-6 border-b border-gray-200">
        {/* Mode Selector */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setInputMode('url')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              inputMode === 'url'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Link2 className="w-4 h-4" />
            From URL
          </button>
          <button
            onClick={() => setInputMode('text')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              inputMode === 'text'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            From Text
          </button>
        </div>

        {/* Input Fields */}
        <div className="space-y-4">
          {inputMode === 'url' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Page URL
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/blog/article"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content (Markdown or Plain Text)
              </label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={`# Your Article Title

Write your content here. Use Markdown format for best results:

## Introduction
Your introduction paragraph...

## Main Section
Your main content...

![Image description](image-url)

[Link text](link-url)
`}
                rows={12}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Keyword <span className="text-gray-400">(optional, for keyword analysis)</span>
            </label>
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="e.g., thẻ tín dụng, vay mua nhà, tài khoản tiết kiệm..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleValidate}
            disabled={isValidating}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-colors font-medium disabled:opacity-50"
          >
            {isValidating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Validate Content
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            {error}
          </div>
        )}
      </div>

      {/* Results Section */}
      {result && (
        <div className="p-6">
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('seo')}
              className={`px-4 py-2 font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'seo'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                SEO Analysis
              </div>
            </button>
            <button
              onClick={() => setActiveTab('accuracy')}
              className={`px-4 py-2 font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'accuracy'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Content Accuracy
                {isVerifying && <Loader2 className="w-3 h-3 animate-spin" />}
                {verificationResult && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    verificationResult.overallScore >= 80 ? 'bg-green-100 text-green-700' :
                    verificationResult.overallScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {verificationResult.overallScore}%
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* SEO Tab Content */}
          {activeTab === 'seo' && (
            <>
              {/* Score Overview */}
              <div className="mb-6 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className={`text-5xl font-bold ${result.gradeColor}`}>
                        {result.grade}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">Grade</div>
                    </div>
                    <div className="h-16 w-px bg-gray-300" />
                    <div className="text-center">
                      <div className="text-4xl font-bold text-gray-900">
                        {result.overallScore}%
                      </div>
                      <div className="text-sm text-gray-500 mt-1">SEO Score</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-6">
                    <div className="text-center">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="text-2xl font-semibold text-green-600">{result.summary.passed}</span>
                      </div>
                      <div className="text-sm text-gray-500">Passed</div>
                    </div>
                    <div className="text-center">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <span className="text-2xl font-semibold text-yellow-600">{result.summary.warnings}</span>
                  </div>
                  <div className="text-sm text-gray-500">Warnings</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-2xl font-semibold text-red-600">{result.summary.failed}</span>
                  </div>
                  <div className="text-sm text-gray-500">Failed</div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Checks by Category */}
          <div className="space-y-4">
            {Object.entries(groupedChecks).map(([category, checks]) => {
              const isExpanded = expandedCategories.has(category) || expandedCategories.has('all');
              const categoryScore = checks.reduce((sum, c) => sum + c.score, 0);
              const categoryMax = checks.reduce((sum, c) => sum + c.maxScore, 0);
              const categoryPercent = Math.round((categoryScore / categoryMax) * 100);
              
              return (
                <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">{category}</span>
                      <span className={`text-sm px-2 py-0.5 rounded-full ${
                        categoryPercent >= 80 ? 'bg-green-100 text-green-700' :
                        categoryPercent >= 60 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {categoryPercent}%
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="divide-y divide-gray-100">
                      {checks.map((check) => (
                        <div key={check.id} className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            {getStatusIcon(check.status)}
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900">{check.name}</span>
                                <span className="text-sm text-gray-500">
                                  {check.score}/{check.maxScore} pts
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{check.message}</p>
                              {check.details && (
                                <p className="text-xs text-gray-400 mt-1 font-mono bg-gray-50 px-2 py-1 rounded">
                                  {check.details}
                                </p>
                              )}
                              {check.suggestion && (
                                <div className="mt-2 flex items-start gap-2 text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">
                                  <Target className="w-4 h-4 mt-0.5 shrink-0" />
                                  <span>{check.suggestion}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            </>
          )}

          {/* Content Accuracy Tab */}
          {activeTab === 'accuracy' && (
            <div className="space-y-6">
              {!currentProject ? (
                <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-xl text-center">
                  <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                  <p className="text-yellow-800 font-medium">Chưa chọn project</p>
                  <p className="text-yellow-600 text-sm mt-1">
                    Vui lòng chọn project để kiểm tra tính đúng đắn dựa trên dữ liệu đã crawl
                  </p>
                </div>
              ) : isVerifying ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
                  <p className="text-gray-600">Đang kiểm tra tính đúng đắn của nội dung...</p>
                </div>
              ) : verificationResult ? (
                <>
                  {/* Verification Score Overview */}
                  <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className={`text-4xl font-bold ${
                            verificationResult.overallScore >= 80 ? 'text-green-600' :
                            verificationResult.overallScore >= 60 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {verificationResult.overallScore}%
                          </div>
                          <div className="text-sm text-gray-500 mt-1">Accuracy Score</div>
                        </div>
                        <div className="h-12 w-px bg-gray-300" />
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-lg font-semibold text-blue-600">{verificationResult.duplicateScore}%</div>
                            <div className="text-xs text-gray-500">Uniqueness</div>
                          </div>
                          <div>
                            <div className="text-lg font-semibold text-green-600">{verificationResult.factScore}%</div>
                            <div className="text-xs text-gray-500">Fact Check</div>
                          </div>
                          <div>
                            <div className="text-lg font-semibold text-purple-600">{verificationResult.brandScore}%</div>
                            <div className="text-xs text-gray-500">Brand</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Cannibalization Risk */}
                      <div className={`px-4 py-2 rounded-lg ${
                        verificationResult.cannibalizationRisk === 'none' ? 'bg-green-100 text-green-700' :
                        verificationResult.cannibalizationRisk === 'low' ? 'bg-blue-100 text-blue-700' :
                        verificationResult.cannibalizationRisk === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        <div className="text-xs uppercase font-medium">Cannibalization Risk</div>
                        <div className="text-lg font-bold capitalize">{verificationResult.cannibalizationRisk}</div>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  {verificationResult.recommendations.length > 0 && (
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        Recommendations
                      </h3>
                      <ul className="space-y-2">
                        {verificationResult.recommendations.map((rec, i) => (
                          <li key={i} className="text-sm text-blue-800">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Similar Content (Cannibalization) */}
                  {verificationResult.similarContent.length > 0 && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <FileWarning className="w-5 h-5 text-orange-500" />
                          Similar Content Detected ({verificationResult.similarContent.length})
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {verificationResult.similarContent.map((item, i) => (
                          <div key={i} className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <a 
                                  href={item.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  {item.title || item.url}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                <p className="text-xs text-gray-500 mt-1 truncate">{item.url}</p>
                              </div>
                              <span className={`px-2 py-1 rounded text-sm font-medium ${
                                item.type === 'duplicate' ? 'bg-red-100 text-red-700' :
                                item.type === 'similar' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {item.similarity}% {item.type}
                              </span>
                            </div>
                            {item.matchedPhrases.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {item.matchedPhrases.map((phrase, j) => (
                                  <span key={j} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                    &quot;{phrase}&quot;
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fact Checks */}
                  {verificationResult.factChecks.length > 0 && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-blue-500" />
                          Fact Verification ({verificationResult.factChecks.length} claims)
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                        {verificationResult.factChecks.map((fact, i) => (
                          <div key={i} className="p-4">
                            <div className="flex items-start gap-3">
                              {fact.status === 'verified' ? (
                                <BadgeCheck className="w-5 h-5 text-green-500 shrink-0" />
                              ) : fact.status === 'contradicted' ? (
                                <AlertOctagon className="w-5 h-5 text-red-500 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                              )}
                              <div className="flex-1">
                                <p className="text-sm text-gray-800">&quot;{fact.claim}&quot;</p>
                                <div className="mt-1 flex items-center gap-2">
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    fact.status === 'verified' ? 'bg-green-100 text-green-700' :
                                    fact.status === 'contradicted' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {fact.status === 'verified' ? '✓ Verified' :
                                     fact.status === 'contradicted' ? '✗ Contradicted' :
                                     '? Unverified'}
                                  </span>
                                  {fact.source && (
                                    <a 
                                      href={fact.sourceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                      Source: {fact.source.substring(0, 40)}...
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                                {fact.details && (
                                  <p className="text-xs text-gray-500 mt-1">{fact.details}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Brand Consistency */}
                  {verificationResult.brandChecks.length > 0 && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-purple-500" />
                          Brand Consistency
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {verificationResult.brandChecks.map((check, i) => (
                          <div key={i} className="p-4 flex items-start gap-3">
                            {check.status === 'pass' ? (
                              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                            ) : check.status === 'warning' ? (
                              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{check.aspect}</div>
                              <p className="text-sm text-gray-600 mt-0.5">{check.message}</p>
                              {check.suggestion && (
                                <p className="text-sm text-blue-600 mt-1">→ {check.suggestion}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Chạy validate để kiểm tra tính đúng đắn của nội dung</p>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => {
                const report = result.checks.map(c => 
                  `[${c.status.toUpperCase()}] ${c.name}: ${c.message}${c.suggestion ? `\n   → ${c.suggestion}` : ''}`
                ).join('\n\n');
                navigator.clipboard.writeText(`SEO Analysis Report\nScore: ${result.overallScore}% (${result.grade})\n\n${report}`);
              }}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Report
            </button>
            <button
              onClick={() => {
                setResult(null);
                setVerificationResult(null);
                setUrlInput('');
                setTextInput('');
              }}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              New Analysis
            </button>
          </div>
        </div>
      )}

      {/* Validation History Section */}
      {currentProject && (
        <div className="border-t border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-500" />
              Lịch sử Validate ({historyTotal})
            </h3>
            <button
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : historyItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Chưa có lịch sử validate nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-600">Thời gian</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Loại</th>
                    <th className="px-4 py-3 font-medium text-gray-600">URL / Nội dung</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Keyword</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-center">SEO Score</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-center">Accuracy</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historyItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(item.created_at).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          item.input_type === 'url' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {item.input_type === 'url' ? <Link2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                          {item.input_type === 'url' ? 'URL' : 'Text'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-800">
                        {item.input_url || item.input_text_preview || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {item.target_keyword || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.seo_score !== null ? (
                          <span className={`font-semibold ${
                            item.seo_score >= 80 ? 'text-green-600' :
                            item.seo_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {item.seo_score}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.accuracy_score !== null ? (
                          <span className={`font-semibold ${
                            item.accuracy_score >= 80 ? 'text-green-600' :
                            item.accuracy_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {item.accuracy_score}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => viewHistoryDetail(item.id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteHistoryItem(item.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* History Detail Modal */}
      {showHistoryModal && selectedHistoryItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Chi tiết Validation</h3>
                <p className="text-sm text-gray-500">
                  {new Date(selectedHistoryItem.created_at).toLocaleString('vi-VN')}
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Input Info */}
              <div className="px-6 pt-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Loại:</span>
                      <span className="ml-2 font-medium">
                        {selectedHistoryItem.input_type === 'url' ? 'URL' : 'Text'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Keyword:</span>
                      <span className="ml-2 font-medium">
                        {selectedHistoryItem.target_keyword || '-'}
                      </span>
                    </div>
                    {selectedHistoryItem.input_url && (
                      <div className="col-span-2">
                        <span className="text-gray-500">URL:</span>
                        <a 
                          href={selectedHistoryItem.input_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-600 hover:underline"
                        >
                          {selectedHistoryItem.input_url}
                        </a>
                      </div>
                    )}
                  </div>
                  
                  {/* Show input text content for text type */}
                  {selectedHistoryItem.input_type === 'text' && selectedHistoryItem.input_text && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-500 text-sm font-medium">Nội dung đã validate:</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedHistoryItem.input_text || '');
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          Copy
                        </button>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                          {selectedHistoryItem.input_text}
                        </pre>
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        {selectedHistoryItem.input_text.length} ký tự
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="px-6 pt-4">
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setHistoryModalTab('seo')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                      historyModalTab === 'seo'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Search className="w-4 h-4" />
                    SEO Analysis
                    {selectedHistoryItem.seo_score !== null && (
                      <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        selectedHistoryItem.seo_score >= 80 ? 'bg-green-100 text-green-700' :
                        selectedHistoryItem.seo_score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {selectedHistoryItem.seo_score}%
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setHistoryModalTab('accuracy')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                      historyModalTab === 'accuracy'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Content Accuracy
                    {selectedHistoryItem.accuracy_score !== null && (
                      <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        selectedHistoryItem.accuracy_score >= 80 ? 'bg-green-100 text-green-700' :
                        selectedHistoryItem.accuracy_score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {selectedHistoryItem.accuracy_score}%
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* SEO Analysis Tab */}
              {historyModalTab === 'seo' && (
                <div className="p-6 space-y-6">
                  {/* Score Overview */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Overall SEO Score</div>
                        <div className={`text-4xl font-bold ${
                          (selectedHistoryItem.seo_score ?? 0) >= 80 ? 'text-green-600' :
                          (selectedHistoryItem.seo_score ?? 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {selectedHistoryItem.seo_score ?? '-'}%
                        </div>
                      </div>
                      <div className={`text-6xl font-black ${
                        (selectedHistoryItem.seo_score ?? 0) >= 90 ? 'text-green-500' :
                        (selectedHistoryItem.seo_score ?? 0) >= 80 ? 'text-blue-500' :
                        (selectedHistoryItem.seo_score ?? 0) >= 70 ? 'text-yellow-500' :
                        (selectedHistoryItem.seo_score ?? 0) >= 60 ? 'text-orange-500' : 'text-red-500'
                      }`}>
                        {(selectedHistoryItem.seo_score ?? 0) >= 90 ? 'A' :
                         (selectedHistoryItem.seo_score ?? 0) >= 80 ? 'B' :
                         (selectedHistoryItem.seo_score ?? 0) >= 70 ? 'C' :
                         (selectedHistoryItem.seo_score ?? 0) >= 60 ? 'D' : 'F'}
                      </div>
                    </div>
                    
                    {/* Summary Stats */}
                    {selectedHistoryItem.seo_results && Array.isArray(selectedHistoryItem.seo_results) && (
                      <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="text-gray-600">
                            {selectedHistoryItem.seo_results.filter((c: SEOCheck) => c.status === 'pass').length} Passed
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          <span className="text-gray-600">
                            {selectedHistoryItem.seo_results.filter((c: SEOCheck) => c.status === 'warning').length} Warnings
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-gray-600">
                            {selectedHistoryItem.seo_results.filter((c: SEOCheck) => c.status === 'fail').length} Failed
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SEO Checks by Category */}
                  {selectedHistoryItem.seo_results && Array.isArray(selectedHistoryItem.seo_results) && (() => {
                    const groupedChecks = selectedHistoryItem.seo_results.reduce((acc: Record<string, SEOCheck[]>, check: SEOCheck) => {
                      if (!acc[check.category]) acc[check.category] = [];
                      acc[check.category].push(check);
                      return acc;
                    }, {});
                    
                    return Object.entries(groupedChecks).map(([category, checks]) => (
                      <div key={category} className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <h4 className="font-semibold text-gray-900">{category}</h4>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {(checks as SEOCheck[]).map((check, i) => (
                            <div key={i} className="p-4 flex items-start gap-3">
                              {check.status === 'pass' ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                              ) : check.status === 'warning' ? (
                                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-gray-900">{check.name}</span>
                                  <span className="text-sm text-gray-500 ml-2">{check.score}/{check.maxScore}</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-0.5">{check.message}</p>
                                {check.details && (
                                  <p className="text-xs text-gray-400 mt-1 truncate">{check.details}</p>
                                )}
                                {check.suggestion && (
                                  <p className="text-sm text-blue-600 mt-2 flex items-start gap-1">
                                    <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" />
                                    {check.suggestion}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* Content Accuracy Tab */}
              {historyModalTab === 'accuracy' && (
                <div className="p-6 space-y-6">
                  {selectedHistoryItem.accuracy_results ? (
                    <>
                      {/* Accuracy Score Overview */}
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className={`text-3xl font-bold ${
                              (selectedHistoryItem.accuracy_score ?? 0) >= 80 ? 'text-green-600' :
                              (selectedHistoryItem.accuracy_score ?? 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {selectedHistoryItem.accuracy_score ?? '-'}%
                            </div>
                            <div className="text-sm text-gray-600">Overall</div>
                          </div>
                          <div className="text-center">
                            <div className={`text-3xl font-bold ${
                              (selectedHistoryItem.duplicate_score ?? 0) >= 80 ? 'text-green-600' :
                              (selectedHistoryItem.duplicate_score ?? 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {selectedHistoryItem.duplicate_score ?? '-'}%
                            </div>
                            <div className="text-sm text-gray-600">Unique</div>
                          </div>
                          <div className="text-center">
                            <div className={`text-3xl font-bold ${
                              (selectedHistoryItem.fact_score ?? 0) >= 80 ? 'text-green-600' :
                              (selectedHistoryItem.fact_score ?? 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {selectedHistoryItem.fact_score ?? '-'}%
                            </div>
                            <div className="text-sm text-gray-600">Facts</div>
                          </div>
                          <div className="text-center">
                            <div className={`text-3xl font-bold ${
                              (selectedHistoryItem.brand_score ?? 0) >= 80 ? 'text-green-600' :
                              (selectedHistoryItem.brand_score ?? 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {selectedHistoryItem.brand_score ?? '-'}%
                            </div>
                            <div className="text-sm text-gray-600">Brand</div>
                          </div>
                        </div>
                        
                        {/* Cannibalization Risk */}
                        {selectedHistoryItem.accuracy_results.cannibalizationRisk && (
                          <div className="mt-4 pt-4 border-t border-purple-200">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Cannibalization Risk:</span>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                selectedHistoryItem.accuracy_results.cannibalizationRisk === 'none' ? 'bg-green-100 text-green-700' :
                                selectedHistoryItem.accuracy_results.cannibalizationRisk === 'low' ? 'bg-blue-100 text-blue-700' :
                                selectedHistoryItem.accuracy_results.cannibalizationRisk === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {selectedHistoryItem.accuracy_results.cannibalizationRisk.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Similar Content */}
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <FileWarning className="w-5 h-5 text-yellow-500" />
                            Similar Content ({selectedHistoryItem.accuracy_results.similarContent?.length || 0})
                          </h4>
                        </div>
                        {selectedHistoryItem.accuracy_results.similarContent?.length > 0 ? (
                          <div className="divide-y divide-gray-100">
                            {selectedHistoryItem.accuracy_results.similarContent.map((item: SimilarityMatch, i: number) => (
                              <div key={i} className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900">{item.title}</div>
                                    <a 
                                      href={item.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-600 hover:underline truncate block"
                                    >
                                      {item.url}
                                    </a>
                                    {item.matchedPhrases?.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {item.matchedPhrases.slice(0, 5).map((phrase, j) => (
                                          <span key={j} className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                                            {phrase}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                                      item.similarity >= 70 ? 'bg-red-100 text-red-700' :
                                      item.similarity >= 40 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-green-100 text-green-700'
                                    }`}>
                                      {item.similarity}% match
                                    </span>
                                    <div className="text-xs text-gray-500 mt-1 capitalize">{item.type}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center text-gray-500">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                            <p className="text-sm">Không tìm thấy nội dung trùng lặp</p>
                          </div>
                        )}
                      </div>

                      {/* Fact Checks */}
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <BadgeCheck className="w-5 h-5 text-blue-500" />
                            Fact Verification ({selectedHistoryItem.accuracy_results.factChecks?.length || 0})
                          </h4>
                        </div>
                        {selectedHistoryItem.accuracy_results.factChecks?.length > 0 ? (
                          <div className="divide-y divide-gray-100">
                            {selectedHistoryItem.accuracy_results.factChecks.map((fact: FactCheck, i: number) => (
                              <div key={i} className="p-4 flex items-start gap-3">
                                {fact.status === 'verified' ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                ) : fact.status === 'unverified' ? (
                                  <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                                )}
                                <div className="flex-1">
                                  <div className="text-gray-900">"{fact.claim}"</div>
                                  {fact.source && (
                                    <p className="text-sm text-gray-500 mt-1">
                                      Source: {fact.sourceUrl ? (
                                        <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                          {fact.source}
                                        </a>
                                      ) : fact.source}
                                    </p>
                                  )}
                                  {fact.details && (
                                    <p className="text-xs text-gray-500 mt-1">{fact.details}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center text-gray-500">
                            <BadgeCheck className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">Không có thông tin cần xác minh</p>
                          </div>
                        )}
                      </div>

                      {/* Brand Consistency */}
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-purple-500" />
                            Brand Consistency ({selectedHistoryItem.accuracy_results.brandChecks?.length || 0})
                          </h4>
                        </div>
                        {selectedHistoryItem.accuracy_results.brandChecks?.length > 0 ? (
                          <div className="divide-y divide-gray-100">
                            {selectedHistoryItem.accuracy_results.brandChecks.map((check: BrandCheck, i: number) => (
                              <div key={i} className="p-4 flex items-start gap-3">
                                {check.status === 'pass' ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                ) : check.status === 'warning' ? (
                                  <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                                )}
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">{check.aspect}</div>
                                  <p className="text-sm text-gray-600 mt-0.5">{check.message}</p>
                                  {check.suggestion && (
                                    <p className="text-sm text-blue-600 mt-2 flex items-start gap-1">
                                      <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" />
                                      {check.suggestion}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center text-gray-500">
                            <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">Chưa có kiểm tra brand consistency</p>
                          </div>
                        )}
                      </div>

                      {/* Recommendations */}
                      <div className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50">
                        <div className="px-4 py-3 border-b border-blue-200">
                          <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-blue-500" />
                            Recommendations
                          </h4>
                        </div>
                        <div className="p-4">
                          {selectedHistoryItem.accuracy_results.recommendations?.length > 0 ? (
                            <ul className="space-y-2">
                              {selectedHistoryItem.accuracy_results.recommendations.map((rec: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
                                  <ArrowRight className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-blue-700 text-center">Không có đề xuất bổ sung</p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-12 text-center text-gray-500">
                      <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Không có dữ liệu Content Accuracy cho lần validate này</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
