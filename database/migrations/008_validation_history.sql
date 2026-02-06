-- Migration: 008_validation_history.sql
-- Description: Create validation history table for SEO content validation results

CREATE TABLE IF NOT EXISTS validation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Input info
    input_type VARCHAR(10) NOT NULL CHECK (input_type IN ('url', 'text')),
    input_url TEXT,
    input_text TEXT,
    target_keyword VARCHAR(255),
    
    -- SEO Analysis Results
    seo_score INTEGER,
    seo_results JSONB, -- Store full SEO check results
    
    -- Content Accuracy Results
    accuracy_score INTEGER,
    duplicate_score INTEGER,
    fact_score INTEGER,
    brand_score INTEGER,
    accuracy_results JSONB, -- Store full accuracy check results (similarContent, factChecks, brandChecks)
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255)
);

-- Indexes for faster queries
CREATE INDEX idx_validation_history_project_id ON validation_history(project_id);
CREATE INDEX idx_validation_history_created_at ON validation_history(created_at DESC);
CREATE INDEX idx_validation_history_input_url ON validation_history(input_url) WHERE input_url IS NOT NULL;

-- Comments
COMMENT ON TABLE validation_history IS 'Stores history of SEO content validation results';
COMMENT ON COLUMN validation_history.input_type IS 'Type of input: url or text';
COMMENT ON COLUMN validation_history.seo_results IS 'JSON containing all SEO check results with status and recommendations';
COMMENT ON COLUMN validation_history.accuracy_results IS 'JSON containing similarity matches, fact checks, and brand checks';
