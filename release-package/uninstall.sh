#!/bin/bash
# EZ Platform Uninstallation Script
# Version: 0.1.1-rc1
# Date: January 1, 2026
#
# ⚠️  LEGACY SCRIPT WARNING ⚠️
# This bash script is maintained for Linux compatibility only.
# For Windows deployments, use the PowerShell version: uninstall.ps1
# PowerShell scripts are the primary and recommended installation method.
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=========================================="
echo "  EZ Platform v0.1.1-rc1 Uninstallation"
echo "=========================================="
echo ""

# Parse arguments
NAMESPACE="ez-platform"
DELETE_NAMESPACE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --delete-namespace)
            DELETE_NAMESPACE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -n, --namespace NAME    Kubernetes namespace (default: ez-platform)"
            echo "  --delete-namespace      Also delete the namespace after uninstall"
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

# Confirm uninstallation
echo -e "${YELLOW}⚠️  This will uninstall EZ Platform from namespace: $NAMESPACE${NC}"
if [ "$DELETE_NAMESPACE" = true ]; then
    echo -e "${RED}⚠️  The namespace will also be DELETED including all PVCs and data!${NC}"
fi
echo ""
read -p "Are you sure? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
    echo "Uninstallation cancelled."
    exit 0
fi

# Uninstall
echo "Uninstalling EZ Platform..."
if helm uninstall ez-platform -n $NAMESPACE; then
    echo -e "${GREEN}✓${NC} Helm release uninstalled"
else
    echo -e "${YELLOW}⚠️  Helm release not found or already uninstalled${NC}"
fi

# Delete namespace if requested
if [ "$DELETE_NAMESPACE" = true ]; then
    echo ""
    echo "Deleting namespace $NAMESPACE..."
    if kubectl delete namespace $NAMESPACE --timeout=60s; then
        echo -e "${GREEN}✓${NC} Namespace deleted"
    else
        echo -e "${YELLOW}⚠️  Failed to delete namespace${NC}"
    fi
fi

echo ""
echo -e "${GREEN}=========================================="
echo "  Uninstallation Complete!"
echo "==========================================${NC}"
echo ""
