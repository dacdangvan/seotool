'use client';

/**
 * AI Image Generator Component
 * Generate images for articles using AI or upload from device
 */

import { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Loader2,
  Download,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Trash2,
  Palette,
  Upload,
  Link as LinkIcon,
  X,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  style: string;
  width: number;
  height: number;
}

interface AIImageGeneratorProps {
  projectId: string;
  keyword: string;
  articleTitle: string;
  articleContent?: string; // Full article content for context
  initialImages?: GeneratedImage[]; // For restoring images when tab switches
  onImageGenerated?: (imageUrl: string, allImages: GeneratedImage[]) => void;
}

const IMAGE_STYLES = [
  {
    id: 'professional',
    name: 'Chuyên nghiệp',
    description: 'Phong cách doanh nghiệp, chuyên nghiệp',
    emoji: '💼',
  },
  {
    id: 'realistic',
    name: 'Chân thực',
    description: 'Ảnh chân thực, như chụp thật',
    emoji: '📷',
  },
  {
    id: 'minimalist',
    name: 'Tối giản',
    description: 'Thiết kế sạch, đơn giản',
    emoji: '⚪',
  },
  {
    id: 'artistic',
    name: 'Nghệ thuật',
    description: 'Sáng tạo, nghệ thuật',
    emoji: '🎨',
  },
  {
    id: 'cartoon',
    name: 'Hoạt hình',
    description: 'Phong cách cartoon vui nhộn',
    emoji: '🎭',
  },
];

const IMAGE_SIZES = [
  { id: '1024x1024', name: 'Vuông (1:1)', width: 1024, height: 1024 },
  { id: '1792x1024', name: 'Ngang (16:9)', width: 1792, height: 1024 },
  { id: '1024x1792', name: 'Dọc (9:16)', width: 1024, height: 1792 },
];

