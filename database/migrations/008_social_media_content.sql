-- Migration: Social Media Content & AI Generated Images
-- Date: 2026-01-30

-- Table to store AI-generated images
CREATE TABLE IF NOT EXISTS ai_generated_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content_id UUID, -- Link to generated content if applicable
    
    -- Image details
    prompt TEXT NOT NULL,
    image_url TEXT,
    image_data BYTEA, -- Store image binary if needed
    provider VARCHAR(50) DEFAULT 'dall-e', -- dall-e, stability-ai, midjourney, etc.
    model VARCHAR(100),
    
    -- Metadata
    width INTEGER DEFAULT 1024,
    height INTEGER DEFAULT 1024,
    style VARCHAR(50), -- realistic, cartoon, artistic, etc.
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, generating, completed, failed
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to store social media posts
CREATE TABLE IF NOT EXISTS social_media_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content_id UUID, -- Link to generated content
    image_id UUID REFERENCES ai_generated_images(id),
    
    -- Platform
    platform VARCHAR(20) NOT NULL, -- facebook, zalo, tiktok, pinterest, instagram, twitter
    
    -- Post content
    title VARCHAR(500),
    content TEXT NOT NULL,
    hashtags TEXT[], -- Array of hashtags
    link_url TEXT,
    link_title VARCHAR(255),
    link_description TEXT,
    
    -- Image/Media
    image_urls TEXT[], -- Multiple images supported
    video_url TEXT,
    
    -- Call to action
    cta_type VARCHAR(50), -- learn_more, shop_now, sign_up, etc.
    cta_url TEXT,
    
    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- draft, scheduled, published, failed
    platform_post_id VARCHAR(255), -- ID from the social platform after posting
    error_message TEXT,
    
    -- Analytics (updated after posting)
    reach INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    engagement INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to store social media account connections
CREATE TABLE IF NOT EXISTS social_media_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Platform info
    platform VARCHAR(20) NOT NULL, -- facebook, zalo, tiktok, pinterest
    account_id VARCHAR(255) NOT NULL,
    account_name VARCHAR(255),
    account_type VARCHAR(50), -- page, profile, business
    
    -- Authentication
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Page/Account details
    page_id VARCHAR(255), -- For Facebook pages
    page_name VARCHAR(255),
    profile_url TEXT,
    avatar_url TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(project_id, platform, account_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_images_project ON ai_generated_images(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_images_content ON ai_generated_images(content_id);
CREATE INDEX IF NOT EXISTS idx_ai_images_status ON ai_generated_images(status);

CREATE INDEX IF NOT EXISTS idx_social_posts_project ON social_media_posts(project_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_media_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_media_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_media_posts(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_social_accounts_project ON social_media_accounts(project_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_media_accounts(platform);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_ai_images_updated_at ON ai_generated_images;
CREATE TRIGGER update_ai_images_updated_at
    BEFORE UPDATE ON ai_generated_images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_posts_updated_at ON social_media_posts;
CREATE TRIGGER update_social_posts_updated_at
    BEFORE UPDATE ON social_media_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_accounts_updated_at ON social_media_accounts;
CREATE TRIGGER update_social_accounts_updated_at
    BEFORE UPDATE ON social_media_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
