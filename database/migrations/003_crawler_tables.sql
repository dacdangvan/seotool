-- Migration: 003_crawler_tables.sql
-- Description: Create tables for web crawler data storage

-- Crawl Jobs Table
CREATE TABLE IF NOT EXISTS crawl_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    config JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_pages INTEGER DEFAULT 0,
    crawled_pages INTEGER DEFAULT 0,
    failed_pages INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- Crawled Pages Table
CREATE TABLE IF NOT EXISTS crawled_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    canonical_url TEXT,
    status_code INTEGER NOT NULL,
    response_time INTEGER NOT NULL, -- in milliseconds
    title TEXT,
    meta_description TEXT,
    meta_keywords TEXT,
    meta_robots VARCHAR(100),
    open_graph JSONB,
    h1_tags JSONB DEFAULT '[]'::jsonb,
    h2_tags JSONB DEFAULT '[]'::jsonb,
    h3_tags JSONB DEFAULT '[]'::jsonb,
    word_count INTEGER DEFAULT 0,
    internal_links JSONB DEFAULT '[]'::jsonb,
    external_links JSONB DEFAULT '[]'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    structured_data JSONB,
    content_hash VARCHAR(32),
    last_modified VARCHAR(100),
    content_type VARCHAR(100),
    page_size INTEGER DEFAULT 0, -- in bytes
    crawl_depth INTEGER DEFAULT 0,
    crawled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    issues JSONB DEFAULT '[]'::jsonb,
    
    -- Unique constraint on project + url
    CONSTRAINT unique_project_url UNIQUE (project_id, url)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_project_id ON crawl_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON crawl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_created_at ON crawl_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crawled_pages_project_id ON crawled_pages(project_id);
CREATE INDEX IF NOT EXISTS idx_crawled_pages_url ON crawled_pages(url);
CREATE INDEX IF NOT EXISTS idx_crawled_pages_crawled_at ON crawled_pages(crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawled_pages_status_code ON crawled_pages(status_code);
CREATE INDEX IF NOT EXISTS idx_crawled_pages_issues ON crawled_pages USING GIN (issues);

-- Comments
COMMENT ON TABLE crawl_jobs IS 'Stores web crawler job information and status';
COMMENT ON TABLE crawled_pages IS 'Stores crawled page data and SEO analysis';

COMMENT ON COLUMN crawled_pages.response_time IS 'Page load time in milliseconds';
COMMENT ON COLUMN crawled_pages.page_size IS 'HTML size in bytes';
COMMENT ON COLUMN crawled_pages.content_hash IS 'Hash for detecting content changes';
COMMENT ON COLUMN crawled_pages.issues IS 'Array of SEO issues found on the page';
