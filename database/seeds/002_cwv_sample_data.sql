-- Seed CWV data for crawled URLs
-- This generates realistic CWV metrics for testing

-- First, get URLs from url_inventory that have been crawled
INSERT INTO cwv_results (
    project_id,
    url,
    device,
    lcp_value,
    lcp_status,
    inp_value,
    inp_status,
    cls_value,
    cls_status,
    fcp_value,
    fcp_status,
    ttfb_value,
    ttfb_status,
    si_value,
    si_status,
    tbt_value,
    tbt_status,
    performance_score,
    overall_status,
    lighthouse_version,
    user_agent,
    measured_at,
    created_at,
    updated_at
)
SELECT 
    project_id,
    url,
    'mobile' as device,
    -- LCP: 1500-4000ms range (good < 2500, needs improvement < 4000, poor >= 4000)
    (1500 + random() * 2500)::int as lcp_value,
    CASE 
        WHEN random() < 0.6 THEN 'good'
        WHEN random() < 0.85 THEN 'needs_improvement'
        ELSE 'poor'
    END as lcp_status,
    -- INP: 50-500ms range (good < 200, needs improvement < 500, poor >= 500)
    (50 + random() * 450)::int as inp_value,
    CASE 
        WHEN random() < 0.7 THEN 'good'
        WHEN random() < 0.9 THEN 'needs_improvement'
        ELSE 'poor'
    END as inp_status,
    -- CLS: 0-0.5 range (good < 0.1, needs improvement < 0.25, poor >= 0.25)
    (random() * 0.3)::numeric(4,3) as cls_value,
    CASE 
        WHEN random() < 0.65 THEN 'good'
        WHEN random() < 0.88 THEN 'needs_improvement'
        ELSE 'poor'
    END as cls_status,
    -- FCP: 1000-3000ms range
    (1000 + random() * 2000)::int as fcp_value,
    CASE 
        WHEN random() < 0.6 THEN 'good'
        WHEN random() < 0.85 THEN 'needs_improvement'
        ELSE 'poor'
    END as fcp_status,
    -- TTFB: 200-1500ms range
    (200 + random() * 1300)::int as ttfb_value,
    CASE 
        WHEN random() < 0.5 THEN 'good'
        WHEN random() < 0.8 THEN 'needs_improvement'
        ELSE 'poor'
    END as ttfb_status,
    -- Speed Index: 2000-6000ms
    (2000 + random() * 4000)::int as si_value,
    CASE 
        WHEN random() < 0.55 THEN 'good'
        WHEN random() < 0.82 THEN 'needs_improvement'
        ELSE 'poor'
    END as si_status,
    -- TBT: 100-600ms
    (100 + random() * 500)::int as tbt_value,
    CASE 
        WHEN random() < 0.6 THEN 'good'
        WHEN random() < 0.85 THEN 'needs_improvement'
        ELSE 'poor'
    END as tbt_status,
    -- Performance score: 40-95
    (40 + random() * 55)::int as performance_score,
    -- Overall status based on random
    CASE 
        WHEN random() < 0.5 THEN 'good'
        WHEN random() < 0.8 THEN 'needs_improvement'
        ELSE 'poor'
    END as overall_status,
    '11.0.0' as lighthouse_version,
    'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/90.0.4430.91 Mobile Safari/537.36' as user_agent,
    NOW() - (random() * interval '7 days') as measured_at,
    NOW() as created_at,
    NOW() as updated_at
FROM url_inventory
WHERE state = 'CRAWLED'
LIMIT 50;

-- Also add desktop measurements for the same URLs
INSERT INTO cwv_results (
    project_id,
    url,
    device,
    lcp_value,
    lcp_status,
    inp_value,
    inp_status,
    cls_value,
    cls_status,
    fcp_value,
    fcp_status,
    ttfb_value,
    ttfb_status,
    si_value,
    si_status,
    tbt_value,
    tbt_status,
    performance_score,
    overall_status,
    lighthouse_version,
    user_agent,
    measured_at,
    created_at,
    updated_at
)
SELECT 
    project_id,
    url,
    'desktop' as device,
    -- Desktop typically has better metrics
    (1200 + random() * 2000)::int as lcp_value,
    CASE 
        WHEN random() < 0.7 THEN 'good'
        WHEN random() < 0.9 THEN 'needs_improvement'
        ELSE 'poor'
    END as lcp_status,
    (30 + random() * 300)::int as inp_value,
    CASE 
        WHEN random() < 0.75 THEN 'good'
        WHEN random() < 0.92 THEN 'needs_improvement'
        ELSE 'poor'
    END as inp_status,
    (random() * 0.2)::numeric(4,3) as cls_value,
    CASE 
        WHEN random() < 0.7 THEN 'good'
        WHEN random() < 0.9 THEN 'needs_improvement'
        ELSE 'poor'
    END as cls_status,
    (800 + random() * 1500)::int as fcp_value,
    CASE 
        WHEN random() < 0.7 THEN 'good'
        WHEN random() < 0.9 THEN 'needs_improvement'
        ELSE 'poor'
    END as fcp_status,
    (150 + random() * 1000)::int as ttfb_value,
    CASE 
        WHEN random() < 0.6 THEN 'good'
        WHEN random() < 0.85 THEN 'needs_improvement'
        ELSE 'poor'
    END as ttfb_status,
    (1500 + random() * 3500)::int as si_value,
    CASE 
        WHEN random() < 0.6 THEN 'good'
        WHEN random() < 0.85 THEN 'needs_improvement'
        ELSE 'poor'
    END as si_status,
    (50 + random() * 400)::int as tbt_value,
    CASE 
        WHEN random() < 0.7 THEN 'good'
        WHEN random() < 0.9 THEN 'needs_improvement'
        ELSE 'poor'
    END as tbt_status,
    (50 + random() * 45)::int as performance_score,
    CASE 
        WHEN random() < 0.6 THEN 'good'
        WHEN random() < 0.85 THEN 'needs_improvement'
        ELSE 'poor'
    END as overall_status,
    '11.0.0' as lighthouse_version,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/90.0.4430.93 Safari/537.36' as user_agent,
    NOW() - (random() * interval '7 days') as measured_at,
    NOW() as created_at,
    NOW() as updated_at
FROM url_inventory
WHERE state = 'CRAWLED'
LIMIT 50;

-- Show result
SELECT 
    device,
    COUNT(*) as count,
    AVG(performance_score)::int as avg_score,
    AVG(lcp_value)::int as avg_lcp,
    AVG(cls_value)::numeric(4,3) as avg_cls
FROM cwv_results
GROUP BY device;
