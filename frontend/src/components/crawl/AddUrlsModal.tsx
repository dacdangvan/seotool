/**
 * AddUrlsModal Component
 * 
 * Modal dialog for adding URLs to the crawl queue
 * Supports both single and bulk URL addition
 * 
 * @version 1.0
 * @section 11.8 - URL Inventory Enhancement
 */

'use client';

import { useState, useCallback } from 'react';
import {
  X,
  Plus,
  Upload,
  AlertCircle,
  CheckCircle,
  Loader2,
  Link as LinkIcon,
  FileText,
  Info,
} from 'lucide-react';

interface AddUrlsResult {
  added: Array<{ url: string; state: string }>;
  skipped: Array<{ url: string; reason: string }>;
  invalid: Array<{ url: string; reason: string }>;
  summary: {
    total: number;
    added: number;
    skipped: number;
    invalid: number;
  };
}

interface AddUrlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectDomain: string;
  onSuccess?: (result: AddUrlsResult) => void;
}

type InputMode = 'single' | 'bulk';

export function AddUrlsModal({
  isOpen,
  onClose,
  projectId,
  projectDomain,
  onSuccess,
}: AddUrlsModalProps) {
  const [inputMode, setInputMode] = useState<InputMode>('single');
  const [singleUrl, setSingleUrl] = useState('');
  const [bulkUrls, setBulkUrls] = useState('');
  const [priority, setPriority] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AddUrlsResult | null>(null);

  // Parse domain from project base URL
  const baseDomain = projectDomain
    ? new URL(projectDomain.startsWith('http') ? projectDomain : `https://${projectDomain}`).hostname
    : '';

  const resetForm = useCallback(() => {
    setSingleUrl('');
    setBulkUrls('');
    setPriority(5);
    setError(null);
    setResult(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const parseUrls = useCallback((): string[] => {
    if (inputMode === 'single') {
      return singleUrl.trim() ? [singleUrl.trim()] : [];
    }
    
    // Parse bulk URLs - split by newlines, commas, or spaces
    return bulkUrls
      .split(/[\n,]+/)
      .map(url => url.trim())
      .filter(url => url.length > 0);
  }, [inputMode, singleUrl, bulkUrls]);

  const handleSubmit = async () => {
    setError(null);
    setResult(null);

    const urls = parseUrls();
    
    if (urls.length === 0) {
      setError('Please enter at least one URL');
      return;
    }

    if (urls.length > 100) {
      setError('Maximum 100 URLs allowed per request');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/projects/${projectId}/crawl/urls`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            urls,
            priority,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add URLs');
      }

      setResult(data.data);
      
      if (onSuccess) {
        onSuccess(data.data);
      }

      // If all URLs were added successfully, close after 2 seconds
      if (data.data.summary.added > 0 && data.data.summary.invalid === 0) {
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const urlCount = parseUrls().length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg transform rounded-lg bg-white shadow-xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Plus className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Add URLs to Crawl
                </h3>
                <p className="text-sm text-gray-500">
                  Add new pages from <span className="font-medium">{baseDomain}</span>
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {/* Result message */}
            {result && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">
                    {result.summary.added} URL{result.summary.added !== 1 ? 's' : ''} added successfully
                  </span>
                </div>
                {result.summary.skipped > 0 && (
                  <p className="mt-1 text-sm text-green-700">
                    {result.summary.skipped} already in queue (skipped)
                  </p>
                )}
                {result.summary.invalid > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-red-700">
                      {result.summary.invalid} invalid URL{result.summary.invalid !== 1 ? 's' : ''}:
                    </p>
                    <ul className="mt-1 max-h-24 overflow-y-auto text-sm text-red-600">
                      {result.invalid.map((item, i) => (
                        <li key={i} className="truncate">
                          {item.url} - {item.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* Input mode tabs */}
            <div className="mb-4 flex gap-2 rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setInputMode('single')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  inputMode === 'single'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LinkIcon className="h-4 w-4" />
                Single URL
              </button>
              <button
                type="button"
                onClick={() => setInputMode('bulk')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  inputMode === 'bulk'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="h-4 w-4" />
                Bulk Add
              </button>
            </div>

            {/* Single URL input */}
            {inputMode === 'single' && (
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  URL
                </label>
                <input
                  type="text"
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                  placeholder={`/path/to/page or https://${baseDomain}/path`}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Enter a relative path (e.g., /products) or full URL
                </p>
              </div>
            )}

            {/* Bulk URL input */}
            {inputMode === 'bulk' && (
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  URLs (one per line)
                </label>
                <textarea
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  placeholder={`/page-1\n/page-2\nhttps://${baseDomain}/page-3`}
                  rows={6}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500">
                  <span>Enter URLs separated by new lines</span>
                  <span className={urlCount > 100 ? 'text-red-600 font-medium' : ''}>
                    {urlCount} / 100 URLs
                  </span>
                </div>
              </div>
            )}

            {/* Priority selector */}
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Priority
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
                  disabled={isLoading}
                />
                <span className="min-w-[2rem] text-center text-sm font-medium text-gray-700">
                  {priority}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Higher priority URLs will be crawled first (1 = lowest, 10 = highest)
              </p>
            </div>

            {/* Info box */}
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3">
              <Info className="h-4 w-4 flex-shrink-0 text-blue-600 mt-0.5" />
              <div className="text-xs text-blue-700">
                <p className="font-medium">URL Requirements:</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  <li>URLs must belong to <span className="font-medium">{baseDomain}</span></li>
                  <li>Relative paths will be automatically prefixed</li>
                  <li>Duplicate URLs will be skipped</li>
                  <li>Maximum 100 URLs per request</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || urlCount === 0}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Add {urlCount > 0 ? `${urlCount} URL${urlCount !== 1 ? 's' : ''}` : 'URLs'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddUrlsModal;
