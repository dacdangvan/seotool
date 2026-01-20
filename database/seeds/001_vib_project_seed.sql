-- Seed Data: VIB Main Website Project
-- Domain: www.vib.com.vn

-- ============================================================================
-- INSERT VIB PROJECT
-- ============================================================================
INSERT INTO projects (id, name, domain, language, status, owner_id, settings)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'VIB Main Website',
    'www.vib.com.vn',
    'vi',
    'active',
    '11111111-1111-1111-1111-111111111111',
    '{
        "industry": "banking",
        "target_audience": "vietnamese_consumers",
        "competitors": ["techcombank.com.vn", "vpbank.com.vn", "mbbank.com.vn"],
        "seo_goals": {
            "monthly_traffic_target": 500000,
            "keyword_top10_target": 200
        }
    }'::jsonb
)
ON CONFLICT (domain) DO UPDATE SET
    name = EXCLUDED.name,
    settings = EXCLUDED.settings,
    updated_at = NOW();

-- Project Access for admin user
INSERT INTO project_access (project_id, user_id, role, granted_by)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    '11111111-1111-1111-1111-111111111111',
    'owner',
    '11111111-1111-1111-1111-111111111111'
)
ON CONFLICT (project_id, user_id) DO NOTHING;

-- ============================================================================
-- SEED TRAFFIC METRICS (Last 30 days)
-- ============================================================================
INSERT INTO seo_traffic_metrics (project_id, date, organic_traffic, total_traffic, impressions, clicks, ctr, average_position, bounce_rate, avg_session_duration, pages_per_session)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    CURRENT_DATE - (n || ' days')::interval,
    -- Organic traffic with realistic growth pattern
    FLOOR(45000 + (n * 150) + (RANDOM() * 2000))::int,
    FLOOR(52000 + (n * 180) + (RANDOM() * 2500))::int,
    FLOOR(850000 + (n * 5000) + (RANDOM() * 30000))::int,
    FLOOR(42000 + (n * 150) + (RANDOM() * 2000))::int,
    (0.048 + (RANDOM() * 0.008))::decimal(5,4),
    (12.5 + (RANDOM() * 3))::decimal(6,2),
    (0.42 + (RANDOM() * 0.08))::decimal(5,4),
    FLOOR(145 + (RANDOM() * 30))::int,
    (2.3 + (RANDOM() * 0.8))::decimal(5,2)
FROM generate_series(0, 29) AS n
ON CONFLICT (project_id, date) DO UPDATE SET
    organic_traffic = EXCLUDED.organic_traffic,
    total_traffic = EXCLUDED.total_traffic,
    impressions = EXCLUDED.impressions,
    clicks = EXCLUDED.clicks;

-- ============================================================================
-- SEED KEYWORD RANKINGS
-- ============================================================================
INSERT INTO seo_keyword_rankings (project_id, keyword, search_volume, current_position, previous_position, best_position, url, intent, difficulty, is_tracked)
VALUES
    -- Banking keywords
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'vay tiêu dùng', 45000, 3, 5, 2, 'https://www.vib.com.vn/vn/ca-nhan/vay/vay-tieu-dung', 'transactional', 72.5, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'thẻ tín dụng vib', 28000, 1, 1, 1, 'https://www.vib.com.vn/vn/ca-nhan/the/the-tin-dung', 'transactional', 45.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'lãi suất ngân hàng', 85000, 8, 12, 6, 'https://www.vib.com.vn/vn/ca-nhan/lai-suat', 'informational', 82.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'vay mua nhà', 62000, 5, 7, 4, 'https://www.vib.com.vn/vn/ca-nhan/vay/vay-mua-nha', 'transactional', 78.5, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'mở tài khoản ngân hàng online', 35000, 4, 6, 3, 'https://www.vib.com.vn/vn/ca-nhan/tai-khoan', 'transactional', 68.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'ngân hàng số', 52000, 6, 8, 5, 'https://www.vib.com.vn/vn/ngan-hang-so', 'informational', 75.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'vay tín chấp', 38000, 7, 9, 6, 'https://www.vib.com.vn/vn/ca-nhan/vay/vay-tin-chap', 'transactional', 70.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'thẻ ghi nợ quốc tế', 22000, 2, 3, 1, 'https://www.vib.com.vn/vn/ca-nhan/the/the-ghi-no', 'transactional', 55.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'gửi tiết kiệm lãi cao', 48000, 9, 11, 7, 'https://www.vib.com.vn/vn/ca-nhan/tiet-kiem', 'transactional', 80.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'chuyển tiền quốc tế', 25000, 11, 15, 8, 'https://www.vib.com.vn/vn/ca-nhan/chuyen-tien', 'transactional', 65.0, true),
    -- Brand keywords
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'vib', 120000, 1, 1, 1, 'https://www.vib.com.vn', 'navigational', 15.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'ngân hàng vib', 95000, 1, 1, 1, 'https://www.vib.com.vn', 'navigational', 20.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'vib online', 42000, 1, 2, 1, 'https://www.vib.com.vn/vn/ngan-hang-so', 'navigational', 18.0, true),
    -- Long-tail keywords
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'cách mở thẻ tín dụng online', 12000, 4, 7, 3, 'https://www.vib.com.vn/vn/ca-nhan/the/the-tin-dung', 'informational', 58.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'so sánh lãi suất vay mua nhà', 8500, 6, 10, 5, 'https://www.vib.com.vn/vn/ca-nhan/vay/vay-mua-nha', 'commercial', 62.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'điều kiện vay tiêu dùng', 15000, 3, 5, 2, 'https://www.vib.com.vn/vn/ca-nhan/vay/vay-tieu-dung', 'informational', 55.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'ưu đãi thẻ tín dụng', 18000, 5, 8, 4, 'https://www.vib.com.vn/vn/ca-nhan/the/uu-dai', 'commercial', 60.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'app ngân hàng tốt nhất', 22000, 12, 18, 9, 'https://www.vib.com.vn/vn/ngan-hang-so', 'informational', 72.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'vay trả góp không cần chứng minh thu nhập', 28000, 8, 12, 6, 'https://www.vib.com.vn/vn/ca-nhan/vay', 'transactional', 75.0, true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'thanh toán quốc tế', 16000, 7, 9, 5, 'https://www.vib.com.vn/vn/ca-nhan/the/thanh-toan', 'informational', 58.0, true)
ON CONFLICT (project_id, keyword) DO UPDATE SET
    current_position = EXCLUDED.current_position,
    previous_position = EXCLUDED.previous_position,
    search_volume = EXCLUDED.search_volume,
    last_updated = NOW();

