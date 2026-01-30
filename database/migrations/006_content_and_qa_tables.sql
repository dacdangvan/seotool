-- Migration: 006_content_and_qa_tables.sql
-- Description: Tables for Content Management, QA Validation, CMS Export (Sections 15, 16, 17)
-- Version: 3.0 - Crawl-Centric Data Architecture

-- ============================================================================
-- SECTION 17: FULL PAGE CONTENT CAPTURE & NORMALIZATION
-- ============================================================================

-- Crawled Content (Normalized content from crawler)
CREATE TABLE IF NOT EXISTS crawled_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    crawl_job_id UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    
    -- Render metadata
    render_mode VARCHAR(20) NOT NULL DEFAULT 'html_only',
    language VARCHAR(10),
    
    -- Raw content (compressed, for debugging)
    raw_rendered_html TEXT,
    
    -- Normalized content (JSON structure for AI features)
    normalized_content JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Content structure
    title TEXT,
    headings JSONB DEFAULT '[]'::jsonb,
    sections JSONB DEFAULT '[]'::jsonb,
    paragraphs JSONB DEFAULT '[]'::jsonb,
    lists JSONB DEFAULT '[]'::jsonb,
    tables JSONB DEFAULT '[]'::jsonb,
    
    -- Media metadata
    images JSONB DEFAULT '[]'::jsonb,
    embedded_media JSONB DEFAULT '[]'::jsonb,
    
    -- Links
    internal_links JSONB DEFAULT '[]'::jsonb,
    external_links JSONB DEFAULT '[]'::jsonb,
    
    -- Structured data
    structured_data JSONB DEFAULT '[]'::jsonb,
    schema_types JSONB DEFAULT '[]'::jsonb,
    
    -- Metrics
    word_count INTEGER DEFAULT 0,
    reading_time_minutes INTEGER DEFAULT 0,
    
    -- Timestamps
    crawled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_render_mode CHECK (render_mode IN ('html_only', 'js_rendered')),
    CONSTRAINT unique_crawl_url UNIQUE (crawl_job_id, url)
);

-- ============================================================================
-- CONTENT BRIEFS (Section 13-14)
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Content mode
    content_mode VARCHAR(20) NOT NULL DEFAULT 'CREATE',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    
    -- Overview
    objective TEXT,
    target_audience TEXT,
    content_type VARCHAR(50),
    
    -- SEO Targeting
    primary_keyword TEXT NOT NULL,
    secondary_keywords JSONB DEFAULT '[]'::jsonb,
    related_entities JSONB DEFAULT '[]'::jsonb,
    search_intent VARCHAR(30),
    target_url TEXT,
    
    -- Competitive Context
    cannibalization_risk VARCHAR(10) DEFAULT 'LOW',
    differentiation_angle TEXT,
    
    -- Recommended Structure
    recommended_structure JSONB DEFAULT '{}'::jsonb,
    
    -- Internal Linking Plan
    internal_links_plan JSONB DEFAULT '[]'::jsonb,
    
    -- Content Requirements
    word_count_min INTEGER DEFAULT 800,
    word_count_max INTEGER DEFAULT 2000,
    reading_level VARCHAR(20),
    tone VARCHAR(30),
    formality VARCHAR(20),
    cta_style VARCHAR(30),
    
    -- SEO Constraints
    seo_constraints JSONB DEFAULT '{}'::jsonb,
    
    -- Risks
    risks JSONB DEFAULT '{}'::jsonb,
    
    -- Success Metrics
    success_metrics JSONB DEFAULT '{}'::jsonb,
    
    -- Approval tracking
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_content_mode CHECK (content_mode IN ('CREATE', 'OPTIMIZE', 'ASSIST')),
    CONSTRAINT valid_brief_status CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
    CONSTRAINT valid_search_intent CHECK (search_intent IN ('Informational', 'Commercial', 'Transactional', 'Navigational')),
    CONSTRAINT valid_cannibalization_risk CHECK (cannibalization_risk IN ('LOW', 'MEDIUM', 'HIGH'))
);

-- ============================================================================
-- GENERATED CONTENT (Section 14)
-- ============================================================================

CREATE TABLE IF NOT EXISTS generated_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    brief_id UUID NOT NULL REFERENCES content_briefs(id) ON DELETE CASCADE,
    
    -- Content
    title TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    content_html TEXT,
    
    -- SEO metadata
    meta_title TEXT,
    meta_description TEXT,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    version INTEGER DEFAULT 1,
    
    -- Generation metadata
    generated_by VARCHAR(50) DEFAULT 'ai',
    model_used VARCHAR(100),
    generation_params JSONB DEFAULT '{}'::jsonb,
    
    -- Word count and metrics
    word_count INTEGER DEFAULT 0,
    reading_time_minutes INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_content_status CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED'))
);

