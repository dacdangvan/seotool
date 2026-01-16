-- Drop all tables (use with caution)
-- For development reset only

DROP TRIGGER IF EXISTS update_seo_tasks_updated_at ON seo_tasks;
DROP TRIGGER IF EXISTS update_seo_plans_updated_at ON seo_plans;
DROP TRIGGER IF EXISTS update_seo_goals_updated_at ON seo_goals;

DROP TABLE IF EXISTS seo_tasks CASCADE;
DROP TABLE IF EXISTS seo_plans CASCADE;
DROP TABLE IF EXISTS seo_goals CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column();
