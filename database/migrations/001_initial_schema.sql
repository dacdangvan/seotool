-- Database Schema for AI SEO Tool - Backend Orchestrator
-- Implement based on AI_SEO_TOOL_PROMPT_BOOK.md

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- SEO Goals Table
CREATE TABLE IF NOT EXISTS seo_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    target_url TEXT NOT NULL,
    keywords TEXT[],
    metrics JSONB NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    deadline TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for SEO Goals
CREATE INDEX IF NOT EXISTS idx_seo_goals_status ON seo_goals(status);
CREATE INDEX IF NOT EXISTS idx_seo_goals_type ON seo_goals(type);
CREATE INDEX IF NOT EXISTS idx_seo_goals_created_at ON seo_goals(created_at DESC);

-- SEO Plans Table
CREATE TABLE IF NOT EXISTS seo_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id UUID NOT NULL REFERENCES seo_goals(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for SEO Plans
CREATE INDEX IF NOT EXISTS idx_seo_plans_goal_id ON seo_plans(goal_id);
CREATE INDEX IF NOT EXISTS idx_seo_plans_status ON seo_plans(status);
CREATE INDEX IF NOT EXISTS idx_seo_plans_created_at ON seo_plans(created_at DESC);

-- SEO Tasks Table
CREATE TABLE IF NOT EXISTS seo_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES seo_plans(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    priority INTEGER NOT NULL DEFAULT 2,
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB,
    dependencies JSONB NOT NULL DEFAULT '[]',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    timeout_ms INTEGER NOT NULL DEFAULT 120000,
    assigned_agent VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for SEO Tasks
CREATE INDEX IF NOT EXISTS idx_seo_tasks_plan_id ON seo_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_seo_tasks_status ON seo_tasks(status);
CREATE INDEX IF NOT EXISTS idx_seo_tasks_type ON seo_tasks(type);
CREATE INDEX IF NOT EXISTS idx_seo_tasks_priority ON seo_tasks(priority DESC);
CREATE INDEX IF NOT EXISTS idx_seo_tasks_created_at ON seo_tasks(created_at);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_seo_goals_updated_at ON seo_goals;
CREATE TRIGGER update_seo_goals_updated_at
    BEFORE UPDATE ON seo_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_seo_plans_updated_at ON seo_plans;
CREATE TRIGGER update_seo_plans_updated_at
    BEFORE UPDATE ON seo_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_seo_tasks_updated_at ON seo_tasks;
CREATE TRIGGER update_seo_tasks_updated_at
    BEFORE UPDATE ON seo_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE seo_goals IS 'SEO goals representing high-level objectives';
COMMENT ON TABLE seo_plans IS 'Execution plans decomposed from SEO goals';
COMMENT ON TABLE seo_tasks IS 'Atomic tasks assigned to agents for execution';