-- ============================================================================
-- SECTION 16: CONTENT QA VALIDATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_qa_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES generated_content(id) ON DELETE CASCADE,
    brief_id UUID NOT NULL REFERENCES content_briefs(id) ON DELETE CASCADE,
    
    -- Overall status
    qa_status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    overall_score DECIMAL(5,2) DEFAULT 0,
    
    -- Layer results (5 layers as per Section 16)
    structure_status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    structure_score DECIMAL(5,2) DEFAULT 0,
    structure_issues JSONB DEFAULT '[]'::jsonb,
    
    seo_status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    seo_score DECIMAL(5,2) DEFAULT 0,
    seo_issues JSONB DEFAULT '[]'::jsonb,
    
    intent_status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    intent_score DECIMAL(5,2) DEFAULT 0,
    intent_issues JSONB DEFAULT '[]'::jsonb,
    
    brand_status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    brand_score DECIMAL(5,2) DEFAULT 0,
    brand_issues JSONB DEFAULT '[]'::jsonb,
    
    technical_status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    technical_score DECIMAL(5,2) DEFAULT 0,
    technical_issues JSONB DEFAULT '[]'::jsonb,
    
    -- All issues combined
    all_issues JSONB DEFAULT '[]'::jsonb,
    
    -- Blocking issues count
    blocking_issues_count INTEGER DEFAULT 0,
    warning_issues_count INTEGER DEFAULT 0,
    info_issues_count INTEGER DEFAULT 0,
    
    -- Timestamps
    validated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_qa_status CHECK (qa_status IN ('PENDING', 'PASS', 'WARN', 'FAIL')),
    CONSTRAINT valid_structure_status CHECK (structure_status IN ('PENDING', 'PASS', 'WARN', 'FAIL')),
    CONSTRAINT valid_seo_status CHECK (seo_status IN ('PENDING', 'PASS', 'WARN', 'FAIL')),
    CONSTRAINT valid_intent_status CHECK (intent_status IN ('PENDING', 'PASS', 'WARN', 'FAIL')),
    CONSTRAINT valid_brand_status CHECK (brand_status IN ('PENDING', 'PASS', 'WARN', 'FAIL')),
    CONSTRAINT valid_technical_status CHECK (technical_status IN ('PENDING', 'PASS', 'WARN', 'FAIL'))
);

-- ============================================================================
-- SECTION 15: CMS EXPORT
-- ============================================================================

CREATE TABLE IF NOT EXISTS cms_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES generated_content(id) ON DELETE CASCADE,
    brief_id UUID NOT NULL REFERENCES content_briefs(id) ON DELETE CASCADE,
    qa_result_id UUID NOT NULL REFERENCES content_qa_results(id) ON DELETE CASCADE,
    
    -- Export configuration
    cms_type VARCHAR(50) NOT NULL,
    cms_config JSONB DEFAULT '{}'::jsonb,
    
    -- Export status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    
    -- Export package (the actual payload)
    export_package JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- CMS response
    cms_response JSONB,
    cms_content_id TEXT,
    cms_url TEXT,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    exported_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_cms_type CHECK (cms_type IN ('wordpress', 'strapi', 'contentful', 'sanity', 'custom')),
    CONSTRAINT valid_export_status CHECK (status IN ('PENDING', 'VALIDATING', 'EXPORTING', 'SUCCESS', 'FAILED', 'BLOCKED'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Crawled Content indexes
CREATE INDEX IF NOT EXISTS idx_crawled_content_project_id ON crawled_content(project_id);
CREATE INDEX IF NOT EXISTS idx_crawled_content_crawl_job_id ON crawled_content(crawl_job_id);
CREATE INDEX IF NOT EXISTS idx_crawled_content_url ON crawled_content(url);
CREATE INDEX IF NOT EXISTS idx_crawled_content_render_mode ON crawled_content(render_mode);
CREATE INDEX IF NOT EXISTS idx_crawled_content_normalized ON crawled_content USING GIN (normalized_content);

-- Content Briefs indexes
CREATE INDEX IF NOT EXISTS idx_content_briefs_project_id ON content_briefs(project_id);
CREATE INDEX IF NOT EXISTS idx_content_briefs_status ON content_briefs(status);
CREATE INDEX IF NOT EXISTS idx_content_briefs_primary_keyword ON content_briefs(primary_keyword);
CREATE INDEX IF NOT EXISTS idx_content_briefs_search_intent ON content_briefs(search_intent);
CREATE INDEX IF NOT EXISTS idx_content_briefs_target_url ON content_briefs(target_url);

-- Generated Content indexes
CREATE INDEX IF NOT EXISTS idx_generated_content_project_id ON generated_content(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_brief_id ON generated_content(brief_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_status ON generated_content(status);

-- QA Results indexes
CREATE INDEX IF NOT EXISTS idx_content_qa_project_id ON content_qa_results(project_id);
CREATE INDEX IF NOT EXISTS idx_content_qa_content_id ON content_qa_results(content_id);
CREATE INDEX IF NOT EXISTS idx_content_qa_brief_id ON content_qa_results(brief_id);
CREATE INDEX IF NOT EXISTS idx_content_qa_status ON content_qa_results(qa_status);

-- CMS Exports indexes
CREATE INDEX IF NOT EXISTS idx_cms_exports_project_id ON cms_exports(project_id);
CREATE INDEX IF NOT EXISTS idx_cms_exports_content_id ON cms_exports(content_id);
CREATE INDEX IF NOT EXISTS idx_cms_exports_status ON cms_exports(status);
CREATE INDEX IF NOT EXISTS idx_cms_exports_cms_type ON cms_exports(cms_type);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE crawled_content IS 'Section 17: Full page content capture with normalized content for AI features';
COMMENT ON TABLE content_briefs IS 'Section 13: Content briefs - single source of truth for content generation';
COMMENT ON TABLE generated_content IS 'Section 14: AI-generated content from approved briefs';
COMMENT ON TABLE content_qa_results IS 'Section 16: 5-layer QA validation results';
COMMENT ON TABLE cms_exports IS 'Section 15: CMS export packages and tracking';

COMMENT ON COLUMN crawled_content.raw_rendered_html IS 'Full DOM snapshot for debugging, NOT for AI features';
COMMENT ON COLUMN crawled_content.normalized_content IS 'Clean structured content for AI features';
COMMENT ON COLUMN content_qa_results.blocking_issues_count IS 'Count of issues that block export';
COMMENT ON COLUMN cms_exports.export_package IS 'Complete payload ready for CMS API';
