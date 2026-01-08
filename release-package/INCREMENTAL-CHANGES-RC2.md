# EZ Platform v0.1.1-rc2 Incremental Changes

## What's New in RC2

This incremental package contains ONLY the changes from v0.1.1-rc1 to v0.1.1-rc2.

### Frontend Enhancements
- **Fixed API connectivity**: Frontend now uses nginx proxy with relative URLs
- **Production-ready**: Removed hardcoded localhost URLs
- **Updated image**: ez-platform/frontend:v0.1.1-rc2

### Documentation Updates
- **Docusaurus portal**: Latest documentation with OCP compatibility guide
- **Updated docs image**: ez-platform/docs-docusaurus:v0.1.1-rc2
- **Production deployment**: Added API configuration documentation

### Changed Files

#### Docker Images (release-package/images/)
- frontend-v0.1.1-rc2.tar (26MB) - NEW
- docs-docusaurus-v0.1.1-rc2.tar (24MB) - NEW

#### Kubernetes Manifests
- k8s/deployments/frontend-deployment.yaml - Updated image reference
- k8s/services/frontend-nodeport.yaml - No changes

#### Documentation
- docs-docusaurus/ - Complete latest documentation
- PRODUCTION-FILE-LIST.md - Added production API configuration section
- DEPLOYMENT-TROUBLESHOOTING-GUIDE.md - Updated with OCP fixes (v2.0)

### Installation Instructions

1. Extract this package over your existing v0.1.1-rc1 installation
2. Load new Docker images:
   ```powershell
   minikube image load release-package/images/frontend-v0.1.1-rc2.tar
   minikube image load release-package/images/docs-docusaurus-v0.1.1-rc2.tar
   ```

3. Apply updated manifests:
   ```powershell
   kubectl apply -f release-package/k8s/deployments/frontend-deployment.yaml
   kubectl rollout restart deployment/frontend deployment/docs-docusaurus -n ez-platform
   ```

4. Verify deployment:
   ```powershell
   kubectl get pods -n ez-platform
   ```

### File Size Comparison
- Full RC1 package: 4.0GB
- RC2 incremental: ~50MB (99% smaller)

### Changelog
See CHANGELOG.md for complete details.

