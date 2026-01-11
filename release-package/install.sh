#!/bin/bash
# EZ Platform Installation Script
# Version: 0.1.1-rc1
# Date: January 1, 2026
#
# ⚠️  LEGACY SCRIPT WARNING ⚠️
# This bash script is maintained for Linux compatibility only.
# For Windows deployments, use the PowerShell version: install.ps1
# PowerShell scripts are the primary and recommended installation method.
#

set -e

echo "=========================================="
echo "  EZ Platform v0.1.1-rc1 Installation"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Prerequisites check
echo "Checking prerequisites..."

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl not found. Please install kubectl first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} kubectl found"

# Check helm
if ! command -v helm &> /dev/null; then
    echo -e "${RED}❌ Helm not found. Please install Helm 3.8+ first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Helm found"

# Check cluster connection
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ Cannot connect to Kubernetes cluster. Please configure kubectl.${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Kubernetes cluster accessible"

echo ""
echo "Prerequisites check passed!"
echo ""

# Parse arguments
NAMESPACE="ez-platform"
VALUES_FILE=""
WAIT_TIMEOUT="15m"

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -f|--values)
            VALUES_FILE="$2"
            shift 2
            ;;
        -t|--timeout)
            WAIT_TIMEOUT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -n, --namespace NAME    Kubernetes namespace (default: ez-platform)"
            echo "  -f, --values FILE       Custom values.yaml file"
            echo "  -t, --timeout DURATION  Wait timeout (default: 15m)"
            echo "  -h, --help              Show this help"
            echo ""
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Installation
echo "Installing EZ Platform to namespace: $NAMESPACE"
echo ""

# Build helm install command
HELM_CMD="helm install ez-platform ./helm/ez-platform --namespace $NAMESPACE --create-namespace --wait --timeout $WAIT_TIMEOUT"

if [ -n "$VALUES_FILE" ]; then
    HELM_CMD="$HELM_CMD --values $VALUES_FILE"
    echo "Using custom values from: $VALUES_FILE"
fi

echo "Running: $HELM_CMD"
echo ""

# Execute installation
if eval $HELM_CMD; then
    echo ""
    echo -e "${GREEN}=========================================="
    echo "  Installation Successful!"
    echo "==========================================${NC}"
    echo ""

    # Show deployment status
    echo "Deployment Status:"
    kubectl get pods -n $NAMESPACE
    echo ""

    # Show services
    echo "Services:"
    kubectl get svc -n $NAMESPACE
    echo ""

    # Get frontend access
    echo -e "${YELLOW}Access Instructions:${NC}"
    echo ""
    echo "1. Via Port-Forward (localhost):"
    echo "   kubectl port-forward svc/frontend 3000:80 -n $NAMESPACE"
    echo "   Then open: http://localhost:3000"
    echo ""
    echo "2. Via LoadBalancer (if available):"
    echo "   kubectl get svc frontend -n $NAMESPACE"
    echo ""
    echo "3. Monitoring Dashboards:"
    echo "   Grafana:    kubectl port-forward svc/grafana 3001:3000 -n $NAMESPACE"
    echo "   Prometheus: kubectl port-forward svc/prometheus-system 9090:9090 -n $NAMESPACE"
    echo "   Jaeger:     kubectl port-forward svc/jaeger 16686:16686 -n $NAMESPACE"
    echo ""

else
    echo ""
    echo -e "${RED}=========================================="
    echo "  Installation Failed!"
    echo "==========================================${NC}"
    echo ""
    echo "Check the error messages above and try again."
    echo ""
    echo "For troubleshooting:"
    echo "  helm status ez-platform -n $NAMESPACE"
    echo "  kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp'"
    echo ""
    exit 1
fi
