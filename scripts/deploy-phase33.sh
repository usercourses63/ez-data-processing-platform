#!/usr/bin/env bash
# Phase-33 full-platform install on minikube. Mirrors release-package/install.ps1
# (RBAC cleanup -> helm install -> MongoDB RS init -> wait) with the minikube override.
set -u
cd "$(dirname "$0")/../release-package" || exit 1
NS=ez-platform

echo "===== [0] tear down any prior (failed) release + namespace (idempotent) ====="
helm uninstall ez-platform -n "$NS" 2>/dev/null || true
kubectl delete namespace "$NS" --ignore-not-found=true --timeout=240s || true

echo "===== [1] RBAC cleanup (cluster-scoped, survives ns delete) ====="
kubectl delete clusterrolebinding nas-device-manager-pv-binding fluent-bit-read --ignore-not-found=true
kubectl delete clusterrole nas-pv-manager fluent-bit-read --ignore-not-found=true

echo "===== [1.5] pre-create namespace with Helm ownership metadata ====="
# The chart ships templates/namespace.yaml (helm-managed), but helm also needs the
# namespace to exist up-front to store its release secret. Pre-create it and stamp the
# Helm adoption labels/annotations so `helm install` adopts it instead of erroring
# "already exists". This sidesteps the --create-namespace vs in-chart-namespace conflict.
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
kubectl label   namespace "$NS" app.kubernetes.io/managed-by=Helm --overwrite
kubectl annotate namespace "$NS" meta.helm.sh/release-name=ez-platform meta.helm.sh/release-namespace="$NS" --overwrite

echo "===== [2] helm install ez-platform (no --create-namespace; ns pre-created+adopted) ====="
helm install ez-platform ./helm/ez-platform \
  --namespace "$NS" \
  -f ./helm/ez-platform/values.yaml \
  -f ./helm/ez-platform/values-dev.yaml \
  -f ./helm/ez-platform/values-phase33-minikube.yaml
hi=$?
if [ $hi -ne 0 ]; then echo "HELM INSTALL FAILED (exit $hi)"; exit $hi; fi

echo "===== [3] wait for mongodb-0 ready (up to 420s) ====="
if ! kubectl wait --for=condition=ready pod/mongodb-0 -n "$NS" --timeout=420s; then
  echo "MONGODB-0 NOT READY"; kubectl get pods -n "$NS"; exit 1
fi

echo "===== [4] initialize MongoDB replica set (single-member rs0) ====="
sleep 3
kubectl exec -n "$NS" mongodb-0 -- mongosh --quiet --eval \
  "try { var s=rs.status(); print('RS already initialized: '+s.set); } catch(e) { rs.initiate({_id:'rs0',members:[{_id:0,host:'mongodb-0.mongodb-service:27017'}]}); print('RS initiated'); }"

echo "===== [5] wait for all pods ready (up to 900s, non-fatal) ====="
if kubectl wait --for=condition=ready pod --all -n "$NS" --timeout=900s; then
  echo "ALL PODS READY"
else
  echo "[WARN] some pods not ready (expected: mongodb-1/2 are not in the RS):"
  kubectl get pods -n "$NS" --no-headers | grep -v -E "Running|Completed" || true
fi

echo "===== final pod status ====="
kubectl get pods -n "$NS" -o wide
