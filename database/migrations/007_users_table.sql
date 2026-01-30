-- 007_users_table.sql
-- User authentication table for AI SEO Tool

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(200) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'editor',
    avatar VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- User sessions table for token management
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Insert default admin user
-- Password: admin123 (bcrypt hash)
INSERT INTO users (id, email, password_hash, name, role, avatar) 
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'admin@seo.tool',
    '$2b$10$rQZqXzOEqL8kP9Q7JH1ogeHwZYl5MZP6cVlN5T8YMqY5.qZ0EfXMq',
    'Admin User',
    'admin',
    'https://ui-avatars.com/api/?name=Admin+User&background=0D8ABC&color=fff'
) ON CONFLICT (email) DO NOTHING;

-- Insert editor user  
-- Password: editor123 (bcrypt hash)
INSERT INTO users (id, email, password_hash, name, role, avatar)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'editor@seo.tool',
    '$2b$10$SJK5TcL1X9D8HxGf2M3oA.YvNn3Kz7Q8P1R5V6W9X0B4C7D2E3F',
    'Editor User',
    'editor',
    'https://ui-avatars.com/api/?name=Editor+User&background=28A745&color=fff'
) ON CONFLICT (email) DO NOTHING;
