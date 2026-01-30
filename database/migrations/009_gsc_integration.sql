-- Migration: Add Google Search Console configuration fields to projects table
-- This allows each project to have its own GSC Property and credentials

-- Add GSC configuration columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS gsc_property_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS gsc_credentials JSONB,
ADD COLUMN IF NOT EXISTS gsc_last_sync_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS gsc_sync_enabled BOOLEAN DEFAULT false;

-- Add index for GSC sync enabled projects
CREATE INDEX IF NOT EXISTS idx_projects_gsc_sync ON projects(gsc_sync_enabled) WHERE gsc_sync_enabled = true;

-- Add comments for documentation
COMMENT ON COLUMN projects.gsc_property_url IS 'Google Search Console Property URL (e.g., https://www.example.com/ or sc-domain:example.com)';
COMMENT ON COLUMN projects.gsc_credentials IS 'GSC Service Account credentials JSON (should be encrypted in production)';
COMMENT ON COLUMN projects.gsc_last_sync_at IS 'Last successful GSC data sync timestamp';
COMMENT ON COLUMN projects.gsc_sync_enabled IS 'Whether GSC sync is enabled for this project';

-- Create table to store GSC search analytics data
CREATE TABLE IF NOT EXISTS gsc_search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Dimensions
    date DATE NOT NULL,
    query VARCHAR(500),
    page VARCHAR(2048),
    country VARCHAR(10),
    device VARCHAR(20), -- DESKTOP, MOBILE, TABLET
    
    -- Metrics
    clicks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    ctr DECIMAL(5, 4) DEFAULT 0, -- Click-through rate (0.0000 to 1.0000)
    position DECIMAL(6, 2) DEFAULT 0, -- Average position
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint to prevent duplicates
    CONSTRAINT uq_gsc_analytics UNIQUE (project_id, date, query, page, country, device)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_gsc_analytics_project_date ON gsc_search_analytics(project_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_analytics_query ON gsc_search_analytics(project_id, query);
CREATE INDEX IF NOT EXISTS idx_gsc_analytics_page ON gsc_search_analytics(project_id, page);
CREATE INDEX IF NOT EXISTS idx_gsc_analytics_date_range ON gsc_search_analytics(date) WHERE date >= CURRENT_DATE - INTERVAL '90 days';

-- Create table to store GSC URL inspection data
CREATE TABLE IF NOT EXISTS gsc_url_inspection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- URL info
    url VARCHAR(2048) NOT NULL,
    
    -- Index status
    coverage_state VARCHAR(50), -- SUBMITTED_AND_INDEXED, CRAWLED_NOT_INDEXED, etc.
    indexing_state VARCHAR(50), -- INDEXING_ALLOWED, BLOCKED_BY_ROBOTS_TXT, etc.
    page_fetch_state VARCHAR(50), -- SUCCESSFUL, SOFT_404, etc.
    robots_txt_state VARCHAR(50), -- ALLOWED, DISALLOWED
    
    -- Mobile usability
    mobile_usability_result VARCHAR(50), -- MOBILE_FRIENDLY, NOT_MOBILE_FRIENDLY
    
    -- Rich results
    rich_results_status VARCHAR(50),
    
    -- Crawl info
    last_crawl_time TIMESTAMP WITH TIME ZONE,
    crawled_as VARCHAR(20), -- DESKTOP, MOBILE
    
    -- Sitemap info
    sitemap VARCHAR(2048),
    referring_urls TEXT[], -- Array of referring URLs
    
    -- Raw response
    raw_response JSONB,
    
    -- Metadata
    inspected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_gsc_inspection UNIQUE (project_id, url)
);

CREATE INDEX IF NOT EXISTS idx_gsc_inspection_project ON gsc_url_inspection(project_id);
CREATE INDEX IF NOT EXISTS idx_gsc_inspection_coverage ON gsc_url_inspection(project_id, coverage_state);

-- Create table for GSC sitemaps status
CREATE TABLE IF NOT EXISTS gsc_sitemaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    path VARCHAR(2048) NOT NULL,
    type VARCHAR(50), -- sitemap, sitemapIndex
    last_submitted TIMESTAMP WITH TIME ZONE,
    last_downloaded TIMESTAMP WITH TIME ZONE,
    
    -- Warnings and errors
    warnings_count INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    
    -- Contents
    contents JSONB, -- Array of {type, submitted, indexed}
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_gsc_sitemap UNIQUE (project_id, path)
);

CREATE INDEX IF NOT EXISTS idx_gsc_sitemaps_project ON gsc_sitemaps(project_id);

-- Update VIB project with placeholder GSC config
UPDATE projects 
SET 
    gsc_property_url = NULL,
    gsc_sync_enabled = false
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
