# EZ Platform v0.1.1-rc1 - Production Readiness Update

**Release Date:** January 1, 2026
**Release Type:** Release Candidate 1
**Package Size:** 4.0GB (compressed)
**Commits:** 20 commits since v0.1.0-beta

---

## 🎉 What's New

### Major Features

#### 1. Swagger/OpenAPI Documentation
- ✅ Interactive API documentation added to all 8 backend services
- ✅ Swagger UI accessible at `/swagger` endpoint on each service
- ✅ OpenAPI 3.0 specification with full endpoint documentation
- ✅ Services: DataSourceManagement, FileDiscovery, FileProcessor, Validation, Output, InvalidRecords, Scheduling, MetricsConfiguration

**Access Swagger UI:**
```bash
kubectl port-forward svc/datasource-management 5001:5001 -n ez-platform
# Open: http://localhost:5001/swagger
```

#### 2. Frontend Branding & UX
- ✅ EZ Platform branded splash screen on app startup
- ✅ Logo integration in application header (ez-platform-logo.svg)
- ✅ Hebrew and English translations for all branding elements
- ✅ Professional polish for production deployment

#### 3. Production Configuration Improvements
- ✅ Fixed MetricsConfigurationService health checks (increased timeouts)
- ✅ Added `database-name` to services-config ConfigMap for consistency
- ✅ Updated nginx.conf with correct API v1 endpoint routing
- ✅ Changed imagePullPolicy to `Never` for offline deployment compatibility

---

## 🔧 Critical Fixes

### Configuration Updates
- **MetricsConfigurationService Health Checks:**
  - Liveness probe: 30s → 60s (allows MongoDB connection time)
  - Readiness probe: 15s → 30s (production stability)
  - Added failureThreshold and timeoutSeconds
  - **Impact:** Service now starts reliably without restart loops

- **services-config.yaml:**
  - Added `database-name: "ezplatform"` key
  - **Impact:** Ensures all services use consistent database name

- **nginx.conf Routing:**
  - Fixed API proxy routes to use `/api/v1/` prefix correctly
  - Added proper proxy headers for request forwarding
  - Added `/docs/` location for markdown file serving
  - **Impact:** Frontend can now communicate with backend services

### Frontend Fixes
- **Documentation Loading:** Fixed USER-GUIDE-HE.md not loading in help page
- **Error Parser:** Enhanced Corvus error parser for field name extraction and Hebrew translation
- **Docker Build:** Explicit copy of documentation files to container

### Backend Fixes
- **DemoDataGenerator:** Converted error messages to Corvus.Json.Validator format
- **All Services:** Swagger endpoints configured on `/swagger` path (not root)

---

## 📦 Services Requiring Update

### Updated Docker Images (9 services)

All backend services now include Swagger integration:

1. **datasource-management:v0.1.1-rc1** - Added Swagger packages and configuration
2. **filediscovery:v0.1.1-rc1** - Enabled Swagger endpoint
3. **fileprocessor:v0.1.1-rc1** - Enabled Swagger endpoint
4. **validation:v0.1.1-rc1** - Enabled Swagger endpoint
5. **output:v0.1.1-rc1** - Added Swagger packages and configuration
6. **invalidrecords:v0.1.1-rc1** - Enabled Swagger endpoint
7. **scheduling:v0.1.1-rc1** - Enabled Swagger endpoint
8. **metrics-configuration:v0.1.1-rc1** - **CRITICAL** - Config and health check fixes
9. **frontend:v0.1.1-rc1** - **CRITICAL** - Splash screen, logo, nginx routing fixes

### Updated Documentation Image

10. **ezplatform-docs:v0.1.1-rc1** - Includes deployment plan and updated docs

### Infrastructure Services (No Changes)
All infrastructure images remain at their current stable versions:
- mongo:8.0, rabbitmq:3-management-alpine, kafka:7.5.0, hazelcast:5.6, etc.

---

## 📥 Installation

### Download Package