-- ============================================================================
-- SEED TECHNICAL HEALTH (Last 7 days)
-- ============================================================================
INSERT INTO seo_technical_health (project_id, date, overall_score, lcp_score, fid_score, cls_score, inp_score, indexed_pages, crawl_errors, broken_links, critical_issues, warnings, notices, issues)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    CURRENT_DATE - (n || ' days')::interval,
    78 + FLOOR(RANDOM() * 5)::int, -- overall_score 78-82
    2.1 + (RANDOM() * 0.4), -- LCP 2.1-2.5s
    85 + (RANDOM() * 15), -- FID 85-100ms
    0.08 + (RANDOM() * 0.04), -- CLS 0.08-0.12
    180 + (RANDOM() * 40), -- INP 180-220ms
    1250 + FLOOR(RANDOM() * 50)::int, -- indexed pages
    FLOOR(RANDOM() * 5)::int, -- crawl errors
    FLOOR(RANDOM() * 8)::int, -- broken links
    FLOOR(RANDOM() * 3)::int, -- critical issues
    8 + FLOOR(RANDOM() * 5)::int, -- warnings
    25 + FLOOR(RANDOM() * 10)::int, -- notices
    '[
        {"type": "mobile_usability", "severity": "warning", "count": 3, "description": "Text too small to read"},
        {"type": "page_speed", "severity": "warning", "count": 5, "description": "Render-blocking resources"},
        {"type": "meta_description", "severity": "notice", "count": 12, "description": "Meta descriptions too long"}
    ]'::jsonb
FROM generate_series(0, 6) AS n
ON CONFLICT (project_id, date) DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    lcp_score = EXCLUDED.lcp_score,
    indexed_pages = EXCLUDED.indexed_pages;

-- ============================================================================
-- SEED BACKLINK METRICS (Last 30 days)
-- ============================================================================
INSERT INTO seo_backlink_metrics (project_id, date, total_backlinks, referring_domains, domain_authority, dofollow_links, nofollow_links, new_backlinks, lost_backlinks, toxic_score)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    CURRENT_DATE - (n || ' days')::interval,
    45000 + (n * 50) + FLOOR(RANDOM() * 200)::int,
    2850 + (n * 3) + FLOOR(RANDOM() * 20)::int,
    68.5 + (RANDOM() * 2),
    38000 + (n * 40) + FLOOR(RANDOM() * 150)::int,
    7000 + (n * 10) + FLOOR(RANDOM() * 50)::int,
    FLOOR(15 + RANDOM() * 30)::int,
    FLOOR(5 + RANDOM() * 10)::int,
    8.5 + (RANDOM() * 3)
FROM generate_series(0, 29) AS n
ON CONFLICT (project_id, date) DO UPDATE SET
    total_backlinks = EXCLUDED.total_backlinks,
    referring_domains = EXCLUDED.referring_domains;

-- ============================================================================
-- SEED KPI SNAPSHOTS (Last 30 days)
-- ============================================================================
INSERT INTO seo_kpi_snapshots (project_id, date, organic_traffic, traffic_change_percent, total_keywords, keywords_top_3, keywords_top_10, keywords_top_100, average_position, seo_health_score, domain_authority, total_backlinks, organic_conversions, conversion_rate, estimated_value)
SELECT 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    CURRENT_DATE - (n || ' days')::interval,
    45000 + (n * 150) + FLOOR(RANDOM() * 2000)::int,
    (2.5 + (RANDOM() * 3))::decimal(8,2),
    185 + FLOOR(RANDOM() * 10)::int,
    12 + FLOOR(RANDOM() * 3)::int,
    45 + FLOOR(RANDOM() * 8)::int,
    165 + FLOOR(RANDOM() * 15)::int,
    (12.5 + (RANDOM() * 2))::decimal(6,2),
    78 + FLOOR(RANDOM() * 5)::int,
    (68.5 + (RANDOM() * 2))::decimal(5,2),
    45000 + (n * 50) + FLOOR(RANDOM() * 200)::int,
    FLOOR(850 + (RANDOM() * 150))::int,
    (0.018 + (RANDOM() * 0.005))::decimal(8,4),
    (125000000 + (RANDOM() * 25000000))::decimal(15,2) -- VND
