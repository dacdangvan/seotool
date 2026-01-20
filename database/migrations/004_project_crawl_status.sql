-- Migration: 004_project_crawl_status.sql
-- Description: Add crawl status tracking to projects table

-- Add crawl status columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS crawl_status VARCHAR(20) DEFAULT 'not_started';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS crawl_progress INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_crawl_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_crawl_job_id UUID REFERENCES crawl_jobs(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS crawl_error TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS crawl_schedule VARCHAR(50); -- cron expression or 'manual'
ALTER TABLE projects ADD COLUMN IF NOT EXISTS next_scheduled_crawl TIMESTAMP WITH TIME ZONE;

-- Add constraint for valid crawl status
ALTER TABLE projects DROP CONSTRAINT IF EXISTS valid_crawl_status;
ALTER TABLE projects ADD CONSTRAINT valid_crawl_status 
    CHECK (crawl_status IN ('not_started', 'queued', 'running', 'completed', 'failed', 'cancelled'));

-- Add progress tracking columns to crawl_jobs
ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS total_urls_discovered INTEGER DEFAULT 0;
ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS skipped_pages INTEGER DEFAULT 0;
ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(50) DEFAULT 'manual'; -- 'manual', 'scheduled', 'api'
ALTER TABLE crawl_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create crawl_job_logs table for detailed progress tracking
CREATE TABLE IF NOT EXISTS crawl_job_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
    level VARCHAR(10) NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_log_level CHECK (level IN ('debug', 'info', 'warn', 'error'))
);

-- Create crawl_queue table for job scheduling
CREATE TABLE IF NOT EXISTS crawl_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    job_id UUID REFERENCES crawl_jobs(id),
    priority INTEGER DEFAULT 0, -- higher = more priority
    status VARCHAR(20) DEFAULT 'pending',
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_queue_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_crawl_status ON projects(crawl_status);
CREATE INDEX IF NOT EXISTS idx_projects_next_scheduled_crawl ON projects(next_scheduled_crawl);
CREATE INDEX IF NOT EXISTS idx_crawl_job_logs_job_id ON crawl_job_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_crawl_job_logs_created_at ON crawl_job_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawl_queue_project_id ON crawl_queue(project_id);
CREATE INDEX IF NOT EXISTS idx_crawl_queue_status ON crawl_queue(status);
CREATE INDEX IF NOT EXISTS idx_crawl_queue_scheduled_for ON crawl_queue(scheduled_for);

-- Comments
COMMENT ON COLUMN projects.crawl_status IS 'Current crawl status: not_started, queued, running, completed, failed, cancelled';
COMMENT ON COLUMN projects.crawl_progress IS 'Current crawl progress percentage (0-100)';
COMMENT ON COLUMN projects.last_crawl_at IS 'Timestamp of last successful crawl completion';
COMMENT ON COLUMN projects.crawl_schedule IS 'Cron expression for scheduled crawls or "manual"';

COMMENT ON TABLE crawl_job_logs IS 'Detailed logs for crawl job execution';
COMMENT ON TABLE crawl_queue IS 'Queue for pending crawl jobs to prevent overlapping';
