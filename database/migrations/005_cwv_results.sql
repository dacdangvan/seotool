-- Migration 005: Core Web Vitals Results Table
-- Stores CWV measurement results per page

CREATE TABLE IF NOT EXISTS cwv_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    device VARCHAR(20) NOT NULL CHECK (device IN ('mobile', 'desktop')),
    
    -- LCP: Largest Contentful Paint
    lcp_value DECIMAL(10, 2) NOT NULL,
    lcp_status VARCHAR(20) NOT NULL CHECK (lcp_status IN ('good', 'needs_improvement', 'poor')),
    
    -- INP: Interaction to Next Paint (nullable - may not be available in lab data)
    inp_value DECIMAL(10, 2),
    inp_status VARCHAR(20) CHECK (inp_status IS NULL OR inp_status IN ('good', 'needs_improvement', 'poor')),
    
    -- CLS: Cumulative Layout Shift
    cls_value DECIMAL(10, 4) NOT NULL,
    cls_status VARCHAR(20) NOT NULL CHECK (cls_status IN ('good', 'needs_improvement', 'poor')),
    
    -- FCP: First Contentful Paint
    fcp_value DECIMAL(10, 2) NOT NULL,
    fcp_status VARCHAR(20) NOT NULL CHECK (fcp_status IN ('good', 'needs_improvement', 'poor')),
    
    -- TTFB: Time to First Byte
    ttfb_value DECIMAL(10, 2) NOT NULL,
    ttfb_status VARCHAR(20) NOT NULL CHECK (ttfb_status IN ('good', 'needs_improvement', 'poor')),
    
    -- SI: Speed Index
    si_value DECIMAL(10, 2),
    si_status VARCHAR(20) CHECK (si_status IS NULL OR si_status IN ('good', 'needs_improvement', 'poor')),
    
    -- TBT: Total Blocking Time
    tbt_value DECIMAL(10, 2),
    tbt_status VARCHAR(20) CHECK (tbt_status IS NULL OR tbt_status IN ('good', 'needs_improvement', 'poor')),
    
    -- Performance score (0-100)
    performance_score INTEGER NOT NULL CHECK (performance_score >= 0 AND performance_score <= 100),
    
    -- Overall status based on primary CWV (LCP, CLS, INP)
    overall_status VARCHAR(20) NOT NULL CHECK (overall_status IN ('good', 'needs_improvement', 'poor')),
    
    -- Lighthouse metadata
    lighthouse_version VARCHAR(50),
    user_agent TEXT,
    
    -- Raw Lighthouse report (optional, for debugging)
    raw_report JSONB,
    
    -- Timestamps
    measured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint: one result per URL + device per project
    CONSTRAINT unique_cwv_result UNIQUE (project_id, url, device)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cwv_results_project_id ON cwv_results(project_id);
CREATE INDEX IF NOT EXISTS idx_cwv_results_device ON cwv_results(device);
CREATE INDEX IF NOT EXISTS idx_cwv_results_overall_status ON cwv_results(overall_status);
CREATE INDEX IF NOT EXISTS idx_cwv_results_performance_score ON cwv_results(performance_score);
CREATE INDEX IF NOT EXISTS idx_cwv_results_measured_at ON cwv_results(measured_at);

-- Composite index for filtering
CREATE INDEX IF NOT EXISTS idx_cwv_results_project_device ON cwv_results(project_id, device);
CREATE INDEX IF NOT EXISTS idx_cwv_results_project_status ON cwv_results(project_id, overall_status);

-- Partial index for poor performing pages (quick access to problem pages)
CREATE INDEX IF NOT EXISTS idx_cwv_results_poor ON cwv_results(project_id, performance_score) 
WHERE overall_status = 'poor';

COMMENT ON TABLE cwv_results IS 'Core Web Vitals measurement results per page';
COMMENT ON COLUMN cwv_results.lcp_value IS 'Largest Contentful Paint in milliseconds';
COMMENT ON COLUMN cwv_results.inp_value IS 'Interaction to Next Paint in milliseconds (may be null for lab data)';
COMMENT ON COLUMN cwv_results.cls_value IS 'Cumulative Layout Shift score (unitless)';
COMMENT ON COLUMN cwv_results.fcp_value IS 'First Contentful Paint in milliseconds';
COMMENT ON COLUMN cwv_results.ttfb_value IS 'Time to First Byte in milliseconds';
COMMENT ON COLUMN cwv_results.si_value IS 'Speed Index in milliseconds';
COMMENT ON COLUMN cwv_results.tbt_value IS 'Total Blocking Time in milliseconds';
COMMENT ON COLUMN cwv_results.overall_status IS 'Overall CWV status (worst of LCP, CLS, INP)';
