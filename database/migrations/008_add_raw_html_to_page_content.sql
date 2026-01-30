-- Migration: 008_add_raw_html_to_page_content.sql
-- Description: Add raw_html column to page_content_normalized for full HTML storage
-- Date: 2026-01-26

-- Add raw_html column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'page_content_normalized' 
        AND column_name = 'raw_html'
    ) THEN
        ALTER TABLE page_content_normalized 
        ADD COLUMN raw_html TEXT;
        
        COMMENT ON COLUMN page_content_normalized.raw_html IS 'Full raw HTML content of the page';
    END IF;
END
$$;

-- Also ensure crawled_pages has raw_html column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'crawled_pages' 
        AND column_name = 'raw_html'
    ) THEN
        ALTER TABLE crawled_pages 
        ADD COLUMN raw_html TEXT;
        
        COMMENT ON COLUMN crawled_pages.raw_html IS 'Full raw HTML content of the page';
    END IF;
END
$$;
