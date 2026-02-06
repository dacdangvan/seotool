'use client';

/**
 * AI Settings Component
 * Configure AI providers for content generation per project
 */

import { useState, useEffect } from 'react';
import {
  Bot,
  Key,
  Check,
  X,
  Loader2,
  TestTube,
  Save,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Settings,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AIConfig {
  ai_provider: string;
  // Ollama
  ollama_api_url?: string;
  ollama_model?: string;
  ollama_enabled?: boolean;
  ollama_configured?: boolean;
  // Other providers
  moltbot_api_url: string;
  moltbot_model: string;
  anthropic_model: string;
  openai_model: string;
  gemini_model: string;
  custom_api_url?: string;
  custom_api_model?: string;
  max_tokens: number;
  temperature: number;
  moltbot_configured: boolean;
  anthropic_configured: boolean;
  openai_configured: boolean;
  gemini_configured: boolean;
  custom_configured: boolean;
  moltbot_api_key_masked?: string;
  anthropic_api_key_masked?: string;
  openai_api_key_masked?: string;
  gemini_api_key_masked?: string;
  custom_api_key_masked?: string;
  updated_at?: string;
}

interface TestResult {
  provider: string;
  success: boolean;
  message: string;
  latency?: number;
}

interface AISettingsProps {
  projectId: string;
  projectName: string;
}

const AI_PROVIDERS = [
  {
    id: 'auto',
    name: 'Tự động (Auto)',
    description: 'Sử dụng provider có sẵn theo thứ tự ưu tiên',
    icon: '🤖',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local - FREE)',
    description: 'LLM chạy trên máy local, miễn phí hoàn toàn',
    icon: '🦙',
    free: true,
  },
  {
    id: 'moltbot',
    name: 'MoltBot',
    description: 'OpenAI-compatible API - Vietnamese optimized',
    icon: '🔮',
  },
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    description: 'Mạnh về phân tích và viết content dài',
    icon: '🧠',
  },
  {
    id: 'openai',
    name: 'GPT-4 (OpenAI)',
    description: 'Phổ biến nhất, đa năng',
    icon: '💚',
  },
  {
    id: 'gemini',
    name: 'Gemini (Google)',
    description: 'Nhanh, nhiều model miễn phí',
    icon: '💎',
    free: true,
  },
  {
    id: 'template',
    name: 'Template (No AI)',
    description: 'Không dùng AI, chỉ dùng template với dữ liệu crawl',
    icon: '📝',
  },
];

