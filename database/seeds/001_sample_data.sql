-- Seed data for development and testing
-- Implement based on AI_SEO_TOOL_PROMPT_BOOK.md

-- Sample SEO Goal
INSERT INTO seo_goals (id, type, title, description, target_url, keywords, metrics, priority, status)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'TRAFFIC',
    'Increase Organic Traffic by 50%',
    'Goal to increase organic traffic to the main website by 50% within Q1 2026',
    'https://example.com',
    ARRAY['seo tool', 'ai seo', 'seo automation'],
    '{"targetValue": 50, "currentValue": 0, "unit": "percent"}'::jsonb,
    'HIGH',
    'PENDING'
) ON CONFLICT DO NOTHING;

-- Sample SEO Plan
INSERT INTO seo_plans (id, goal_id, name, description, status, metadata)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'SEO Plan: Increase Organic Traffic by 50%',
    'Automated plan for TRAFFIC goal targeting https://example.com',
    'DRAFT',
    '{"estimatedDurationDays": 2, "totalTasks": 4, "completedTasks": 0, "failedTasks": 0}'::jsonb
) ON CONFLICT DO NOTHING;

-- Sample SEO Tasks
INSERT INTO seo_tasks (id, plan_id, type, name, description, status, priority, input, dependencies)
VALUES 
(
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'KEYWORD_ANALYSIS',
    'Keyword Research & Analysis',
    'Analyze target keywords, search intent, and competition',
    'PENDING',
    3,
    '{"goalId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "targetUrl": "https://example.com", "keywords": ["seo tool", "ai seo", "seo automation"]}'::jsonb,
    '[]'::jsonb
),
(
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'TECHNICAL_AUDIT',
    'Technical SEO Audit',
    'Audit website for technical SEO issues',
    'PENDING',
    3,
    '{"goalId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "targetUrl": "https://example.com"}'::jsonb,
    '[]'::jsonb
),
(
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'CONTENT_GENERATION',
    'Content Strategy & Generation',
    'Generate SEO-optimized content based on keyword clusters',
    'PENDING',
    2,
    '{"goalId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "targetUrl": "https://example.com"}'::jsonb,
    '[{"taskId": "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33", "required": true}]'::jsonb
),
(
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'INTERNAL_LINKING',
    'Internal Linking Optimization',
    'Optimize internal link structure for better crawlability',
    'PENDING',
    2,
    '{"goalId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "targetUrl": "https://example.com"}'::jsonb,
    '[{"taskId": "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55", "required": true}]'::jsonb
)
ON CONFLICT DO NOTHING;
