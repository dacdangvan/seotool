'use client';

/**
 * CMS Export Dialog Component
 * Section 15: Export Content to CMS
 */

import React, { useState } from 'react';
import {
  CMSExport,
  CMSType,
  ContentQAResult,
} from '@/types/content.types';
import {
  CheckCircle,
  XCircle,
  Upload,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Shield,
  FileCheck,
  Rocket,
} from 'lucide-react';

interface CMSConfig {
  type: CMSType;
  baseUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  briefApproved: boolean;
  contentApproved: boolean;
  qaResult: ContentQAResult | null;
  contentId: string;
  projectId: string;
  onExport: (cmsType: CMSType, config: CMSConfig) => Promise<CMSExport>;
}

// Gate check component
function GateCheck({
  label,
  passed,
  description,
}: {
  label: string;
  passed: boolean;
  description: string;
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${passed ? 'bg-green-50' : 'bg-red-50'}`}>
      {passed ? (
        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
      ) : (
        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      )}
      <div>
        <p className={`font-medium ${passed ? 'text-green-700' : 'text-red-700'}`}>
          {label}
        </p>
        <p className={`text-sm ${passed ? 'text-green-600' : 'text-red-600'}`}>
          {description}
        </p>
      </div>
    </div>
  );
}

// CMS selector component
function CMSSelector({
  selected,
  onSelect,
}: {
  selected: CMSType | null;
  onSelect: (type: CMSType) => void;
}) {
  const options: { type: CMSType; name: string; logo: string }[] = [
    { type: 'wordpress', name: 'WordPress', logo: '🔷' },
    { type: 'strapi', name: 'Strapi', logo: '🚀' },
    { type: 'contentful', name: 'Contentful', logo: '📦' },
    { type: 'custom', name: 'Custom API', logo: '⚙️' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => (
        <button
          key={opt.type}
          onClick={() => onSelect(opt.type)}
          className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
            selected === opt.type
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <span className="text-2xl">{opt.logo}</span>
          <span className="font-medium">{opt.name}</span>
        </button>
      ))}
    </div>
  );
}

// Config form component
function CMSConfigForm({
  cmsType,
  config,
  onChange,
}: {
  cmsType: CMSType;
  config: CMSConfig;
  onChange: (config: CMSConfig) => void;
}) {
  const updateField = (field: keyof CMSConfig, value: string) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Base URL *
        </label>
        <input
          type="url"
          value={config.baseUrl}
          onChange={(e) => updateField('baseUrl', e.target.value)}
          placeholder={
            cmsType === 'wordpress'
              ? 'https://your-site.com/wp-json/wp/v2'
              : cmsType === 'strapi'
              ? 'https://your-strapi.com/api'
              : cmsType === 'contentful'
              ? 'https://api.contentful.com'
              : 'https://your-api.com'
          }
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {cmsType === 'wordpress' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={config.username || ''}
              onChange={(e) => updateField('username', e.target.value)}
              placeholder="admin"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Application Password
            </label>
            <input
              type="password"
              value={config.password || ''}
              onChange={(e) => updateField('password', e.target.value)}
              placeholder="xxxx xxxx xxxx xxxx"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </>
      )}

      {(cmsType === 'strapi' || cmsType === 'contentful' || cmsType === 'custom') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key / Token *
          </label>
          <input
            type="password"
            value={config.apiKey || ''}
            onChange={(e) => updateField('apiKey', e.target.value)}
            placeholder="Enter API key"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}

// Export result component
function ExportResult({ result }: { result: CMSExport }) {
  const isSuccess = result.status === 'SUCCESS';

  return (
    <div className={`p-6 rounded-lg ${isSuccess ? 'bg-green-50' : 'bg-red-50'}`}>
      <div className="flex items-center gap-3 mb-4">
        {isSuccess ? (
          <CheckCircle className="w-8 h-8 text-green-500" />
        ) : (
          <XCircle className="w-8 h-8 text-red-500" />
        )}
        <div>
          <h3 className={`font-bold text-lg ${isSuccess ? 'text-green-700' : 'text-red-700'}`}>
            {isSuccess ? 'Export Successful!' : 'Export Failed'}
          </h3>
          <p className={`text-sm ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>
            {result.cms_type.charAt(0).toUpperCase() + result.cms_type.slice(1)}
          </p>
        </div>
      </div>

      {isSuccess && result.cms_url && (
        <a
          href={result.cms_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          View in CMS
        </a>
      )}

      {!isSuccess && result.error_message && (
        <div className="mt-4 p-3 bg-red-100 rounded text-red-700 text-sm">
          <strong>Error:</strong> {result.error_message}
        </div>
      )}

      {result.cms_content_id && (
        <p className="mt-4 text-sm text-gray-600">
          CMS Content ID: <code className="bg-gray-200 px-1 rounded">{result.cms_content_id}</code>
        </p>
      )}
    </div>
  );
}

// Main dialog component
export function CMSExportDialog({
  isOpen,
  onClose,
  briefApproved,
  contentApproved,
  qaResult,
  contentId,
  projectId,
  onExport,
}: ExportDialogProps) {
  const [step, setStep] = useState<'gates' | 'select' | 'config' | 'exporting' | 'result'>('gates');
  const [selectedCMS, setSelectedCMS] = useState<CMSType | null>(null);
  const [config, setConfig] = useState<CMSConfig>({
    type: 'wordpress',
    baseUrl: '',
  });
  const [exportResult, setExportResult] = useState<CMSExport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qaPassed = qaResult?.qa_status !== 'FAIL' && (qaResult?.blocking_issues_count || 0) === 0;
  const allGatesPassed = briefApproved && contentApproved && qaPassed;

  const handleCMSSelect = (type: CMSType) => {
    setSelectedCMS(type);
    setConfig({ ...config, type });
    setStep('config');
  };

  const handleExport = async () => {
    if (!selectedCMS) return;
    
    setStep('exporting');
    setError(null);
    
    try {
      const result = await onExport(selectedCMS, config);
      setExportResult(result);
      setStep('result');
    } catch (err: any) {
      setError(err.message || 'Export failed');
      setStep('config');
    }
  };

  const handleClose = () => {
    setStep('gates');
    setSelectedCMS(null);
    setConfig({ type: 'wordpress', baseUrl: '' });
    setExportResult(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-xl">
          <div className="flex items-center gap-3">
            <Upload className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Export to CMS</h2>
              <p className="text-purple-100 text-sm">Section 15: CMS Integration</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step: Gate Checks */}
          {step === 'gates' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-gray-500" />
                <h3 className="font-semibold">Export Gate Validation</h3>
              </div>
              
              <GateCheck
                label="Gate 1: Brief Approved"
                passed={briefApproved}
                description={briefApproved ? 'Content brief has been approved' : 'Content brief must be approved first'}
              />
              
              <GateCheck
                label="Gate 2: Content Approved"
                passed={contentApproved}
                description={contentApproved ? 'Generated content has been approved' : 'Generated content must be approved first'}
              />
              
              <GateCheck
                label="Gate 3: QA Passed"
                passed={qaPassed}
                description={
                  qaPassed
                    ? `QA score: ${qaResult?.overall_score?.toFixed(0) || 'N/A'}/100`
                    : 'Content must pass QA validation with no blocking issues'
                }
              />

              {!allGatesPassed && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg text-yellow-700">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm">All gates must pass before export</span>
                </div>
              )}
            </div>
          )}

          {/* Step: CMS Selection */}
          {step === 'select' && (
            <div>
              <h3 className="font-semibold mb-4">Select CMS Platform</h3>
              <CMSSelector selected={selectedCMS} onSelect={handleCMSSelect} />
            </div>
          )}

          {/* Step: Configuration */}
          {step === 'config' && selectedCMS && (
            <div>
              <h3 className="font-semibold mb-4">Configure {selectedCMS.charAt(0).toUpperCase() + selectedCMS.slice(1)}</h3>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <CMSConfigForm
                cmsType={selectedCMS}
                config={config}
                onChange={setConfig}
              />
            </div>
          )}

          {/* Step: Exporting */}
          {step === 'exporting' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-600 font-medium">Exporting to {selectedCMS}...</p>
              <p className="text-gray-400 text-sm mt-1">This may take a moment</p>
            </div>
          )}

          {/* Step: Result */}
          {step === 'result' && exportResult && (
            <ExportResult result={exportResult} />
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-between">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            {step === 'result' ? 'Close' : 'Cancel'}
          </button>

          {step === 'gates' && (
            <button
              onClick={() => setStep('select')}
              disabled={!allGatesPassed}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                allGatesPassed
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              Continue to Export
            </button>
          )}

          {step === 'select' && (
            <button
              onClick={() => setStep('gates')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Back
            </button>
          )}

          {step === 'config' && (
            <div className="flex gap-2">
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Back
              </button>
              <button
                onClick={handleExport}
                disabled={!config.baseUrl}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  config.baseUrl
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Rocket className="w-4 h-4" />
                Export Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CMSExportDialog;
