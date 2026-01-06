#!/bin/bash
# Build and deploy EZ Platform documentation

set -e

echo "🚀 Building EZ Platform Documentation..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the documentation
echo "🔨 Building documentation site..."
npm run build

# Check if build was successful
if [ ! -d "build" ]; then
  echo "❌ Build failed - build directory not found"
  exit 1
fi

echo "✅ Build completed successfully"

# Deploy options
echo ""
echo "Choose deployment option:"
echo "1. Docker (docker-compose)"
echo "2. Kubernetes (kubectl)"
echo "3. Static hosting (copy build/)"
echo "4. Exit"
read -p "Enter choice [1-4]: " choice

case $choice in
  1)
    echo "🐳 Building Docker image..."
    docker-compose build
    echo "🚀 Starting Docker container..."
    docker-compose up -d
    echo "✅ Documentation available at http://localhost:8080"
    ;;
  2)
    echo "☸️  Building Docker image for Kubernetes..."
    docker build -t ez-platform-docs:latest .
    echo "📤 Loading image to minikube..."
    minikube image load ez-platform-docs:latest
    echo "🚀 Deploying to Kubernetes..."
    kubectl apply -f k8s-deployment.yaml
    echo "⏳ Waiting for deployment..."
    kubectl wait --for=condition=ready pod -l app=docs -n ez-platform-docs --timeout=120s
    echo "✅ Documentation available at http://$(minikube ip):30081"
    ;;
  3)
    echo "📁 Build artifacts are in: ./build"
    echo "📋 Copy the contents to your web server"
    ;;
  4)
    echo "👋 Exiting..."
    exit 0
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "🎉 Deployment completed!"
