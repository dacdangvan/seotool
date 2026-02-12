-- Migration: 008_project_ai_config.sql
-- Description: Store AI provider configuration per project

-- Table to store AI provider configurations for each project
CREATE TABLE IF NOT EXISTS project_ai_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- AI Provider Settings
    ai_provider VARCHAR(50) DEFAULT 'auto', -- 'auto', 'ollama', 'moltbot', 'anthropic', 'openai', 'gemini', 'template'
    
    -- Ollama Configuration (Local LLM - FREE)
    ollama_api_url VARCHAR(500) DEFAULT 'http://localhost:11434/v1/chat/completions',
    ollama_model VARCHAR(100) DEFAULT 'llama3:8b',
    ollama_enabled BOOLEAN DEFAULT true,
    
    -- MoltBot Configuration
    moltbot_api_key TEXT,
    moltbot_api_url VARCHAR(500) DEFAULT 'https://api.moltbot.com/v1/chat/completions',
    moltbot_model VARCHAR(100) DEFAULT 'moltbot-pro',
    
    -- Anthropic Configuration
    anthropic_api_key TEXT,
    anthropic_model VARCHAR(100) DEFAULT 'claude-3-haiku-20240307',
    
    -- OpenAI Configuration
    openai_api_key TEXT,
    openai_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
    
    -- Google Gemini Configuration
    gemini_api_key TEXT,
    gemini_model VARCHAR(100) DEFAULT 'gemini-1.5-flash',
    
    -- Custom/Other API Configuration
    custom_api_key TEXT,
    custom_api_url VARCHAR(500),
    custom_api_model VARCHAR(100),
    custom_api_headers JSONB DEFAULT '{}',
    
    -- Grok (xAI) Configuration
    grok_api_key TEXT,
    
    -- CrUX API Configuration (Core Web Vitals)
    crux_api_key TEXT,
    
    -- Generation Settings
    max_tokens INTEGER DEFAULT 4000,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one config per project
    CONSTRAINT unique_project_ai_config UNIQUE (project_id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_project_ai_configs_project_id ON project_ai_configs(project_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_project_ai_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project_ai_config_updated_at ON project_ai_configs;
CREATE TRIGGER trigger_update_project_ai_config_updated_at
    BEFORE UPDATE ON project_ai_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_project_ai_config_updated_at();

-- Comment
COMMENT ON TABLE project_ai_configs IS 'Stores AI provider configuration for each project';
COMMENT ON COLUMN project_ai_configs.ai_provider IS 'auto = use first available, or specify specific provider';
COMMENT ON COLUMN project_ai_configs.ollama_api_url IS 'Ollama API URL (local LLM server)';
COMMENT ON COLUMN project_ai_configs.ollama_model IS 'Ollama model name (e.g., llama3:8b, gpt-oss:20b)';
COMMENT ON COLUMN project_ai_configs.ollama_enabled IS 'Enable/disable Ollama as fallback provider';
COMMENT ON COLUMN project_ai_configs.grok_api_key IS 'xAI Grok API key';
COMMENT ON COLUMN project_ai_configs.crux_api_key IS 'Google CrUX API key for Core Web Vitals data';