FROM generate_series(0, 29) AS n
ON CONFLICT (project_id, date) DO UPDATE SET
    organic_traffic = EXCLUDED.organic_traffic,
    traffic_change_percent = EXCLUDED.traffic_change_percent,
    seo_health_score = EXCLUDED.seo_health_score;

-- ============================================================================
-- SEED FORECASTS
-- ============================================================================
INSERT INTO seo_forecasts (project_id, metric, period_days, forecast_date, low_estimate, mid_estimate, high_estimate, confidence, model_version)
VALUES
    -- Traffic forecasts
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'traffic', 30, CURRENT_DATE, 1420000, 1580000, 1750000, 0.82, 'v1.5'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'traffic', 60, CURRENT_DATE, 2900000, 3350000, 3800000, 0.75, 'v1.5'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'traffic', 90, CURRENT_DATE, 4500000, 5400000, 6300000, 0.68, 'v1.5'),
    -- Revenue forecasts (VND)
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'revenue', 30, CURRENT_DATE, 3500000000, 4200000000, 4900000000, 0.78, 'v1.5'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'revenue', 60, CURRENT_DATE, 7500000000, 9200000000, 10800000000, 0.72, 'v1.5'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'revenue', 90, CURRENT_DATE, 12000000000, 15500000000, 19000000000, 0.65, 'v1.5');

-- ============================================================================
-- SEED RECOMMENDATIONS
-- ============================================================================
INSERT INTO seo_recommendations (project_id, category, priority, title, description, impact, effort, status, auto_executable, action_data)
VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'technical', 'critical', 'Cải thiện Core Web Vitals - LCP', 
     'LCP hiện tại là 2.3s, cần tối ưu xuống dưới 2.5s. Đề xuất: Optimize hero images, implement lazy loading, minify CSS/JS.', 
     'high', 'medium', 'pending', false,
     '{"metric": "lcp", "current": 2.3, "target": 2.0, "affected_pages": 45}'::jsonb),
    
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'content', 'high', 'Tối ưu meta description cho 12 trang', 
     'Có 12 trang có meta description quá dài (>160 ký tự). Cần viết lại ngắn gọn và hấp dẫn hơn.', 
     'medium', 'low', 'pending', true,
     '{"pages": ["/vay-tieu-dung", "/the-tin-dung", "/vay-mua-nha"], "auto_action": "truncate_meta"}'::jsonb),
    
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'keywords', 'high', 'Cơ hội từ khóa "lãi suất ngân hàng"', 
     'Từ khóa có volume 85,000/tháng, hiện rank #8. Có thể cải thiện lên top 5 bằng cách bổ sung internal links và cập nhật content.', 
     'high', 'medium', 'pending', false,
     '{"keyword": "lãi suất ngân hàng", "current_rank": 8, "target_rank": 5, "volume": 85000}'::jsonb),
    
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'technical', 'medium', 'Fix 5 broken internal links', 
     'Phát hiện 5 internal links trỏ đến trang 404. Cần redirect hoặc cập nhật link.', 
     'medium', 'low', 'in_progress', true,
     '{"broken_links": ["/old-promo", "/legacy-product", "/archived-page"], "auto_action": "redirect"}'::jsonb),
    
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'backlinks', 'medium', 'Disavow 15 toxic backlinks', 
     'Phát hiện 15 backlinks từ các domain spam có toxic score > 80. Đề xuất disavow để bảo vệ domain authority.', 
     'medium', 'low', 'pending', false,
     '{"toxic_links": 15, "avg_toxic_score": 85, "domains": ["spam-site.com", "bad-links.net"]}'::jsonb),
    
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'content', 'medium', 'Cập nhật 8 bài viết outdated', 
     'Có 8 bài viết về lãi suất và sản phẩm đã cũ (> 6 tháng). Cần cập nhật thông tin mới nhất.', 
     'medium', 'high', 'pending', false,
     '{"outdated_pages": 8, "avg_age_days": 245}'::jsonb),
    
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'keywords', 'low', 'Theo dõi 10 từ khóa mới tiềm năng', 
     'Phát hiện 10 từ khóa trending trong ngành banking có thể target. Volume tổng: 125,000/tháng.', 
     'medium', 'low', 'pending', false,
     '{"new_keywords": ["fintech vietnam", "mobile banking app", "contactless payment"], "total_volume": 125000}'::jsonb);

SELECT 'VIB Project seed data inserted successfully!' AS status;
