-- Migration: Add GA4 configuration fields to projects table
-- This allows each project to have its own GA4 Property ID and credentials

-- Add GA4 configuration columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS ga4_property_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS ga4_credentials JSONB,
ADD COLUMN IF NOT EXISTS ga4_last_sync_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ga4_sync_enabled BOOLEAN DEFAULT false;

-- Add index for GA4 sync enabled projects
CREATE INDEX IF NOT EXISTS idx_projects_ga4_sync ON projects(ga4_sync_enabled) WHERE ga4_sync_enabled = true;

-- Add comments for documentation
COMMENT ON COLUMN projects.ga4_property_id IS 'Google Analytics 4 Property ID (e.g., 123456789)';
COMMENT ON COLUMN projects.ga4_credentials IS 'GA4 Service Account credentials JSON (encrypted)';
COMMENT ON COLUMN projects.ga4_last_sync_at IS 'Last successful GA4 data sync timestamp';
COMMENT ON COLUMN projects.ga4_sync_enabled IS 'Whether GA4 sync is enabled for this project';

-- Update VIB project with placeholder GA4 config (user will update with real values)
UPDATE projects 
SET 
    ga4_property_id = NULL,
    ga4_sync_enabled = false
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
