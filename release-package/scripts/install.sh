#!/bin/bash
# Install EZ Platform v0.1.0-beta
# Complete installation script for offline deployment
#
# ⚠️  LEGACY SCRIPT WARNING ⚠️
# This bash script is maintained for Linux compatibility only.
# For Windows deployments, use the PowerShell version in parent directory.
# PowerShell scripts are the primary and recommended installation method.
#

set -e

echo "EZ Platform v0.1.0-beta Installation"
echo "====================================="
echo ""

# Prerequisites check
echo "Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ docker not found. Please install Docker first."
    exit 1
fi

echo "✅ kubectl found: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"
echo "✅ docker found: $(docker --version)"
echo ""

# Load images
echo "Step 1: Loading Docker images (21 images, ~4GB)..."
echo "This may take 5-10 minutes..."
./scripts/load-images.sh

if [ $? -ne 0 ]; then
    echo "❌ Failed to load images"
    exit 1
fi

echo ""
echo "Step 2: Creating namespace..."
kubectl create namespace ez-platform --dry-run=client -o yaml | kubectl apply -f -
echo "✅ Namespace created"

echo ""
echo "Step 3: Deploying infrastructure (MongoDB, Kafka, RabbitMQ, etc.)..."
kubectl apply -f k8s/infrastructure/
echo "✅ Infrastructure deployed"

echo ""
echo "Waiting for MongoDB to be ready (may take 2-3 minutes)..."
kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s

echo "Waiting for Kafka to be ready..."
kubectl wait --for=condition=ready pod -l app=kafka -n ez-platform --timeout=300s

echo ""
echo "Step 4: Deploying ConfigMaps..."
kubectl apply -f k8s/configmaps/
echo "✅ ConfigMaps deployed"

echo ""
echo "Step 5: Deploying services..."
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/
echo "✅ Services deployed"

echo ""
echo "Waiting for services to be ready..."
sleep 30

echo ""
echo "Step 6: Verifying deployment..."
kubectl get pods -n ez-platform

echo ""
echo "====================================="
echo "Installation Complete!"
echo "====================================="
echo ""
echo "Access URLs:"
echo "  Frontend: http://<NODE-IP>:30080"
echo "  Get node IP: kubectl get nodes -o wide"
echo ""
echo "Default credentials:"
echo "  Grafana: admin / EZPlatform2025!Beta"
echo "  RabbitMQ: guest / guest"
echo ""
echo "Next steps:"
echo "1. Get node IP: kubectl get nodes -o wide"
echo "2. Access frontend: http://<NODE-IP>:30080"
echo "3. View docs: Deploy ezplatform-docs container"
echo ""
echo "For detailed documentation, see docs/ directory or deploy MkDocs site."
