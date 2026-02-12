-- Migration 010: Integrations and Social Media Tables
-- Created: 2026-02-12
-- Description: Add GA4, GSC, Facebook integration columns to projects table
--              and create social_media_accounts table

-- ============================================================================
-- 1. ADD INTEGRATION COLUMNS TO PROJECTS TABLE
-- ============================================================================

-- GA4 Integration columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ga4_property_id VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ga4_credentials JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ga4_last_sync_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ga4_sync_enabled BOOLEAN DEFAULT false;

-- GSC Integration columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gsc_property_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gsc_site_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gsc_credentials JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gsc_last_sync_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gsc_sync_enabled BOOLEAN DEFAULT false;

-- Facebook Integration columns (quick access)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS facebook_page_id VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS facebook_access_token TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS facebook_sync_enabled BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS facebook_last_sync_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- 2. CREATE SOCIAL MEDIA ACCOUNTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS social_media_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    account_id VARCHAR(255),
    account_name VARCHAR(255),
    account_type VARCHAR(50) DEFAULT 'page',
    page_id VARCHAR(255),
    page_name VARCHAR(255),
    profile_url TEXT,
    avatar_url TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, platform, account_id)
);

-- Indexes for social_media_accounts
CREATE INDEX IF NOT EXISTS idx_social_media_accounts_project ON social_media_accounts(project_id);
CREATE INDEX IF NOT EXISTS idx_social_media_accounts_platform ON social_media_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_media_accounts_active ON social_media_accounts(project_id, is_active);

-- ============================================================================
-- 3. ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add updated_at to seo_traffic_metrics if not exists
ALTER TABLE seo_traffic_metrics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add updated_at to gsc_search_analytics if not exists
ALTER TABLE gsc_search_analytics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add load_time to cwv_results if not exists
ALTER TABLE cwv_results ADD COLUMN IF NOT EXISTS load_time NUMERIC(10,2);

-- ============================================================================
-- 4. ENSURE PAGE_CONTENT_NORMALIZED HAS ALL REQUIRED COLUMNS
-- ============================================================================

-- Drop and recreate if needed (only if table is empty or doesn't match schema)
DO $$
BEGIN
    -- Add columns if they don't exist
    ALTER TABLE page_content_normalized ADD COLUMN IF NOT EXISTS language VARCHAR(10);
    ALTER TABLE page_content_normalized ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '[]';
    ALTER TABLE page_content_normalized ADD COLUMN IF NOT EXISTS paragraphs JSONB DEFAULT '[]';
    ALTER TABLE page_content_normalized ADD COLUMN IF NOT EXISTS lists JSONB DEFAULT '[]';
    ALTER TABLE page_content_normalized ADD COLUMN IF NOT EXISTS tables JSONB DEFAULT '[]';
    ALTER TABLE page_content_normalized ADD COLUMN IF NOT EXISTS http_status INTEGER;
    ALTER TABLE page_content_normalized ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;
    ALTER TABLE page_content_normalized ADD COLUMN IF NOT EXISTS load_time_ms INTEGER;
EXCEPTION
    WHEN undefined_table THEN
        -- Table doesn't exist, create it
        CREATE TABLE page_content_normalized (
            id SERIAL PRIMARY KEY,
            project_id UUID NOT NULL,
            url TEXT NOT NULL,
            render_mode VARCHAR(20) DEFAULT 'html_only',
            language VARCHAR(10),
            title TEXT,
            meta_description TEXT,
            headings JSONB DEFAULT '[]',
            sections JSONB DEFAULT '[]',
            paragraphs JSONB DEFAULT '[]',
            lists JSONB DEFAULT '[]',
            tables JSONB DEFAULT '[]',
            internal_links JSONB DEFAULT '[]',
            external_links JSONB DEFAULT '[]',
            images JSONB DEFAULT '[]',
            structured_data JSONB DEFAULT '[]',
            content_text TEXT,
            content_hash VARCHAR(64),
            raw_html TEXT,
            http_status INTEGER,
            response_time_ms INTEGER,
            load_time_ms INTEGER,
            crawled_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(project_id, url)
        );
END $$;

-- ============================================================================
-- 5. ENSURE URL_INVENTORY TABLE EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS url_inventory (
    id SERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    state VARCHAR(20) DEFAULT 'DISCOVERED',
    depth INTEGER DEFAULT 0,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    crawled_at TIMESTAMP WITH TIME ZONE,
    parent_url TEXT,
    http_status INTEGER,
    content_type VARCHAR(100),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    UNIQUE(project_id, url)
);

CREATE INDEX IF NOT EXISTS idx_url_inventory_project_state ON url_inventory(project_id, state);
CREATE INDEX IF NOT EXISTS idx_url_inventory_project_priority ON url_inventory(project_id, priority DESC);

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON TABLE social_media_accounts IS 'Stores connected social media accounts for each project';
COMMENT ON COLUMN projects.ga4_property_id IS 'Google Analytics 4 Property ID';
COMMENT ON COLUMN projects.ga4_credentials IS 'GA4 Service Account credentials (JSON)';
COMMENT ON COLUMN projects.gsc_property_url IS 'Google Search Console property URL';
COMMENT ON COLUMN projects.gsc_credentials IS 'GSC Service Account credentials (JSON)';
COMMENT ON COLUMN projects.facebook_page_id IS 'Facebook Page ID for quick access';
