#!/bin/bash

# ============================================
# Start All SEO Tool Workers
# ============================================
# Usage: ./scripts/start-workers.sh [options]
# Options:
#   --all       Start all workers (default)
#   --node      Start only Node.js workers
#   --python    Start only Python workers
#   --stop      Stop all workers
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKERS_DIR="$PROJECT_ROOT/workers"
LOG_DIR="$PROJECT_ROOT/logs/workers"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create log directory
mkdir -p "$LOG_DIR"

# PID file to track running workers
PID_FILE="$LOG_DIR/workers.pid"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Function to start a Node.js worker
start_node_worker() {
    local name=$1
    local dir=$2
    
    if [ -d "$dir" ]; then
        print_info "Starting $name..."
        cd "$dir"
        if [ -f "package.json" ]; then
            npm run dev > "$LOG_DIR/$name.log" 2>&1 &
            echo "$! $name" >> "$PID_FILE"
            print_status "$name started (PID: $!)"
        else
            print_error "$name: package.json not found"
        fi
    else
        print_warning "$name: directory not found, skipping"
    fi
}

# Python executable path (use venv if available)
VENV_PYTHON="$PROJECT_ROOT/.venv/bin/python"
if [ -f "$VENV_PYTHON" ]; then
    PYTHON_BIN="$VENV_PYTHON"
else
    PYTHON_BIN="/usr/local/bin/python3"
fi

# Function to start a Python worker
start_python_worker() {
    local name=$1
    local dir=$2
    local module=$3
    
    if [ -d "$dir" ]; then
        print_info "Starting $name..."
        cd "$dir"
        $PYTHON_BIN -m "$module" > "$LOG_DIR/$name.log" 2>&1 &
        echo "$! $name" >> "$PID_FILE"
        print_status "$name started (PID: $!)"
    else
        print_warning "$name: directory not found, skipping"
    fi
}

# Function to stop all workers
stop_workers() {
    print_info "Stopping all workers..."
    
    if [ -f "$PID_FILE" ]; then
        while read -r line; do
            pid=$(echo "$line" | cut -d' ' -f1)
            name=$(echo "$line" | cut -d' ' -f2-)
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null
                print_status "Stopped $name (PID: $pid)"
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi
    
    # Also kill by port numbers (backup)
    print_info "Cleaning up ports..."
    
    # Common worker ports
    for port in 8001 8002 8003 8004 8005 8006 8007 8008 8009; do
        pid=$(lsof -t -i:$port 2>/dev/null)
        if [ -n "$pid" ]; then
            kill -9 $pid 2>/dev/null
            print_status "Killed process on port $port"
        fi
    done
    
    print_status "All workers stopped"
}

# Function to show worker status
show_status() {
    print_info "Worker Status:"
    echo ""
    
    if [ -f "$PID_FILE" ]; then
        while read -r line; do
            pid=$(echo "$line" | cut -d' ' -f1)
            name=$(echo "$line" | cut -d' ' -f2-)
            if kill -0 "$pid" 2>/dev/null; then
                echo -e "  ${GREEN}●${NC} $name (PID: $pid)"
            else
                echo -e "  ${RED}●${NC} $name (stopped)"
            fi
        done < "$PID_FILE"
    else
        print_warning "No workers running"
    fi
}

# Function to start Node.js workers
start_node_workers() {
    print_info "Starting Node.js workers..."
    echo ""
    
    start_node_worker "content-engine" "$WORKERS_DIR/content_engine"
    start_node_worker "crawler-worker" "$WORKERS_DIR/crawler_worker"
    start_node_worker "cwv-worker" "$WORKERS_DIR/cwv_worker"
    start_node_worker "entity-linking-agent" "$WORKERS_DIR/entity_linking_agent"
    start_node_worker "ga4-worker" "$WORKERS_DIR/ga4_worker"
    start_node_worker "gsc-worker" "$WORKERS_DIR/gsc_worker"
    start_node_worker "technical-seo-agent" "$WORKERS_DIR/technical_seo_agent"
}

# Function to start Python workers
start_python_workers() {
    print_info "Starting Python workers..."
    echo ""
    
    start_python_worker "keyword-intelligence" "$WORKERS_DIR/keyword_intelligence" "src.main"
    start_python_worker "monitoring-agent" "$WORKERS_DIR/monitoring_agent" "monitoring_agent.main"
}

# Function to start all workers
start_all_workers() {
    # Clear old PID file
    rm -f "$PID_FILE"
    
    echo ""
    echo "============================================"
    echo "  Starting All SEO Tool Workers"
    echo "============================================"
    echo ""
    
    start_node_workers
    echo ""
    start_python_workers
    
    echo ""
    echo "============================================"
    print_status "All workers started!"
    echo "============================================"
    echo ""
    print_info "Logs are saved in: $LOG_DIR"
    print_info "To stop all workers: $0 --stop"
    print_info "To view status: $0 --status"
    echo ""
}

# Function to tail all logs
tail_logs() {
    print_info "Tailing all worker logs (Ctrl+C to stop)..."
    tail -f "$LOG_DIR"/*.log
}

# Main script logic
case "${1:-}" in
    --stop)
        stop_workers
        ;;
    --status)
        show_status
        ;;
    --node)
        rm -f "$PID_FILE"
        start_node_workers
        ;;
    --python)
        rm -f "$PID_FILE"
        start_python_workers
        ;;
    --logs)
        tail_logs
        ;;
    --all|"")
        start_all_workers
        ;;
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --all       Start all workers (default)"
        echo "  --node      Start only Node.js workers"
        echo "  --python    Start only Python workers"
        echo "  --stop      Stop all workers"
        echo "  --status    Show worker status"
        echo "  --logs      Tail all worker logs"
        echo "  --help      Show this help"
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac
