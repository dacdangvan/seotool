/**
 * Content Component Exports
 * 
 * Central export for all content-related components:
 * - ContentBrief: Brief generation and display
 * - KeywordContentActions: Per-keyword action buttons
 * - ContentPlanningView: Integrated planning dashboard
 * 
 * Per AI_SEO_TOOL_PROMPT_BOOK.md Section 12 – Keyword Research ↔ Content Engine Integration
 */

// Content Brief components and types
export {
  ContentBriefCard,
  ContentTypeBadge,
  ContentModeBadge,
  BriefStatusBadge,
  CannibalizationBadge,
  IntentMatchIndicator,
  OutlinePreview,
  InternalLinksPreview,
  validateIntentMatch,
  getRecommendedContentTypes,
  CONTENT_TYPE_CONFIG,
  CONTENT_MODE_CONFIG,
  BRIEF_STATUS_CONFIG,
  CANNIBALIZATION_STATUS_CONFIG,
} from './ContentBrief';

export type {
  ContentType,
  ContentMode,
  BriefStatus,
  CannibalizationStatus,
  OutlineItem,
  InternalLinkSuggestion,
  ContentBrief,
  ContentTypeConfig,
} from './ContentBrief';

// Keyword Content Actions
export {
  KeywordContentActions,
  KeywordBulkActions,
  KeywordActionDropdown,
} from './KeywordContentActions';

export type {
  KeywordMappingAction,
  MappingSuggestion,
  KeywordWithMapping,
} from './KeywordContentActions';

// Content Planning View
export {
  ContentPlanningView,
} from './ContentPlanningView';

export type {
  PlanningViewTab,
  KeywordFilterOption,
  ContentPlanningStats,
} from './ContentPlanningView';
