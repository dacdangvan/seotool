#!/bin/bash

# Database Setup Script for AI SEO Tool
# This script sets up PostgreSQL and runs migrations + seeds

set -e

echo "🚀 Starting database setup..."

# Default values (can be overridden by environment variables)
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-ai_seo_tool}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}

# Export for psql
export PGPASSWORD=$DB_PASSWORD

echo "📦 Database: $DB_NAME on $DB_HOST:$DB_PORT"

# Check if database exists
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "✅ Database '$DB_NAME' already exists"
else
    echo "📝 Creating database '$DB_NAME'..."
    createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
    echo "✅ Database created"
fi

# Run migrations
echo "🔄 Running migrations..."

for migration in $(ls -1 ./database/migrations/*.sql | sort); do
    echo "  → Running $migration..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration"
done

echo "✅ Migrations complete"

# Run seeds
echo "🌱 Running seeds..."

for seed in $(ls -1 ./database/seeds/*.sql | sort); do
    echo "  → Running $seed..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$seed"
done

echo "✅ Seeds complete"

echo ""
echo "🎉 Database setup finished!"
echo ""
echo "Connection details:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
