#!/bin/bash
# Complete EZ Platform Deployment Script
# Week 2: Day 7
# Run this after K8s cluster is ready
#
# ⚠️  LEGACY SCRIPT WARNING ⚠️
# This bash script is maintained for Linux compatibility only.
# For Windows deployments, use the PowerShell version: deploy-all.ps1
# PowerShell scripts are the primary and recommended deployment method.
#

set -e

echo "======================================"
echo "EZ Platform - K8s Deployment"
echo "Week 2: Day 7"
echo "======================================"
echo ""

# Navigate to k8s directory
cd "$(dirname "$0")"

echo "Step 1: Creating namespace..."
kubectl apply -f namespace.yaml
echo "✅ Namespace created"
echo ""

echo "Step 2: Deploying ConfigMaps and PVCs..."
kubectl apply -f configmaps/services-config.yaml
kubectl apply -f deployments/data-pvcs.yaml
echo "✅ Configuration deployed"
echo ""

echo "Step 3: Deploying MongoDB (3-node replica set)..."
kubectl apply -f infrastructure/mongodb-statefulset.yaml
echo "⏳ Waiting for MongoDB to be ready..."
kubectl wait --for=condition=ready pod -l app=mongodb -n ez-platform --timeout=300s
echo "✅ MongoDB ready"
echo ""

echo "Step 4: Deploying Kafka (3-node cluster + ZooKeeper)..."
kubectl apply -f infrastructure/kafka-statefulset.yaml
echo "⏳ Waiting for Kafka to be ready..."
kubectl wait --for=condition=ready pod -l app=kafka -n ez-platform --timeout=300s
echo "✅ Kafka ready"
echo ""

echo "Step 5: Deploying Hazelcast (3-node distributed cache)..."
kubectl apply -f infrastructure/hazelcast-statefulset.yaml
echo "⏳ Waiting for Hazelcast to be ready..."
kubectl wait --for=condition=ready pod -l app=hazelcast -n ez-platform --timeout=300s
echo "✅ Hazelcast ready"
echo ""

echo "Step 6: Deploying all 9 microservices..."
kubectl apply -f deployments/
kubectl apply -f services/all-services.yaml
echo "⏳ Waiting for all services to be ready..."
kubectl wait --for=condition=ready pod --all -n ez-platform --timeout=600s
echo "✅ All services deployed"
echo ""

echo "======================================"
echo "Deployment Complete!"
echo "======================================"
echo ""

echo "Verifying deployment..."
kubectl get pods -n ez-platform
echo ""
kubectl get svc -n ez-platform
echo ""

echo "======================================"
echo "✅ EZ Platform is now running in Kubernetes!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Check pod status: kubectl get pods -n ez-platform"
echo "2. View logs: kubectl logs -f deployment/filediscovery -n ez-platform"
echo "3. Access Frontend: kubectl get svc frontend -n ez-platform"
echo ""
