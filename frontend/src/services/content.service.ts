/**
 * Content Service
 * 
 * Manages SEO content storage and retrieval
 * Uses localStorage for persistence in mock mode
 */

import { SEOContent, ContentStatus } from '@/types/auth';

const CONTENT_STORAGE_KEY = 'seo_content_items';

// Default mock content
const DEFAULT_MOCK_CONTENT: SEOContent[] = [
  {
    id: 'content-1',
    projectId: 'project-1',
    title: 'Hướng dẫn mở tài khoản ngân hàng online',
    slug: 'huong-dan-mo-tai-khoan-ngan-hang-online',
    status: 'published',
    primaryKeyword: 'mở tài khoản ngân hàng online',
    content: '# Hướng dẫn mở tài khoản ngân hàng online\n\nMở tài khoản ngân hàng online là xu hướng phổ biến hiện nay...',
    metaTitle: 'Hướng dẫn mở tài khoản ngân hàng online 2024',
    metaDescription: 'Tìm hiểu cách mở tài khoản ngân hàng online nhanh chóng...',
    createdBy: 'user-2',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-10T10:00:00Z',
  },
  {
    id: 'content-2',
    projectId: 'project-1',
    title: 'So sánh lãi suất tiết kiệm các ngân hàng',
    slug: 'so-sanh-lai-suat-tiet-kiem',
    status: 'review',
    primaryKeyword: 'lãi suất tiết kiệm',
    content: '# So sánh lãi suất tiết kiệm\n\nLãi suất tiết kiệm là yếu tố quan trọng khi chọn ngân hàng gửi tiền...',
    metaTitle: 'So sánh lãi suất tiết kiệm các ngân hàng tháng 3/2024',
    metaDescription: 'Bảng so sánh lãi suất tiết kiệm mới nhất...',
    createdBy: 'user-2',
    createdAt: '2024-03-05T00:00:00Z',
    updatedAt: '2024-03-12T14:00:00Z',
  },
  {
    id: 'content-3',
    projectId: 'project-1',
    title: 'Cách đăng ký thẻ tín dụng VIB',
    slug: 'cach-dang-ky-the-tin-dung-vib',
    status: 'draft',
    primaryKeyword: 'thẻ tín dụng VIB',
    content: '# Cách đăng ký thẻ tín dụng VIB\n\nThẻ tín dụng VIB là một trong những lựa chọn phổ biến...',
    createdBy: 'user-2',
    createdAt: '2024-03-14T00:00:00Z',
    updatedAt: '2024-03-14T00:00:00Z',
  },
  {
    id: 'content-4',
    projectId: 'project-1',
    title: 'Ưu đãi vay mua nhà tháng 3',
    slug: 'uu-dai-vay-mua-nha-thang-3',
    status: 'approved',
    primaryKeyword: 'vay mua nhà',
    content: '# Ưu đãi vay mua nhà tháng 3\n\nChương trình vay mua nhà với lãi suất ưu đãi...',
    metaTitle: 'Ưu đãi vay mua nhà VIB - Lãi suất từ 6.5%',
    metaDescription: 'Chương trình ưu đãi vay mua nhà với lãi suất hấp dẫn...',
    createdBy: 'user-2',
    createdAt: '2024-03-08T00:00:00Z',
    updatedAt: '2024-03-13T16:00:00Z',
  },
];

/**
 * Check if running in browser
 */
const isBrowser = typeof window !== 'undefined';

/**
 * Initialize storage with default content if empty
 */
const initializeStorage = (): SEOContent[] => {
  if (!isBrowser) return DEFAULT_MOCK_CONTENT;
  
  const stored = localStorage.getItem(CONTENT_STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_CONTENT));
    return DEFAULT_MOCK_CONTENT;
  }
  
  try {
    return JSON.parse(stored);
  } catch {
    localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_CONTENT));
    return DEFAULT_MOCK_CONTENT;
  }
};

/**
 * Get all content items
 */
export const getAllContent = (): SEOContent[] => {
  return initializeStorage();
};

/**
 * Get content by project ID
 */
export const getContentByProject = (projectId: string): SEOContent[] => {
  const all = initializeStorage();
  return all.filter(c => c.projectId === projectId);
};

/**
 * Get content by ID
 */
export const getContentById = (id: string): SEOContent | null => {
  const all = initializeStorage();
  return all.find(c => c.id === id) || null;
};

/**
 * Create new content
 */
export const createContent = (content: Omit<SEOContent, 'id' | 'createdAt' | 'updatedAt'>): SEOContent => {
  if (!isBrowser) throw new Error('Cannot create content in server environment');
  
  const all = initializeStorage();
  const newContent: SEOContent = {
    ...content,
    id: `content-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  all.unshift(newContent); // Add to beginning
  localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(all));
  
  // Dispatch custom event for real-time updates
  window.dispatchEvent(new CustomEvent('content-updated'));
  
  return newContent;
};

/**
 * Update content
 */
export const updateContent = (id: string, updates: Partial<SEOContent>): SEOContent | null => {
  if (!isBrowser) return null;
  
  const all = initializeStorage();
  const index = all.findIndex(c => c.id === id);
  
  if (index === -1) return null;
  
  all[index] = {
    ...all[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(all));
  
  // Dispatch custom event for real-time updates
  window.dispatchEvent(new CustomEvent('content-updated'));
  
  return all[index];
};

/**
 * Update content status
 */
export const updateContentStatus = (id: string, status: ContentStatus): SEOContent | null => {
  return updateContent(id, { status });
};

/**
 * Delete content
 */
export const deleteContent = (id: string): boolean => {
  if (!isBrowser) return false;
  
  const all = initializeStorage();
  const filtered = all.filter(c => c.id !== id);
  
  if (filtered.length === all.length) return false;
  
  localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(filtered));
  
  // Dispatch custom event for real-time updates
  window.dispatchEvent(new CustomEvent('content-updated'));
  
  return true;
};

/**
 * Save AI-generated content
 */
export interface SaveGeneratedContentParams {
  projectId: string;
  title: string;
  slug: string;
  content: string;
  primaryKeyword: string;
  secondaryKeywords?: string[];
  metaTitle?: string;
  metaDescription?: string;
  briefId?: string;
  createdBy: string;
  status?: ContentStatus;
}

export const saveGeneratedContent = (params: SaveGeneratedContentParams): SEOContent => {
  return createContent({
    projectId: params.projectId,
    title: params.title,
    slug: params.slug,
    content: params.content,
    primaryKeyword: params.primaryKeyword,
    metaTitle: params.metaTitle,
    metaDescription: params.metaDescription,
    status: params.status || 'draft',
    createdBy: params.createdBy,
  });
};

/**
 * Get content statistics
 */
export const getContentStats = (projectId?: string): {
  total: number;
  draft: number;
  review: number;
  approved: number;
  published: number;
} => {
  const all = projectId ? getContentByProject(projectId) : getAllContent();
  
  return {
    total: all.length,
    draft: all.filter(c => c.status === 'draft').length,
    review: all.filter(c => c.status === 'review').length,
    approved: all.filter(c => c.status === 'approved').length,
    published: all.filter(c => c.status === 'published').length,
  };
};