export function AISettings({ projectId, projectName }: AISettingsProps) {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for API keys (only store new values)
  const [formData, setFormData] = useState({
    ai_provider: 'auto',
    // Ollama (FREE - Local)
    ollama_api_url: 'http://localhost:11434/v1/chat/completions',
    ollama_model: 'gpt-oss:20b',
    ollama_enabled: true,
    // MoltBot
    moltbot_api_key: '',
    moltbot_api_url: 'https://api.moltbot.com/v1/chat/completions',
    moltbot_model: 'moltbot-pro',
    anthropic_api_key: '',
    anthropic_model: 'claude-3-haiku-20240307',
    openai_api_key: '',
    openai_model: 'gpt-4o-mini',
    gemini_api_key: '',
    gemini_model: 'gemini-2.0-flash',
    custom_api_key: '',
    custom_api_url: '',
    custom_api_model: '',
    max_tokens: 4000,
    temperature: 0.7,
    // Image Generation
    image_provider: 'huggingface',
    huggingface_api_key: '',
    huggingface_model: 'stabilityai/stable-diffusion-xl-base-1.0',
    stability_api_key: '',
    grok_api_key: '',
    // CrUX API
    crux_api_key: '',
  });

  // Show/hide API keys
  const [showKeys, setShowKeys] = useState({
    moltbot: false,
    anthropic: false,
    openai: false,
    gemini: false,
    custom: false,
    huggingface: false,
    stability: false,
    grok: false,
    crux: false,
  });

  useEffect(() => {
    loadConfig();
  }, [projectId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/projects/${projectId}/ai/config`);
      const data = await response.json();

      if (data.success) {
        setConfig(data.data);
        setFormData(prev => ({
          ...prev,
          ai_provider: data.data.ai_provider || 'auto',
          ollama_api_url: data.data.ollama_api_url || prev.ollama_api_url,
          ollama_model: data.data.ollama_model || prev.ollama_model,
          ollama_enabled: data.data.ollama_enabled !== false,
          moltbot_api_url: data.data.moltbot_api_url || prev.moltbot_api_url,
          moltbot_model: data.data.moltbot_model || prev.moltbot_model,
          anthropic_model: data.data.anthropic_model || prev.anthropic_model,
          openai_model: data.data.openai_model || prev.openai_model,
          gemini_model: data.data.gemini_model || prev.gemini_model,
          custom_api_url: data.data.custom_api_url || '',
          custom_api_model: data.data.custom_api_model || '',
          max_tokens: data.data.max_tokens || 4000,
          temperature: parseFloat(data.data.temperature) || 0.7,
          // Image Generation
          image_provider: data.data.image_provider || 'huggingface',
          huggingface_model: data.data.huggingface_model || prev.huggingface_model,
        }));
      }
    } catch (err) {
      setError('Failed to load AI configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Only send fields that have values
      const payload: Record<string, any> = {
        ai_provider: formData.ai_provider,
        // Ollama settings
        ollama_api_url: formData.ollama_api_url,
        ollama_model: formData.ollama_model,
        ollama_enabled: formData.ollama_enabled,
        // Other providers
        moltbot_api_url: formData.moltbot_api_url,
        moltbot_model: formData.moltbot_model,
        anthropic_model: formData.anthropic_model,
        openai_model: formData.openai_model,
        gemini_model: formData.gemini_model,
        max_tokens: formData.max_tokens,
        temperature: formData.temperature,
        // Image Generation
        image_provider: formData.image_provider,
        huggingface_model: formData.huggingface_model,
      };

      // Only include API keys if they're set (not empty)
      if (formData.moltbot_api_key) payload.moltbot_api_key = formData.moltbot_api_key;
      if (formData.anthropic_api_key) payload.anthropic_api_key = formData.anthropic_api_key;
      if (formData.openai_api_key) payload.openai_api_key = formData.openai_api_key;
      if (formData.gemini_api_key) payload.gemini_api_key = formData.gemini_api_key;
      if (formData.custom_api_key) payload.custom_api_key = formData.custom_api_key;
      if (formData.custom_api_url) payload.custom_api_url = formData.custom_api_url;
      if (formData.custom_api_model) payload.custom_api_model = formData.custom_api_model;
      // Image API keys
      if (formData.huggingface_api_key) payload.huggingface_api_key = formData.huggingface_api_key;
      if (formData.stability_api_key) payload.stability_api_key = formData.stability_api_key;
      if (formData.grok_api_key) payload.grok_api_key = formData.grok_api_key;
      // CrUX API key
      if (formData.crux_api_key) payload.crux_api_key = formData.crux_api_key;

      const response = await fetch(`${API_BASE}/projects/${projectId}/ai/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Cấu hình AI đã được lưu thành công!');
        // Clear API key inputs after save
        setFormData(prev => ({
          ...prev,
          moltbot_api_key: '',
          anthropic_api_key: '',
          openai_api_key: '',
          gemini_api_key: '',
          custom_api_key: '',
          huggingface_api_key: '',
          stability_api_key: '',
          grok_api_key: '',
          crux_api_key: '',
        }));
        // Reload config to get updated masked keys
        await loadConfig();
      } else {
        // Handle error - could be string or object {code, message}
        const errorMsg = typeof data.error === 'object' && data.error?.message 
          ? data.error.message 
          : (typeof data.error === 'string' ? data.error : 'Failed to save configuration');
        setError(errorMsg);
      }
    } catch (err) {
      setError('Failed to save AI configuration');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleTest = async (provider: 'moltbot' | 'anthropic' | 'openai' | 'gemini' | 'custom') => {
    try {
      setTesting(provider);
      setTestResult(null);

      const response = await fetch(`${API_BASE}/projects/${projectId}/ai/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          // Send new API key if provided, otherwise backend will use stored one
          api_key: formData[`${provider}_api_key` as keyof typeof formData] || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResult(data.data);
      } else {
        setTestResult({
          provider,
          success: false,
          message: data.error || 'Connection test failed',
        });
      }
    } catch (err) {
      setTestResult({
        provider,
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed',
      });
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading AI configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Bot className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Content Generation</h3>
            <p className="text-sm text-gray-500">
              Cấu hình AI provider cho project {projectName}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Success/Error Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-700">{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-green-700">{success}</span>
          </div>
        )}

        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Chọn AI Provider
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {AI_PROVIDERS.map(provider => (
              <button
                key={provider.id}
                onClick={() => setFormData(prev => ({ ...prev, ai_provider: provider.id }))}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  formData.ai_provider === provider.id
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{provider.icon}</span>
                  <span className="font-medium text-gray-900">{provider.name}</span>
                </div>
                <p className="text-xs text-gray-500">{provider.description}</p>
                {/* Show configured status */}
                {provider.id !== 'auto' && provider.id !== 'template' && config && (
                  <div className="mt-2">
                    {config[`${provider.id}_configured` as keyof AIConfig] ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <Check className="w-3 h-3" /> Đã cấu hình
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <X className="w-3 h-3" /> Chưa cấu hình
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* API Key Configuration */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <Key className="w-4 h-4" />
            API Keys Configuration
          </h4>
          <p className="text-sm text-gray-500">
            Nhập API key cho các provider bạn muốn sử dụng. Key sẽ được mã hóa và lưu trữ an toàn.
          </p>

          {/* Ollama - FREE Local LLM */}
          <div className="p-4 border-2 border-green-300 bg-green-50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🦙</span>
                <span className="font-medium">Ollama (Local LLM)</span>
                <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full font-medium">
                  FREE
                </span>
              </div>
              <button
                onClick={async () => {
                  setTesting('ollama');
                  try {
                    const res = await fetch('http://localhost:11434/api/tags');
                    const data = await res.json();
                    setTestResult({
                      provider: 'ollama',
                      success: true,
                      message: `Ollama đang chạy! Models: ${data.models?.map((m: any) => m.name).join(', ') || 'none'}`,
                    });
                  } catch {
                    setTestResult({
                      provider: 'ollama',
                      success: false,
                      message: 'Ollama server không chạy. Chạy lệnh: ollama serve',
                    });
                  }
                  setTesting(null);
                }}
                disabled={testing === 'ollama'}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-200 text-green-700 rounded-lg hover:bg-green-300 disabled:opacity-50"
              >
                {testing === 'ollama' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
                Test
              </button>
            </div>
            <p className="text-xs text-green-700">
              ✨ Chạy LLM trên máy local - Không cần API key, hoàn toàn miễn phí!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">API URL</label>
                <input
                  type="text"
                  value={formData.ollama_api_url}
                  onChange={e => setFormData(prev => ({ ...prev, ollama_api_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Model</label>
                <input
                  type="text"
                  value={formData.ollama_model}
                  onChange={e => setFormData(prev => ({ ...prev, ollama_model: e.target.value }))}
                  placeholder="gpt-oss:20b, llama3, mistral..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ollama_enabled"
                checked={formData.ollama_enabled}
                onChange={e => setFormData(prev => ({ ...prev, ollama_enabled: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="ollama_enabled" className="text-sm text-gray-700">
                Bật Ollama cho auto-detect (ưu tiên khi không có API key nào)
              </label>
            </div>
          </div>

          {/* MoltBot */}
          <div className="p-4 border border-gray-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔮</span>
                <span className="font-medium">MoltBot</span>
                {config?.moltbot_configured && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                    Configured: {config.moltbot_api_key_masked}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleTest('moltbot')}
                disabled={testing === 'moltbot' || (!config?.moltbot_configured && !formData.moltbot_api_key)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50"
              >
                {testing === 'moltbot' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
                Test
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">API Key</label>
                <div className="relative">
                  <input
                    type={showKeys.moltbot ? 'text' : 'password'}
                    value={formData.moltbot_api_key}
                    onChange={e => setFormData(prev => ({ ...prev, moltbot_api_key: e.target.value }))}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(prev => ({ ...prev, moltbot: !prev.moltbot }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showKeys.moltbot ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Model</label>
                <input
                  type="text"
                  value={formData.moltbot_model}
                  onChange={e => setFormData(prev => ({ ...prev, moltbot_model: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">API URL</label>
              <input
                type="text"
                value={formData.moltbot_api_url}
                onChange={e => setFormData(prev => ({ ...prev, moltbot_api_url: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* OpenAI */}
          <div className="p-4 border border-gray-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">💚</span>
                <span className="font-medium">OpenAI</span>
                {config?.openai_configured && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                    Configured: {config.openai_api_key_masked}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleTest('openai')}
                disabled={testing === 'openai' || (!config?.openai_configured && !formData.openai_api_key)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50"
              >
                {testing === 'openai' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
                Test
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">API Key</label>
                <div className="relative">
                  <input
                    type={showKeys.openai ? 'text' : 'password'}
                    value={formData.openai_api_key}
                    onChange={e => setFormData(prev => ({ ...prev, openai_api_key: e.target.value }))}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(prev => ({ ...prev, openai: !prev.openai }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Model</label>
                <select
                  value={formData.openai_model}
                  onChange={e => setFormData(prev => ({ ...prev, openai_model: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-4-turbo">gpt-4-turbo</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Anthropic */}
          <div className="p-4 border border-gray-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧠</span>
                <span className="font-medium">Anthropic Claude</span>
                {config?.anthropic_configured && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                    Configured: {config.anthropic_api_key_masked}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleTest('anthropic')}
                disabled={testing === 'anthropic' || (!config?.anthropic_configured && !formData.anthropic_api_key)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50"
              >
                {testing === 'anthropic' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
                Test
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">API Key</label>
                <div className="relative">
                  <input
                    type={showKeys.anthropic ? 'text' : 'password'}
                    value={formData.anthropic_api_key}
                    onChange={e => setFormData(prev => ({ ...prev, anthropic_api_key: e.target.value }))}
                    placeholder="sk-ant-..."
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(prev => ({ ...prev, anthropic: !prev.anthropic }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showKeys.anthropic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Model</label>
                <select
                  value={formData.anthropic_model}
                  onChange={e => setFormData(prev => ({ ...prev, anthropic_model: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="claude-3-haiku-20240307">claude-3-haiku (Fast)</option>
                  <option value="claude-3-sonnet-20240229">claude-3-sonnet (Balanced)</option>
                  <option value="claude-3-opus-20240229">claude-3-opus (Best)</option>
                  <option value="claude-3-5-sonnet-20241022">claude-3.5-sonnet (Latest)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Gemini */}
          <div className="p-4 border border-gray-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">💎</span>
                <span className="font-medium">Google Gemini</span>
                {config?.gemini_configured && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                    Configured: {config.gemini_api_key_masked}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleTest('gemini')}
                disabled={testing === 'gemini' || (!config?.gemini_configured && !formData.gemini_api_key)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
              >
                {testing === 'gemini' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
                Test
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">API Key</label>
                <div className="relative">
                  <input
                    type={showKeys.gemini ? 'text' : 'password'}
                    value={formData.gemini_api_key}
                    onChange={e => setFormData(prev => ({ ...prev, gemini_api_key: e.target.value }))}
                    placeholder="AIza..."
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(prev => ({ ...prev, gemini: !prev.gemini }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showKeys.gemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Model</label>
                <select
                  value={formData.gemini_model}
                  onChange={e => setFormData(prev => ({ ...prev, gemini_model: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <optgroup label="🆓 Free Models (Recommended)">
                    <option value="gemini-2.5-flash-preview-05-20">gemini-2.5-flash-preview (Latest, FREE)</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash (Stable, FREE)</option>
                    <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite (Fastest, FREE)</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash (Legacy, FREE)</option>
                  </optgroup>
                  <optgroup label="💎 Pro Models (Paid)">
                    <option value="gemini-2.5-pro-preview-05-06">gemini-2.5-pro-preview (Best Quality)</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (Standard)</option>
                  </optgroup>
                </select>
              </div>
            </div>
            <p className="text-xs text-green-600 bg-green-50 p-2 rounded mt-2">
              💡 <strong>Free Tier:</strong> gemini-2.0-flash hỗ trợ 15 RPM, 1M tokens/phút, 1500 requests/ngày miễn phí. 
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                Lấy API Key miễn phí tại đây →
              </a>
            </p>
          </div>
        </div>

        {/* Generation Settings */}
        <div className="p-4 border border-gray-200 rounded-lg space-y-3">
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Generation Settings
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max Tokens</label>
              <input
                type="number"
                value={formData.max_tokens}
                onChange={e => setFormData(prev => ({ ...prev, max_tokens: parseInt(e.target.value) || 4000 }))}
                min={1000}
                max={8000}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Temperature ({formData.temperature})</label>
              <input
                type="range"
                value={formData.temperature}
                onChange={e => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>
          </div>
        </div>

        {/* Image Generation Settings */}
        <div className="p-4 bg-pink-50 rounded-lg border border-pink-200">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            🖼️ Image Generation (AI Image)
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            Cấu hình API để tạo hình ảnh minh họa cho bài viết. <strong>Hugging Face & Gemini miễn phí!</strong>
          </p>
          
          {/* Image Provider Selection */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
            {[
              { id: 'huggingface', name: 'Hugging Face', emoji: '🤗', desc: 'Miễn phí' },
              { id: 'openai', name: 'DALL-E 3', emoji: '🎨', desc: 'Trả phí' },
              { id: 'gemini', name: 'Gemini', emoji: '💎', desc: 'Miễn phí' },
              { id: 'grok', name: 'Grok', emoji: '🚀', desc: 'xAI' },
              { id: 'stability', name: 'Stability', emoji: '🖌️', desc: 'Free tier' },
            ].map(provider => (
              <button
                key={provider.id}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, image_provider: provider.id }))}
                className={`p-2 rounded-lg border-2 text-center transition-all ${
                  formData.image_provider === provider.id
                    ? 'border-pink-500 bg-pink-100'
                    : 'border-gray-200 hover:border-pink-300'
                }`}
              >
                <span className="text-lg">{provider.emoji}</span>
                <p className="text-xs font-medium mt-1">{provider.name}</p>
                <p className="text-[10px] text-gray-500">{provider.desc}</p>
              </button>
            ))}
          </div>
          
          {/* Hugging Face Config */}
          {formData.image_provider === 'huggingface' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Hugging Face API Key <span className="text-pink-600">*</span>
                  <a 
                    href="https://huggingface.co/settings/tokens" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 hover:underline"
                  >
                    (Lấy key miễn phí)
                  </a>
                </label>
                <div className="relative">
                  <input
                    type={showKeys.huggingface ? 'text' : 'password'}
                    value={formData.huggingface_api_key}
                    onChange={e => setFormData(prev => ({ ...prev, huggingface_api_key: e.target.value }))}
                    placeholder="hf_xxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(prev => ({ ...prev, huggingface: !prev.huggingface }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showKeys.huggingface ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Model</label>
                <select
                  value={formData.huggingface_model}
                  onChange={e => setFormData(prev => ({ ...prev, huggingface_model: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="stabilityai/stable-diffusion-xl-base-1.0">Stable Diffusion XL (Recommended)</option>
                  <option value="runwayml/stable-diffusion-v1-5">Stable Diffusion v1.5</option>
                  <option value="CompVis/stable-diffusion-v1-4">Stable Diffusion v1.4</option>
                  <option value="prompthero/openjourney">OpenJourney (Midjourney style)</option>
                </select>
              </div>
            </div>
          )}
          
          {/* Stability AI Config */}
          {formData.image_provider === 'stability' && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Stability AI API Key
                <a 
                  href="https://platform.stability.ai/account/keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 text-blue-600 hover:underline"
                >
                  (Lấy key)
                </a>
              </label>
              <div className="relative">
                <input
                  type={showKeys.stability ? 'text' : 'password'}
                  value={formData.stability_api_key}
                  onChange={e => setFormData(prev => ({ ...prev, stability_api_key: e.target.value }))}
                  placeholder="sk-xxxxxxxx"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys(prev => ({ ...prev, stability: !prev.stability }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showKeys.stability ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
          
          {/* OpenAI/DALL-E uses existing openai_api_key */}
          {formData.image_provider === 'openai' && (
            <div className="p-3 bg-white rounded border space-y-2">
              <p className="text-sm text-gray-600">
                💡 DALL-E 3 sử dụng cùng <strong>OpenAI API key</strong> đã cấu hình ở trên.
              </p>
              <p className="text-xs text-gray-500">
                Model: dall-e-3 | Size: 1024x1024, 1792x1024, 1024x1792
              </p>
            </div>
          )}
          
          {/* Gemini Imagen uses existing gemini_api_key */}
          {formData.image_provider === 'gemini' && (
            <div className="p-3 bg-white rounded border space-y-2">
              <p className="text-sm text-gray-600">
                💎 Gemini Imagen sử dụng cùng <strong>Gemini API key</strong> đã cấu hình ở trên.
              </p>
              <p className="text-xs text-gray-500">
                Model: imagen-3.0-generate-001 | Miễn phí với quota hàng ngày
              </p>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                → Lấy Gemini API key miễn phí
              </a>
            </div>
          )}
          
          {/* Grok uses xAI API */}
          {formData.image_provider === 'grok' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  xAI (Grok) API Key
                  <a 
                    href="https://console.x.ai/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 hover:underline"
                  >
                    (Lấy key)
                  </a>
                </label>
                <div className="relative">
                  <input
                    type={showKeys.grok ? 'text' : 'password'}
                    value={formData.grok_api_key || ''}
                    onChange={e => setFormData(prev => ({ ...prev, grok_api_key: e.target.value }))}
                    placeholder="xai-xxxxxxxx"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(prev => ({ ...prev, grok: !prev.grok }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showKeys.grok ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Grok sử dụng Aurora model để tạo ảnh chất lượng cao
                </p>
              </div>
            </div>
          )}
        </div>

        {/* CrUX API Settings */}
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            📊 CrUX API (Chrome User Experience Report)
          </h3>
          <p className="text-sm text-gray-600">
            Lấy dữ liệu Core Web Vitals thực tế từ người dùng Chrome. Đây là field data thực tế, không phải lab data từ Lighthouse.
          </p>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                CrUX API Key
                <a 
                  href="https://developers.google.com/web/tools/chrome-user-experience-report/api/guides/getting-started" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 text-blue-600 hover:underline"
                >
                  (Hướng dẫn lấy key)
                </a>
              </label>
              <div className="relative">
                <input
                  type={showKeys.crux ? 'text' : 'password'}
                  value={formData.crux_api_key || ''}
                  onChange={e => setFormData(prev => ({ ...prev, crux_api_key: e.target.value }))}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys(prev => ({ ...prev, crux: !prev.crux }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showKeys.crux ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                CrUX API key là Google Cloud API key có enable PageSpeed Insights API hoặc CrUX API
              </p>
            </div>
            
            <div className="p-3 bg-white rounded border">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Cách lấy CrUX API Key:</h4>
              <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                <li>Truy cập <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
                <li>Tạo hoặc chọn project</li>
                <li>Enable "Chrome UX Report API" và "PageSpeed Insights API"</li>
                <li>Tạo API Key và copy vào đây</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`p-4 rounded-lg border ${
            testResult.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={`font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {testResult.provider.toUpperCase()} - {testResult.success ? 'Connection Successful' : 'Connection Failed'}
              </span>
            </div>
            <p className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.message}
            </p>
            {testResult.latency && (
              <p className="text-xs text-gray-500 mt-1">
                Response time: {testResult.latency}ms
              </p>
            )}
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