export function AIImageGenerator({
  projectId,
  keyword,
  articleTitle,
  articleContent,
  initialImages,
  onImageGenerated,
}: AIImageGeneratorProps) {
  // Extract key points from article content to generate better prompt
  const extractKeyPoints = (content: string): string[] => {
    if (!content) return [];
    
    // Get headings (## or ###)
    const headings = content.match(/^#{2,3}\s+(.+)$/gm)?.map(h => h.replace(/^#+\s+/, '')) || [];
    
    // Get first paragraph after title
    const paragraphs = content.split('\n\n').filter(p => p.trim() && !p.startsWith('#'));
    const firstPara = paragraphs[0]?.slice(0, 300) || '';
    
    // Extract key numbers/stats if any
    const numbers = content.match(/\d+[.,]?\d*\s*(%|năm|tháng|triệu|tỷ|VNĐ)/gi) || [];
    
    return [...headings.slice(0, 5), firstPara, ...numbers.slice(0, 3)].filter(Boolean);
  };

  const keyPoints = extractKeyPoints(articleContent || '');
  
  // Extract main topic from article
  const extractMainTopic = () => {
    if (!articleContent) return keyword;
    
    // Get first heading after H1
    const h2Match = articleContent.match(/^##\s+(.+)$/m);
    if (h2Match) return h2Match[1];
    
    return keyword;
  };
  
  // Auto-generate smart prompt based on article content - OPTIMIZED FOR STABLE DIFFUSION
  const generateSmartPrompt = () => {
    const mainTopic = extractMainTopic();
    const headings = keyPoints.filter(p => !p.includes('%') && p.length < 100);
    
    // Map Vietnamese content to English keywords for better Stable Diffusion results
    const topicKeywords = extractTopicKeywords(keyword, articleTitle);
    
    // Determine visual subject based on content
    let visualSubject = '';
    let visualStyle = '';
    let colorScheme = '';
    
    if (keyword.toLowerCase().includes('vay') || keyword.toLowerCase().includes('lãi suất')) {
      visualSubject = 'modern bank loan service illustration, person receiving money, financial documents, approved loan concept';
      visualStyle = 'corporate fintech illustration, professional banking, trustworthy';
      colorScheme = 'blue and white color palette, gradient blue to purple, clean background';
    } else if (keyword.toLowerCase().includes('thẻ tín dụng') || keyword.toLowerCase().includes('thẻ')) {
      visualSubject = 'premium credit card, elegant bank card floating, cashback rewards, digital payment concept';
      visualStyle = 'sleek modern product shot, luxury fintech design, premium quality';
      colorScheme = 'metallic gold and blue gradient, elegant dark background, spotlight effect';
    } else if (keyword.toLowerCase().includes('tiết kiệm')) {
      visualSubject = 'savings growth concept, piggy bank with coins, financial growth chart, secure vault';
      visualStyle = 'friendly corporate illustration, financial wellness, positive growth';
      colorScheme = 'green and blue tones, gold accents, warm lighting';
    } else if (keyword.toLowerCase().includes('tài khoản') || keyword.toLowerCase().includes('mobile')) {
      visualSubject = 'smartphone showing banking app, digital banking interface, secure mobile transaction';
      visualStyle = 'modern UI/UX mockup, clean app design, technology focused';
      colorScheme = 'blue gradient background, white device, subtle purple accents';
    } else if (keyword.toLowerCase().includes('bảo hiểm')) {
      visualSubject = 'insurance protection concept, family with shield icon, security umbrella, life protection';
      visualStyle = 'warm corporate illustration, family-friendly, protective theme';
      colorScheme = 'soft blue and green, warm yellow highlights, reassuring tones';
    } else if (keyword.toLowerCase().includes('đầu tư') || keyword.toLowerCase().includes('chứng khoán')) {
      visualSubject = 'investment growth chart, stock market graph, portfolio analysis, wealth management';
      visualStyle = 'professional finance visualization, data-driven design, sophisticated';
      colorScheme = 'deep blue and green, gold accents, dark professional background';
    } else {
      visualSubject = 'modern banking service illustration, professional financial concept, business excellence';
      visualStyle = 'corporate fintech design, trustworthy banking, premium quality';
      colorScheme = 'blue to purple gradient, clean white accents, professional lighting';
    }
    
    // Build English prompt optimized for Stable Diffusion/HuggingFace
    const englishPrompt = `${visualSubject}, ${visualStyle}, ${colorScheme}, high quality 4K render, professional photography lighting, depth of field, sharp focus, trending on artstation, no text no watermark no logo`;

    return englishPrompt;
  };
  
  // Extract topic keywords from Vietnamese content
  const extractTopicKeywords = (keyword: string, title: string): string[] => {
    const keywordMap: Record<string, string[]> = {
      'vay': ['loan', 'lending', 'borrowing', 'credit', 'financing'],
      'thẻ': ['card', 'credit card', 'payment', 'cashback'],
      'tiết kiệm': ['savings', 'deposit', 'growth', 'interest'],
      'tài khoản': ['account', 'banking', 'mobile', 'digital'],
      'bảo hiểm': ['insurance', 'protection', 'security', 'coverage'],
      'đầu tư': ['investment', 'portfolio', 'wealth', 'returns'],
      'lãi suất': ['interest rate', 'APR', 'percentage', 'rate'],
      'ngân hàng': ['bank', 'banking', 'financial', 'institution'],
    };
    
    const keywords: string[] = [];
    const lowerKeyword = keyword.toLowerCase();
    const lowerTitle = title.toLowerCase();
    
    for (const [vn, en] of Object.entries(keywordMap)) {
      if (lowerKeyword.includes(vn) || lowerTitle.includes(vn)) {
        keywords.push(...en);
      }
    }
    
    return keywords.length > 0 ? keywords : ['banking', 'financial', 'professional'];
  };

  const [prompt, setPrompt] = useState(() => articleContent ? generateSmartPrompt() : '');
  const [selectedStyle, setSelectedStyle] = useState('professional');
  const [selectedSize, setSelectedSize] = useState('1792x1024'); // Default landscape for articles
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>(initialImages || []);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate prompt suggestion based on keyword - ENGLISH PROMPTS FOR BETTER RESULTS
  const suggestPrompt = () => {
    if (articleContent) {
      setPrompt(generateSmartPrompt());
      return;
    }
    
    // English suggestions optimized for Stable Diffusion
    const suggestions = [
      `Professional banking illustration for "${keyword}", modern fintech design, blue and purple gradient, clean composition, corporate style, 4K quality, no text`,
      `Modern financial service hero banner, business people using digital banking app, professional photography, blue color scheme, trustworthy atmosphere, high quality`,
      `Elegant credit card floating in space, premium metallic finish, cashback rewards concept, luxury product shot, dark background with blue highlights, studio lighting`,
      `Financial growth concept illustration, ascending chart, coins and money, successful investment, professional corporate style, blue and gold colors, clean design`,
      `Mobile banking app on smartphone, secure transaction concept, fingerprint authentication, modern UI design, blue gradient background, technology focused, 4K render`,
      `Happy family financial planning concept, home and car icons, savings growth, insurance protection, warm professional illustration, friendly corporate style`,
    ];
    setPrompt(suggestions[Math.floor(Math.random() * suggestions.length)]);
  };

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('Vui lòng nhập mô tả hình ảnh');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const size = IMAGE_SIZES.find(s => s.id === selectedSize)!;
      
      const response = await fetch(`${API_BASE}/projects/${projectId}/images/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style: selectedStyle,
          width: size.width,
          height: size.height,
          provider: 'auto', // Let backend choose based on configured image_provider
        }),
      });

      const data = await response.json();

      if (data.success) {
        const newImage: GeneratedImage = {
          id: data.data.id,
          imageUrl: data.data.imageUrl,
          prompt: data.data.prompt || prompt,
          style: selectedStyle,
          width: size.width,
          height: size.height,
        };
        const updatedImages = [newImage, ...generatedImages];
        setGeneratedImages(updatedImages);
        onImageGenerated?.(newImage.imageUrl, updatedImages);
      } else {
        setError(data.error || 'Không thể tạo hình ảnh');
      }
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi');
    } finally {
      setGenerating(false);
    }
  };

  const copyImageUrl = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  const deleteImage = (id: string) => {
    setGeneratedImages(prev => prev.filter(img => img.id !== id));
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh hợp lệ (PNG, JPG, WEBP)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File quá lớn. Kích thước tối đa là 10MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          
          const response = await fetch(`${API_BASE}/projects/${projectId}/images/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageData: base64Data,
              mimeType: file.type,
            }),
          });

          const data = await response.json();

          if (data.success) {
            const newImage: GeneratedImage = {
              id: data.data.id || `upload-${Date.now()}`,
              imageUrl: data.data.imageUrl,
              prompt: 'Uploaded image',
              style: 'uploaded',
              width: 1024,
              height: 1024,
            };
            const updatedImages = [newImage, ...generatedImages];
            setGeneratedImages(updatedImages);
            onImageGenerated?.(newImage.imageUrl, updatedImages);
          } else {
            setError(data.error || 'Không thể upload ảnh');
          }
        } catch (err: any) {
          setError(err.message || 'Đã xảy ra lỗi khi upload');
        } finally {
          setUploading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      reader.onerror = () => {
        setError('Không thể đọc file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi upload');
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle URL input
  const handleUrlAdd = async () => {
    if (!imageUrl.trim()) {
      setError('Vui lòng nhập URL ảnh');
      return;
    }

    // Basic URL validation
    try {
      new URL(imageUrl);
    } catch {
      setError('URL không hợp lệ');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Verify the URL is accessible and is an image
      const response = await fetch(imageUrl, { method: 'HEAD' });
      const contentType = response.headers.get('content-type');
      
      if (!contentType?.startsWith('image/')) {
        // Still allow if we can't verify - some servers don't return correct headers
        console.warn('Could not verify image content type');
      }

      const newImage: GeneratedImage = {
        id: `url-${Date.now()}`,
        imageUrl: imageUrl,
        prompt: 'Image from URL',
        style: 'external',
        width: 1024,
        height: 1024,
      };
      const updatedImages = [newImage, ...generatedImages];
      setGeneratedImages(updatedImages);
      onImageGenerated?.(newImage.imageUrl, updatedImages);
      setImageUrl('');
      setShowUrlInput(false);
    } catch (err: any) {
      // Still add the image even if HEAD request fails (CORS issues)
      const newImage: GeneratedImage = {
        id: `url-${Date.now()}`,
        imageUrl: imageUrl,
        prompt: 'Image from URL',
        style: 'external',
        width: 1024,
        height: 1024,
      };
      const updatedImages = [newImage, ...generatedImages];
      setGeneratedImages(updatedImages);
      onImageGenerated?.(newImage.imageUrl, updatedImages);
      setImageUrl('');
      setShowUrlInput(false);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6" />
          <div>
            <h3 className="font-semibold text-lg">AI Image Generator</h3>
            <p className="text-sm text-pink-100">Tạo hình minh họa bằng AI hoặc upload ảnh</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Upload Options */}
        <div className="p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
          <p className="text-sm font-medium text-gray-700 mb-3 text-center">
            📤 Upload ảnh từ máy tính hoặc nhập URL
          </p>
          <div className="flex gap-2 justify-center">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Chọn file
            </button>

            {/* URL Button */}
            <button
              onClick={() => setShowUrlInput(!showUrlInput)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium ${
                showUrlInput
                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              Nhập URL
            </button>
          </div>

          {/* URL Input Field */}
          {showUrlInput && (
            <div className="mt-3 flex gap-2">
              <input
                type="url"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={handleUrlAdd}
                disabled={uploading || !imageUrl.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Thêm
              </button>
            </div>
          )}

          <p className="text-xs text-gray-500 text-center mt-2">
            Hỗ trợ: PNG, JPG, WEBP • Tối đa 10MB
          </p>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-white text-gray-500">hoặc tạo bằng AI</span>
          </div>
        </div>

        {/* Prompt Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Mô tả hình ảnh
            </label>
            <button
              onClick={suggestPrompt}
              className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              Gợi ý prompt
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Mô tả chi tiết hình ảnh bạn muốn tạo..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={3}
          />
        </div>

        {/* Style Selection */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            <Palette className="w-4 h-4 inline mr-1" />
            Phong cách
          </label>
          <div className="grid grid-cols-5 gap-2">
            {IMAGE_STYLES.map(style => (
              <button
                key={style.id}
                onClick={() => setSelectedStyle(style.id)}
                className={`p-2 rounded-lg border-2 text-center transition-all ${
                  selectedStyle === style.id
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                title={style.description}
              >
                <span className="text-xl">{style.emoji}</span>
                <p className="text-xs mt-1 text-gray-700">{style.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Size Selection */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            <ImageIcon className="w-4 h-4 inline mr-1" />
            Kích thước
          </label>
          <div className="flex gap-2">
            {IMAGE_SIZES.map(size => (
              <button
                key={size.id}
                onClick={() => setSelectedSize(size.id)}
                className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                  selectedSize === size.id
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                {size.name}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateImage}
          disabled={generating || !prompt.trim()}
          className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-medium hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Đang tạo hình ảnh...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Tạo hình ảnh
            </>
          )}
        </button>

        {/* Note about API key */}
        <p className="text-xs text-gray-500 text-center">
          💡 Cần cấu hình OpenAI API key trong AI Settings để tạo ảnh thực. 
          Nếu chưa có, sẽ sử dụng ảnh placeholder.
        </p>

        {/* Generated Images */}
        {generatedImages.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Hình ảnh đã tạo ({generatedImages.length})
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {generatedImages.map(img => (
                <div
                  key={img.id}
                  className="relative group rounded-lg overflow-hidden border border-gray-200"
                >
                  <img
                    src={img.imageUrl}
                    alt={img.prompt}
                    className="w-full aspect-square object-cover"
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => downloadImage(img.imageUrl, `image-${img.id}.png`)}
                      className="p-2 bg-white rounded-full text-gray-700 hover:bg-gray-100"
                      title="Tải xuống"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => copyImageUrl(img.imageUrl, img.id)}
                      className="p-2 bg-white rounded-full text-gray-700 hover:bg-gray-100"
                      title="Copy URL"
                    >
                      {copied === img.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteImage(img.id)}
                      className="p-2 bg-white rounded-full text-red-500 hover:bg-red-50"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Style Badge */}
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-0.5 bg-white/90 text-xs rounded-full text-gray-700">
                      {IMAGE_STYLES.find(s => s.id === img.style)?.emoji}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIImageGenerator;
