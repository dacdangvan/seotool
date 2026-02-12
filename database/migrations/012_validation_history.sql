-- Migration: Validation History for SEO Content Validator
-- Date: 2026-02-12

-- Table to store SEO content validation history
CREATE TABLE IF NOT EXISTS validation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Input
    input_type VARCHAR(10) NOT NULL CHECK (input_type IN ('url', 'text')),
    input_url TEXT,
    input_text TEXT,
    target_keyword VARCHAR(255),
    
    -- SEO Results
    seo_score INTEGER,
    seo_results JSONB,
    
    -- Accuracy Results  
    accuracy_score INTEGER,
    duplicate_score INTEGER,
    fact_score INTEGER,
    brand_score INTEGER,
    accuracy_results JSONB,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_validation_history_project ON validation_history(project_id);
CREATE INDEX IF NOT EXISTS idx_validation_history_created ON validation_history(created_at DESC);

-- Comments
COMMENT ON TABLE validation_history IS 'SEO Content Validator history - stores all validation results';
COMMENT ON COLUMN validation_history.input_type IS 'Type of input: url or text';
COMMENT ON COLUMN validation_history.seo_score IS 'Overall SEO score (0-100)';
COMMENT ON COLUMN validation_history.accuracy_score IS 'Content accuracy score (0-100)';
COMMENT ON COLUMN validation_history.duplicate_score IS 'Duplicate content check score';
COMMENT ON COLUMN validation_history.fact_score IS 'Fact check score';
COMMENT ON COLUMN validation_history.brand_score IS 'Brand consistency score';
