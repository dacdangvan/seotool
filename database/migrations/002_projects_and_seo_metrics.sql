-- Projects and SEO Metrics Schema
-- AI SEO Tool - Project Management & SEO Data

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    domain VARCHAR(255) NOT NULL UNIQUE,
    language VARCHAR(10) NOT NULL DEFAULT 'vi',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    owner_id UUID NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for projects
CREATE INDEX IF NOT EXISTS idx_projects_domain ON projects(domain);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);

-- ============================================================================
-- PROJECT ACCESS (RBAC)
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer',
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    granted_by UUID,
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_access_project ON project_access(project_id);
CREATE INDEX IF NOT EXISTS idx_project_access_user ON project_access(user_id);

-- ============================================================================
-- SEO METRICS - TRAFFIC DATA
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_traffic_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    organic_traffic INTEGER NOT NULL DEFAULT 0,
    total_traffic INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    ctr DECIMAL(5,4) NOT NULL DEFAULT 0,
    average_position DECIMAL(6,2),
    bounce_rate DECIMAL(5,4),
    avg_session_duration INTEGER, -- in seconds
    pages_per_session DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, date)
);

CREATE INDEX IF NOT EXISTS idx_traffic_project_date ON seo_traffic_metrics(project_id, date DESC);

-- ============================================================================
-- SEO METRICS - KEYWORD RANKINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_keyword_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    keyword VARCHAR(500) NOT NULL,
    search_volume INTEGER,
    current_position INTEGER,
    previous_position INTEGER,
    best_position INTEGER,
    url TEXT,
    intent VARCHAR(50), -- informational, transactional, commercial, navigational
    difficulty DECIMAL(5,2),
    is_tracked BOOLEAN NOT NULL DEFAULT true,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_keywords_project ON seo_keyword_rankings(project_id);
CREATE INDEX IF NOT EXISTS idx_keywords_position ON seo_keyword_rankings(current_position);
CREATE INDEX IF NOT EXISTS idx_keywords_volume ON seo_keyword_rankings(search_volume DESC);

-- ============================================================================
-- SEO METRICS - TECHNICAL HEALTH
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_technical_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    overall_score INTEGER NOT NULL DEFAULT 0, -- 0-100
    
    -- Core Web Vitals
    lcp_score DECIMAL(6,2), -- Largest Contentful Paint (ms)
    fid_score DECIMAL(6,2), -- First Input Delay (ms)
    cls_score DECIMAL(6,4), -- Cumulative Layout Shift
    inp_score DECIMAL(6,2), -- Interaction to Next Paint (ms)
    
    -- Crawl Stats
    indexed_pages INTEGER NOT NULL DEFAULT 0,
    crawl_errors INTEGER NOT NULL DEFAULT 0,
    broken_links INTEGER NOT NULL DEFAULT 0,
    
    -- Issues Count
    critical_issues INTEGER NOT NULL DEFAULT 0,
    warnings INTEGER NOT NULL DEFAULT 0,
    notices INTEGER NOT NULL DEFAULT 0,
    
    -- Detailed Issues JSON
    issues JSONB NOT NULL DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, date)
);

CREATE INDEX IF NOT EXISTS idx_tech_health_project_date ON seo_technical_health(project_id, date DESC);

-- ============================================================================
-- SEO METRICS - BACKLINKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_backlink_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_backlinks INTEGER NOT NULL DEFAULT 0,
    referring_domains INTEGER NOT NULL DEFAULT 0,
    domain_authority DECIMAL(5,2),
    dofollow_links INTEGER NOT NULL DEFAULT 0,
    nofollow_links INTEGER NOT NULL DEFAULT 0,
    new_backlinks INTEGER NOT NULL DEFAULT 0,
    lost_backlinks INTEGER NOT NULL DEFAULT 0,
    toxic_score DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, date)
);

CREATE INDEX IF NOT EXISTS idx_backlinks_project_date ON seo_backlink_metrics(project_id, date DESC);

-- ============================================================================
-- SEO METRICS - CONTENT PERFORMANCE
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_content_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title VARCHAR(500),
    page_type VARCHAR(50), -- article, product, category, landing
    word_count INTEGER,
    seo_score INTEGER, -- 0-100
    readability_score DECIMAL(5,2),
    organic_traffic INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    average_position DECIMAL(6,2),
    top_keyword VARCHAR(500),
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, url)
);

CREATE INDEX IF NOT EXISTS idx_content_project ON seo_content_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_content_traffic ON seo_content_metrics(organic_traffic DESC);

-- ============================================================================
-- SEO KPI SNAPSHOTS (Daily summary for dashboard)
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_kpi_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Traffic KPIs
    organic_traffic INTEGER NOT NULL DEFAULT 0,
    traffic_change_percent DECIMAL(8,2),
    
    -- Keyword KPIs
    total_keywords INTEGER NOT NULL DEFAULT 0,
    keywords_top_3 INTEGER NOT NULL DEFAULT 0,
    keywords_top_10 INTEGER NOT NULL DEFAULT 0,
    keywords_top_100 INTEGER NOT NULL DEFAULT 0,
    average_position DECIMAL(6,2),
    
    -- Health KPIs
    seo_health_score INTEGER NOT NULL DEFAULT 0,
    
    -- Backlink KPIs
    domain_authority DECIMAL(5,2),
    total_backlinks INTEGER NOT NULL DEFAULT 0,
    
    -- Conversion KPIs
    organic_conversions INTEGER,
    conversion_rate DECIMAL(8,4),
    estimated_value DECIMAL(15,2),
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, date)
);

CREATE INDEX IF NOT EXISTS idx_kpi_project_date ON seo_kpi_snapshots(project_id, date DESC);

-- ============================================================================
-- SEO FORECASTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_forecasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    metric VARCHAR(50) NOT NULL, -- traffic, rankings, revenue
    period_days INTEGER NOT NULL, -- 30, 60, 90
    forecast_date DATE NOT NULL,
    low_estimate DECIMAL(15,2),
    mid_estimate DECIMAL(15,2),
    high_estimate DECIMAL(15,2),
    confidence DECIMAL(5,4),
    model_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forecasts_project ON seo_forecasts(project_id, forecast_date DESC);

-- ============================================================================
-- SEO RECOMMENDATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS seo_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- technical, content, keywords, backlinks
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- critical, high, medium, low
    title VARCHAR(300) NOT NULL,
    description TEXT NOT NULL,
    impact VARCHAR(50), -- high, medium, low
    effort VARCHAR(50), -- high, medium, low
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, dismissed
    auto_executable BOOLEAN NOT NULL DEFAULT false,
    action_data JSONB,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_project ON seo_recommendations(project_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON seo_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON seo_recommendations(priority);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recommendations_updated_at ON seo_recommendations;
CREATE TRIGGER update_recommendations_updated_at
    BEFORE UPDATE ON seo_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