**Release Package:** [ezplatform-v0.1.1-rc1-offline-package.tar.gz](https://github.com/usercourses63/ez-data-processing-platform/releases/download/v0.1.1-rc1/ezplatform-v0.1.1-rc1-offline-package.tar.gz) (4.0GB)

**Checksum (SHA256):**
```
1a6dc855003804f082ba2bafa6803f18a47317a6569164b8f398246aac408109
```

### Quick Installation

```bash
# 1. Extract package
tar -xzf ezplatform-v0.1.1-rc1-offline-package.tar.gz
cd release-package/

# 2. Load Docker images (5-10 minutes)
cd images/
for img in *.tar.gz; do gunzip -c "$img" | docker load; done
for img in *.tar; do docker load -i "$img"; done

# 3. Deploy with Helm (5 minutes)
cd ../
chmod +x install.sh
./install.sh

# 4. Verify deployment
kubectl get pods -n ez-platform
# All pods should be Running

# 5. Access frontend
# Get node IP: kubectl get nodes -o wide
# URL: http://<NODE-IP>:30080
```

### Detailed Installation

See comprehensive guides in the package:
- **Quick Start:** `release-package/README.md`
- **Complete Deployment Plan:** `release-package/Deployment Plan v0.1.1-rc1.md`
- **Helm Installation:** `release-package/docs/docs/installation/helm-installation.md`

---

## 📖 Documentation

All documentation included in the package:

- **Installation Guide:** Standard and Helm installation procedures
- **Admin Guide:** System administration and maintenance
- **User Guide (Hebrew):** מדריך משתמש מלא בעברית
- **Architecture Documentation:** System design and data flow (English + Hebrew)
- **Deployment Plan v0.1.1:** Comprehensive offline deployment guide
- **Release Notes:** This document
- **Changelog:** Detailed version history
- **API Documentation:** Swagger UI on all backend services

---

## 🔄 Upgrade from v0.1.0-beta

### Compatibility

- **Backward Compatible:** ✅ Yes
- **Breaking Changes:** ❌ None
- **Migration Required:** ❌ No (clean deployment recommended)
- **Data Migration:** ❌ Not required

### Upgrade Steps

**Option 1: Clean Installation (Recommended)**
```bash
# Uninstall old version
helm uninstall ez-platform -n ez-platform

# Load new images
cd release-package/images
for img in *v0.1.1-rc1.tar.gz; do gunzip -c "$img" | docker load; done

# Install new version
cd ../
./install.sh
```

**Option 2: In-Place Upgrade**
```bash
# Update images
cd release-package/images
for img in *v0.1.1-rc1.tar.gz; do gunzip -c "$img" | docker load; done

# Upgrade with Helm
helm upgrade ez-platform ./helm/ez-platform \
  --namespace ez-platform \
  --reuse-values
```

### Configuration Changes

1. **New ConfigMap Key:** `database-name: "ezplatform"`
2. **Updated Probe Timings:** MetricsConfigurationService (longer timeouts)
3. **Updated nginx Configuration:** Correct API v1 routing

---

## ⚠️ Known Issues & Limitations

This is a Release Candidate for testing. The following limitations from v0.1.0-beta still apply:

### Testing Gaps (Non-Blocking)
- Multiple file formats (XML, Excel) not fully E2E tested
- High load testing (10,000+ records) not completed
- Multi-destination scaling (4+ destinations) not verified

**Recommendation:** Test these scenarios in your environment before production use

### Production Hardening Required
Before production deployment, address:
1. **Jaeger Persistence:** Configure Elasticsearch backend (currently in-memory)
2. **Grafana Credentials:** Move to Kubernetes Secret (currently hardcoded)
3. **Elasticsearch Security:** Enable x-pack.security=true

See: `docs/testing/E2E-GAP-ANALYSIS-REPORT.md` (included in package)

---

## 🆕 New API Documentation

All backend services now include Swagger/OpenAPI documentation:

### Available Swagger Endpoints

After deployment, access via port-forward:

| Service | Port | Swagger URL |
|---------|------|-------------|
| DataSourceManagement | 5001 | http://localhost:5001/swagger |
| FileDiscovery | 5004 | http://localhost:5004/swagger |
| FileProcessor | 5008 | http://localhost:5008/swagger |
| Validation | 5003 | http://localhost:5003/swagger |
| Output | 5009 | http://localhost:5009/swagger |
| InvalidRecords | 5006 | http://localhost:5006/swagger |
| Scheduling | 5005 | http://localhost:5005/swagger |
| MetricsConfiguration | 5002 | http://localhost:5002/swagger |

**Setup port-forward:**
```bash
kubectl port-forward svc/<service-name> <port>:<port> -n ez-platform
```

---

## 📊 Technical Details

### Commits Since v0.1.0-beta

20 commits across 38 files:
- Swagger integration (8 backend services)
- Frontend branding components
- Configuration fixes
- Documentation updates
- Deployment package preparation

### Modified Components

- **38 source files** modified
- **27 configuration files** updated
- **10 Docker images** rebuilt
- **1 Helm chart** updated (v1.1.0)

### Package Contents

```
ezplatform-v0.1.1-rc1-offline-package.tar.gz (4.0GB)
└── release-package/
    ├── images/              # 21 Docker images
    ├── k8s/                 # Kubernetes manifests
    ├── helm/                # Helm chart v1.1.0
    ├── docs/                # MkDocs documentation site
    ├── scripts/             # Installation utilities
    ├── install.sh           # Automated installation
    └── Deployment Plan v0.1.1-rc1.md  # Complete guide
```

---

## 🔒 Security & Verification

### Package Integrity

**SHA256 Checksum:**
```
1a6dc855003804f082ba2bafa6803f18a47317a6569164b8f398246aac408109
```

**Verify after download:**
```bash
sha256sum -c ezplatform-v0.1.1-rc1-offline-package.sha256
```

### Security Notes

- All services run as non-root in containers
- Network policies can be applied (not included in default deployment)
- Secrets management: Use Kubernetes Secrets for production
- TLS/SSL: Configure ingress for HTTPS in production

---

## 💡 Support & Resources

### Documentation

- **Deployment Plan:** Comprehensive offline deployment guide included
- **Installation Guide:** Step-by-step instructions
- **Admin Guide:** System administration procedures
- **User Guide (Hebrew):** Complete user documentation

### Troubleshooting

Common issues and solutions documented in:
- Deployment Plan (Section 8.4)
- Installation Guide
- Admin Guide

### Getting Help

- **Issues:** [GitHub Issues](https://github.com/usercourses63/ez-data-processing-platform/issues)
- **Documentation:** Included in release package
- **API Reference:** Swagger UI on each service

---

## 📝 Changelog

See complete changelog in package: `release-package/docs/docs/changelog.md`

### Added
- Swagger/OpenAPI documentation to all backend services
- Frontend splash screen with EZ Platform branding
- EZ Platform logo in SVG format
- Hebrew and English translations for branding elements
- database-name ConfigMap key for consistent database naming
- Deployment plan documentation in MkDocs site

### Changed
- Updated nginx.conf with correct `/api/v1/` API routing
- Increased MetricsConfigurationService health check timeouts
- Changed imagePullPolicy to Never for offline deployment
- Enhanced frontend Docker build with explicit documentation copy

### Fixed
- MetricsConfigurationService MongoDB connection configuration
- USER-GUIDE-HE.md not loading in frontend help page
- Frontend API routing to backend services
- Corvus error parser field name extraction

---

## 🚀 Next Steps

1. **Download:** Get the offline package from GitHub Releases
2. **Verify:** Check SHA256 checksum
3. **Transfer:** Copy to offline LAN via approved method
4. **Extract:** Unpack the package
5. **Deploy:** Run `./install.sh` or follow deployment plan
6. **Verify:** Check all pods running and services accessible
7. **Test:** Validate with your data and use cases

---

**Full Deployment Guide:** See `Deployment Plan v0.1.1-rc1.md` in the release package

**Previous Release:** [v0.1.0-beta](https://github.com/usercourses63/ez-data-processing-platform/releases/tag/v0.1.0-beta)

---

🤖 **This release was prepared with Claude Code**

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>
