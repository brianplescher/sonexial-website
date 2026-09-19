#!/bin/bash

# Sonexial Quick Start Script
# This script sets up and runs the Sonexial backend for local development

set -e

echo "🚀 Sonexial Backend Quick Start"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "sonexial/.env.example" ]; then
    echo "❌ Error: Please run this script from the /workspace directory"
    exit 1
fi

cd sonexial

# Step 1: Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    
    # Generate a random secret key
    SECRET_KEY=$(openssl rand -hex 32)
    OPS_TOKEN=$(openssl rand -hex 16)
    
    # Update the .env file with generated secrets
    sed -i.bak "s/SECRET_KEY=change-me-in-production-min-32-chars/SECRET_KEY=$SECRET_KEY/" .env
    sed -i.bak "s/OPS_BEARER_TOKEN=change-me-ops-token/OPS_BEARER_TOKEN=$OPS_TOKEN/" .env
    sed -i.bak "s|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sonexial|DATABASE_URL=sqlite:///./sonexial.db|" .env
    rm .env.bak 2>/dev/null || true
    
    echo "✅ .env file created with secure defaults"
else
    echo "✅ .env file already exists"
fi

# Step 2: Check Python dependencies
echo ""
echo "📦 Checking Python dependencies..."
if ! python -c "import fastapi" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -q -e .
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

# Step 3: Initialize database
echo ""
echo "🗄️  Initializing database..."
python -c "from app.core.db import init_db; init_db()" 2>/dev/null || {
    echo "Note: Database initialization skipped (may need manual setup)"
}
echo "✅ Database ready"

# Step 4: Start the API server
echo ""
echo "🌐 Starting Sonexial API server on http://localhost:8000"
echo "   Press Ctrl+C to stop"
echo ""
echo "💡 Next steps:"
echo "   1. Open your website in a browser"
echo "   2. Scroll to the 'Free GEO Audit for Authors' section"
echo "   3. Enter an author website URL and click 'Run Free Audit'"
echo ""
echo "📖 For more details, see SETUP_INSTRUCTIONS.md"
echo ""

# Start the server
exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
