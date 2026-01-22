#!/bin/bash

# Deployment script for YFinance Predictor

echo "🚀 Starting deployment..."

# Check if deployment target is specified
if [ -z "$1" ]; then
    echo "Usage: ./deploy.sh [heroku|gcloud|local]"
    exit 1
fi

TARGET=$1

case $TARGET in
    heroku)
        echo "📦 Deploying to Heroku..."
        
        # Check if Heroku CLI is installed
        if ! command -v heroku &> /dev/null; then
            echo "❌ Heroku CLI not found. Please install it first."
            exit 1
        fi
        
        # Check if git repo exists
        if [ ! -d .git ]; then
            echo "Initializing git repository..."
            git init
            git add .
            git commit -m "Initial commit"
        fi
        
        # Create Heroku app if needed
        if ! heroku apps:info &> /dev/null; then
            echo "Creating Heroku app..."
            heroku create
        fi
        
        # Deploy
        git push heroku Test:main
        
        echo "✅ Deployed to Heroku!"
        heroku open
        ;;
        
    gcloud)
        echo "☁️  Deploying to Google Cloud Run..."
        
        # Check if gcloud is installed
        if ! command -v gcloud &> /dev/null; then
            echo "❌ Google Cloud SDK not found. Please install it first."
            exit 1
        fi
        
        # Get project ID
        PROJECT_ID=$(gcloud config get-value project)
        
        if [ -z "$PROJECT_ID" ]; then
            echo "❌ No project set. Run: gcloud config set project YOUR_PROJECT_ID"
            exit 1
        fi
        
        echo "Building container for project: $PROJECT_ID"
        
        # Build and deploy
        gcloud builds submit --tag gcr.io/$PROJECT_ID/yfinance-predictor
        
        gcloud run deploy yfinance-predictor \
            --image gcr.io/$PROJECT_ID/yfinance-predictor \
            --platform managed \
            --region us-central1 \
            --allow-unauthenticated \
            --port 5000 \
            --memory 512Mi
        
        echo "✅ Deployed to Google Cloud Run!"
        ;;
        
    local)
        echo "💻 Starting local server..."
        
        # Check if Python is installed
        if ! command -v python3 &> /dev/null; then
            echo "❌ Python 3 not found. Please install it first."
            exit 1
        fi
        
        # Create virtual environment if it doesn't exist
        if [ ! -d venv ]; then
            echo "Creating virtual environment..."
            python3 -m venv venv
        fi
        
        # Activate virtual environment
        source venv/bin/activate
        
        # Install dependencies
        echo "Installing dependencies..."
        pip install -r requirements.txt
        
        # Create data directory
        mkdir -p data
        
        # Run the app
        echo "✅ Starting server on http://localhost:5000"
        python app.py
        ;;
        
    *)
        echo "❌ Unknown target: $TARGET"
        echo "Usage: ./deploy.sh [heroku|gcloud|local]"
        exit 1
        ;;
esac
