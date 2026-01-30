#!/bin/bash

# =============================================================================
# SEOTOOL: Start Services & Initialize VIB Project
# =============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "🚀 AI SEO Tool - Service Startup"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker daemon is not running${NC}"
        echo "Please start Docker Desktop and try again"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Start database containers
start_database() {
    echo ""
    echo "📦 Starting PostgreSQL and Redis..."
    
    docker-compose up -d postgres redis
    
    # Wait for PostgreSQL to be ready
    echo "⏳ Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if docker exec ai-seo-postgres pg_isready -U postgres > /dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ PostgreSQL failed to start${NC}"
            exit 1
        fi
        sleep 1
    done
    
    # Wait for Redis
    echo "⏳ Waiting for Redis to be ready..."
    for i in {1..30}; do
        if docker exec ai-seo-redis redis-cli ping > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Redis is ready${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ Redis failed to start${NC}"
            exit 1
        fi
        sleep 1
    done
}

# Run migrations
run_migrations() {
    echo ""
    echo "🗄️ Running database migrations..."
    
    # Run all migration files in order
    for migration in database/migrations/*.sql; do
        if [ -f "$migration" ]; then
            echo "  → Running $(basename "$migration")"
            docker exec -i ai-seo-postgres psql -U postgres -d ai_seo_tool < "$migration" > /dev/null 2>&1 || true
        fi
    done
    
    echo -e "${GREEN}✅ Migrations complete${NC}"
}

# Seed VIB project data
seed_vib_project() {
    echo ""
    echo "🌱 Seeding VIB project data..."
    
    # Run VIB seed
    if [ -f "database/seeds/001_vib_project_seed.sql" ]; then
        docker exec -i ai-seo-postgres psql -U postgres -d ai_seo_tool < database/seeds/001_vib_project_seed.sql > /dev/null 2>&1 || true
        echo -e "${GREEN}✅ VIB project data seeded${NC}"
    fi
}

# Verify VIB project
verify_vib_project() {
    echo ""
    echo "🔍 Verifying VIB project..."
    
    RESULT=$(docker exec ai-seo-postgres psql -U postgres -d ai_seo_tool -t -c "SELECT name, domain FROM projects WHERE domain = 'www.vib.com.vn';" 2>/dev/null)
    
    if [ -z "$RESULT" ]; then
        echo -e "${RED}❌ VIB project not found in database${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ VIB project found: $RESULT${NC}"
    
    # Count data
    TRAFFIC=$(docker exec ai-seo-postgres psql -U postgres -d ai_seo_tool -t -c "SELECT COUNT(*) FROM seo_traffic_metrics WHERE project_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';" 2>/dev/null | tr -d ' ')
    KEYWORDS=$(docker exec ai-seo-postgres psql -U postgres -d ai_seo_tool -t -c "SELECT COUNT(*) FROM seo_keyword_rankings WHERE project_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';" 2>/dev/null | tr -d ' ')
    
    echo "  → Traffic metrics: $TRAFFIC records"
    echo "  → Keywords: $KEYWORDS records"
}

# Start backend
start_backend() {
    echo ""
    echo "🖥️ Starting backend server..."
    
    cd "$PROJECT_DIR/backend"
    
    if [ ! -d "node_modules" ]; then
        echo "  → Installing dependencies..."
        npm install > /dev/null 2>&1
    fi
    
    # Check if already running
    if lsof -Pi :3001 -sTCP:LISTEN -t > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️ Backend already running on port 3001${NC}"
    else
        echo "  → Starting backend on port 3001..."
        npm run dev > /dev/null 2>&1 &
        sleep 3
        echo -e "${GREEN}✅ Backend started${NC}"
    fi
    
    cd "$PROJECT_DIR"
}

# Start frontend
start_frontend() {
    echo ""
    echo "🌐 Starting frontend..."
    
    cd "$PROJECT_DIR/frontend"
    
    if [ ! -d "node_modules" ]; then
        echo "  → Installing dependencies..."
        npm install > /dev/null 2>&1
    fi
    
    # Check if already running
    if lsof -Pi :3000 -sTCP:LISTEN -t > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️ Frontend already running on port 3000${NC}"
    else
        echo "  → Starting frontend on port 3000..."
        npm run dev > /dev/null 2>&1 &
        sleep 3
        echo -e "${GREEN}✅ Frontend started${NC}"
    fi
    
    cd "$PROJECT_DIR"
}

# Print status
print_status() {
    echo ""
    echo "================================="
    echo -e "${GREEN}🎉 All services started!${NC}"
    echo "================================="
    echo ""
    echo "Access the application:"
    echo "  → Frontend: http://localhost:3000"
    echo "  → Backend:  http://localhost:3001"
    echo ""
    echo "VIB Project ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    echo ""
    echo "To stop services:"
    echo "  docker-compose down"
    echo "  pkill -f 'npm run dev'"
}

# Main
main() {
    check_docker
    start_database
    run_migrations
    seed_vib_project
    verify_vib_project
    start_backend
    start_frontend
    print_status
}

main "$@"
