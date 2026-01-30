'use client';

/**
 * GSC (Google Search Console) Integration Settings Component
 * 
 * Allows users to configure GSC integration for a project
 */

import { useState, useEffect } from 'react';
import {
  Settings,
  Link2,
  RefreshCw,
  Check,
  AlertCircle,
  Upload,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
  Search,
  TrendingUp,
  Globe,
} from 'lucide-react';

interface GSCConfig {
  propertyUrl: string | null;
  hasCredentials: boolean;
  serviceAccountEmail: string | null;
  lastSyncAt: string | null;
  syncEnabled: boolean;
}

interface GSCSyncStatus {
  configured: boolean;
  propertyUrl: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  dataRange: {
    from: string | null;
    to: string | null;
    totalDays: number;
  };
  totals: {
    clicks: number;
    impressions: number;
    avgCtr: number;
    avgPosition: number;
    uniqueQueries: number;
    uniquePages: number;
  };
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    position: string;
  }>;
}

interface GSCSettingsProps {
  projectId: string;
  projectName: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function GSCSettings({ projectId, projectName }: GSCSettingsProps) {
  const [config, setConfig] = useState<GSCConfig | null>(null);
  const [status, setStatus] = useState<GSCSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [propertyUrl, setPropertyUrl] = useState('');
  const [serviceAccountKey, setServiceAccountKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncDays, setSyncDays] = useState(30);

  // Load config
  useEffect(() => {
    loadConfig();
    loadStatus();
  }, [projectId]);

  const loadConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/gsc/config`);
      const data = await response.json();
      if (data.success) {
        setConfig(data.data);
        setPropertyUrl(data.data.propertyUrl || '');
        setSyncEnabled(data.data.syncEnabled || false);
      }
    } catch (err) {
      console.error('Failed to load GSC config:', err);
    }
  };

  const loadStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/gsc/status`);
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to load GSC status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      // Parse service account key if provided
      let parsedKey = null;
      if (serviceAccountKey) {
        try {
          parsedKey = JSON.parse(serviceAccountKey);
          if (!parsedKey.client_email || !parsedKey.private_key) {
            throw new Error('Invalid key format');
          }
        } catch {
          setError('Invalid service account key JSON. Please paste the entire contents of the JSON key file.');
          setSaving(false);
          return;
        }
      }

      const body: Record<string, unknown> = {};
      if (propertyUrl) body.propertyUrl = propertyUrl;
      if (parsedKey) body.serviceAccountKey = parsedKey;
      body.syncEnabled = syncEnabled;

