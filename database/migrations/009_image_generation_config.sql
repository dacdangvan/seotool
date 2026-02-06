-- Migration: Add Image Generation Provider Config
-- Date: 2026-02-03

-- Add columns for image generation provider
ALTER TABLE project_ai_configs 
ADD COLUMN IF NOT EXISTS image_provider VARCHAR(50) DEFAULT 'huggingface',
ADD COLUMN IF NOT EXISTS huggingface_api_key TEXT,
ADD COLUMN IF NOT EXISTS huggingface_model VARCHAR(200) DEFAULT 'stabilityai/stable-diffusion-xl-base-1.0',
ADD COLUMN IF NOT EXISTS stability_api_key TEXT,
ADD COLUMN IF NOT EXISTS replicate_api_key TEXT;

-- Add comment
COMMENT ON COLUMN project_ai_configs.image_provider IS 'Image generation provider: huggingface, openai, stability, replicate';
COMMENT ON COLUMN project_ai_configs.huggingface_api_key IS 'Hugging Face API key (free tier available)';
COMMENT ON COLUMN project_ai_configs.huggingface_model IS 'Hugging Face model for image generation';
