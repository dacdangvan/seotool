/**
 * Core Web Vitals (CWV) Module
 * 
 * Exports all CWV-related functionality
 */

// Types
export {
  CWVStatus,
  DeviceProfile,
  MetricData,
  CoreWebVitals,
  CWVResult,
  CWVConfig,
  DEFAULT_CWV_CONFIG,
  CWV_THRESHOLDS,
  getCWVStatus,
  calculateOverallStatus,
} from './cwv_types';

// Lighthouse Adapter
export {
  LighthouseAdapter,
  LighthouseResult,
  LighthouseAudit,
} from './lighthouse_adapter';

// Vitals Extractor
export {
  extractVitals,
  getOverallStatus,
  formatVitalsForDisplay,
  getStatusColor,
  passesAssessment,
  getSuggestions,
} from './vitals_extractor';

// CWV Runner
export {
  CWVRunner,
  CWVPageCandidate,
  CWVRunProgress,
  CWVRunnerCallbacks,
  selectRepresentativePages,
} from './cwv_runner';

// Repository
export {
  CWVRepository,
  CWVSummary,
  CWVQueryOptions,
} from './vitals_repository';