      const response = await fetch(`${API_BASE}/projects/${projectId}/gsc/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('GSC configuration saved successfully!');
        setServiceAccountKey(''); // Clear sensitive data
        loadConfig();
        loadStatus();
      } else {
        setError(data.error?.message || 'Failed to save configuration');
      }
    } catch (err) {
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setError(null);
    setSuccess(null);
    setSyncing(true);

    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/gsc/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: syncDays }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message || 'Sync started successfully!');
        // Poll status after a delay
        setTimeout(() => {
          loadStatus();
        }, 5000);
      } else {
        setError(data.error?.message || 'Failed to start sync');
      }
    } catch (err) {
      setError('Failed to start sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setServiceAccountKey(content);
      };
      reader.readAsText(file);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600">Loading GSC configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-lg">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <Search className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Google Search Console Integration
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              Kết nối GSC để lấy dữ liệu search performance: clicks, impressions, CTR, positions
            </p>
            <a
              href="https://search.google.com/search-console"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 text-sm mt-2"
            >
              Mở Google Search Console
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {status?.configured && (
            <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
              Đã kết nối
            </span>
          )}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      {/* Configuration Form */}
      <div className="p-6 bg-white border border-gray-200 rounded-lg space-y-6">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Cấu hình GSC
        </h4>

        {/* Property URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            GSC Property URL
          </label>
          <input
            type="text"
            value={propertyUrl}
            onChange={(e) => setPropertyUrl(e.target.value)}
            placeholder="https://www.example.com/ hoặc sc-domain:example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            URL property từ GSC. Sử dụng format URL prefix hoặc Domain property (sc-domain:)
          </p>
        </div>

        {/* Service Account Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Service Account Credentials
          </label>
          
          {/* Current status */}
          {config?.hasCredentials && (
            <div className="mb-3 flex items-center gap-2 text-sm text-green-600">
              <Check className="w-4 h-4" />
              Đã có credentials ({config.serviceAccountEmail})
            </div>
          )}

          {/* File upload */}
          <div className="flex items-center gap-4 mb-3">
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              <span className="text-sm">Upload JSON key</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <span className="text-gray-400 text-sm">hoặc</span>
          </div>

          {/* Paste JSON */}
          <div className="relative">
            <textarea
              value={serviceAccountKey}
              onChange={(e) => setServiceAccountKey(e.target.value)}
              placeholder='Paste nội dung file JSON key tại đây...&#10;{&#10;  "type": "service_account",&#10;  "project_id": "...",&#10;  "client_email": "...",&#10;  ...&#10;}'
              rows={6}
              className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm ${
                !showKey && serviceAccountKey ? 'text-transparent' : ''
              }`}
              style={!showKey && serviceAccountKey ? { 
                background: 'repeating-linear-gradient(0deg, #e5e7eb, #e5e7eb 1px, transparent 1px, transparent 2px)'
              } : {}}
            />
            {serviceAccountKey && (
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Service Account cần có quyền Viewer trong GSC property
          </p>
        </div>

        {/* Auto-sync Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium text-gray-900">Tự động đồng bộ</p>
            <p className="text-sm text-gray-500">Sync dữ liệu GSC hàng ngày</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !propertyUrl}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Lưu cấu hình
            </>
          )}
        </button>
      </div>

      {/* Manual Sync */}
      {status?.configured && (
        <div className="p-6 bg-white border border-gray-200 rounded-lg space-y-4">
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Đồng bộ dữ liệu
          </h4>

          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Số ngày</label>
              <select
                value={syncDays}
                onChange={(e) => setSyncDays(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value={7}>7 ngày</option>
                <option value={30}>30 ngày</option>
                <option value={90}>90 ngày</option>
                <option value={180}>6 tháng</option>
              </select>
            </div>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
            >
              {syncing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang sync...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sync ngay
                </>
              )}
            </button>
          </div>

          {status.lastSyncAt && (
            <p className="text-sm text-gray-500">
              Lần sync cuối: {new Date(status.lastSyncAt).toLocaleString('vi-VN')}
            </p>
          )}
        </div>
      )}

      {/* Data Summary */}
      {status?.configured && status.totals && (
        <div className="p-6 bg-white border border-gray-200 rounded-lg space-y-4">
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Tổng quan dữ liệu
          </h4>

          {status.dataRange.totalDays > 0 ? (
            <>
              <p className="text-sm text-gray-500">
                Dữ liệu từ {new Date(status.dataRange.from!).toLocaleDateString('vi-VN')} đến{' '}
                {new Date(status.dataRange.to!).toLocaleDateString('vi-VN')} ({status.dataRange.totalDays} ngày)
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {status.totals.clicks.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">Total Clicks</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {status.totals.impressions.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">Impressions</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    {(status.totals.avgCtr * 100).toFixed(2)}%
                  </p>
                  <p className="text-sm text-gray-600">Avg CTR</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {status.totals.avgPosition.toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-600">Avg Position</p>
                </div>
                <div className="p-4 bg-teal-50 rounded-lg">
                  <p className="text-2xl font-bold text-teal-600">
                    {status.totals.uniqueQueries.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">Unique Queries</p>
                </div>
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <p className="text-2xl font-bold text-indigo-600">
                    {status.totals.uniquePages.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">Unique Pages</p>
                </div>
              </div>

              {/* Top Queries */}
              {status.topQueries && status.topQueries.length > 0 && (
                <div className="mt-6">
                  <h5 className="font-medium text-gray-700 mb-3">Top Queries</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Query</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">Clicks</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">Impressions</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {status.topQueries.map((q, idx) => (
                          <tr key={idx} className="border-t border-gray-100">
                            <td className="px-4 py-2 font-medium text-gray-900">{q.query}</td>
                            <td className="px-4 py-2 text-right text-gray-600">{q.clicks.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-gray-600">{q.impressions.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-gray-600">{q.position}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Chưa có dữ liệu. Hãy bấm &quot;Sync ngay&quot; để lấy dữ liệu từ GSC.</p>
            </div>
          )}
        </div>
      )}

      {/* Help Section */}
      <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
          <div className="text-sm text-teal-700">
            <p className="font-medium mb-2">Hướng dẫn setup:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Tạo Service Account tại Google Cloud Console</li>
              <li>Download JSON key file cho service account</li>
              <li>Trong GSC, vào Settings → Users and permissions</li>
              <li>Add service account email với quyền &quot;Full&quot; hoặc &quot;Restricted&quot;</li>
              <li>Paste Property URL và JSON key vào form trên</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
