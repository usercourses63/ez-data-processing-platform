# EZ Platform v0.1.1 - Offline Deployment Update Plan

**Current Version:** v0.1.0-beta (Tag: `7f96ca1`, Dec 30, 2025)
**Target Version:** v0.1.1-rc1 (Release Candidate 1)
**Commits Since Tag:** 17 commits (Dec 30-31, 2025)
**Modified Files:** 38 files across deployment, config, source code

---

## Executive Summary

This plan covers:
1. **Updated Git tags** for all 17 commits after v0.1.0-beta
2. **Comprehensive change report** - what changed in deployment, configs, YAMLs
3. **release-package folder analysis** - every file that needs updating
4. **Docker image rebuild strategy** - 9 services require new images
5. **Complete deployment update** - env vars, ConfigMaps, mounts, scripts, documentation

---

## 1. Git Tagging & Release Strategy

### 1.1 Create New Version Tag

**Tag Name:** `v0.1.1-rc1` (Release Candidate 1)

**Rationale for version bump:**
- **Swagger/OpenAPI added** to all 8 backend services
- **Critical config fix** for MetricsConfigurationService
- **Frontend enhancements** (splash screen, logo, routing fixes)
- **Bug fixes** (documentation loading, error message format)

**Tagging Command:**
```bash
git tag -a v0.1.1-rc1 -m "Release Candidate 1: Swagger integration, frontend enhancements, config fixes

Changes since v0.1.0-beta:
- Added Swagger/OpenAPI documentation to all backend services
- Fixed MetricsConfigurationService health checks and configuration
- Enhanced frontend with splash screen and EZ Platform branding
- Updated nginx routing for API v1 endpoints
- Fixed documentation loading in frontend Docker image
- Added database-name to services-config ConfigMap
- Standardized error messages to Corvus format"

git push origin v0.1.1-rc1
```

### 1.2 Update GitHub Release

**Release Title:** `EZ Platform v0.1.1-rc1 - Production Readiness Update`

**Release Notes:**

```markdown
## EZ Platform v0.1.1-rc1 Release Candidate

**Release Date:** January 1, 2026
**Commits:** 17 commits since v0.1.0-beta
**Docker Images:** 9 updated images (8 backend + 1 frontend)

---

## What's New

### 🎉 Major Features

1. **Swagger/OpenAPI Documentation** (All Backend Services)
   - Interactive API documentation at `/swagger` endpoint
   - OpenAPI 3.0 specification
   - Services: DataSourceManagement, FileDiscovery, FileProcessor, Validation, Output, InvalidRecords, Scheduling, MetricsConfiguration

2. **Frontend Branding** (Frontend Service)
   - EZ Platform logo and splash screen
   - Enhanced application header
   - Hebrew and English translations for branding elements

3. **Production Configuration Improvements**
   - Fixed MetricsConfigurationService health checks (increased timeouts)
   - Added database-name to services-config ConfigMap
   - Updated nginx.conf with correct API v1 endpoint routing

---

## Critical Fixes

### Configuration Updates
- ✅ **MetricsConfigurationService:** Fixed MongoDB connection and health check configuration
- ✅ **services-config.yaml:** Added `database-name: "ezplatform"` for consistent database naming
- ✅ **nginx.conf:** Updated API proxy routes to use `/api/v1/` prefix correctly

### Frontend Fixes
- ✅ Fixed documentation (USER-GUIDE-HE.md) not loading in frontend help page
- ✅ Enhanced Corvus error parser for proper field name extraction and translation
- ✅ Added logo asset (ez-platform-logo.svg)

### Backend Fixes
- ✅ DemoDataGenerator: Converted error messages to Corvus format for frontend consistency
- ✅ All services: Enabled Swagger on `/swagger` path (not root)

---

## Services Requiring Docker Image Rebuild

### Backend Services (8 images)
1. `datasource-management:v0.1.1-rc1` - Added Swagger packages and configuration
2. `filediscovery:v0.1.1-rc1` - Enabled Swagger endpoint
3. `fileprocessor:v0.1.1-rc1` - Enabled Swagger endpoint
4. `validation:v0.1.1-rc1` - Enabled Swagger endpoint
5. `output:v0.1.1-rc1` - Added Swagger packages and configuration
6. `invalidrecords:v0.1.1-rc1` - Enabled Swagger endpoint
7. `scheduling:v0.1.1-rc1` - Enabled Swagger endpoint
8. `metrics-configuration:v0.1.1-rc1` - **CRITICAL** - Configuration and health check fixes

### Frontend Service (1 image)
9. `frontend:v0.1.1-rc1` - **CRITICAL** - Splash screen, logo, nginx.conf routing fixes

---

## Infrastructure Services (No Changes)

These images remain at their current versions (no rebuild needed):
- mongo:8.0
- rabbitmq:3-management-alpine
- confluentinc/cp-kafka:7.5.0
- confluentinc/cp-zookeeper:7.5.0
- hazelcast/hazelcast:5.6
- docker.elastic.co/elasticsearch/elasticsearch:8.17.0
- prom/prometheus:latest
- grafana/grafana:latest
- jaegertracing/all-in-one:latest
- otel/opentelemetry-collector-contrib:latest
- fluent/fluent-bit:latest

---

## Installation

See updated INSTALLATION.md in the release package.

**Quick Start:**
```bash
# Extract package
tar -xzf ezplatform-v0.1.1-rc1.tar.gz
cd ezplatform-v0.1.1-rc1

# Load images
./scripts/load-images.sh

# Install with Helm
./install.sh
```

---

## Documentation

- 📖 Installation Guide: `docs/docs/installation.md`
- 🔧 Admin Guide: `docs/docs/admin.md`
- 🇮🇱 Hebrew User Guide: `docs/docs/user-guide-he.md`
- 🏗️ Architecture: `docs/docs/architecture/`
- 📝 API Documentation: Swagger UI at `/swagger` on each service

---

## Known Issues & Limitations (Beta Status)

⚠️ This is still a **Release Candidate** for testing:

1. **E2E Test Gaps** (from v0.1.0-beta still apply):
   - Multiple file formats (XML, Excel) not fully tested
   - High load testing (10,000+ records) incomplete
   - Multi-destination scaling (4+ destinations) not verified

2. **Production Hardening** (remaining from v0.1.0-beta):
   - Jaeger persistence: In-memory only (needs Elasticsearch backend)
   - Grafana credentials: Hardcoded (needs K8s Secret)
   - Elasticsearch security: Disabled (needs x-pack.security=true)

See: `docs/testing/E2E-GAP-ANALYSIS-REPORT.md`

---

## Upgrade from v0.1.0-beta

**Backward Compatible:** Yes (no breaking changes)

**Upgrade Steps:**
1. Delete existing deployment: `helm uninstall ez-platform -n ez-platform`
2. Load new images: `./scripts/load-images.sh`
3. Install new version: `./install.sh`

**Configuration Changes:**
- New ConfigMap key: `database-name: "ezplatform"`
- Updated health check timings for metrics-configuration service
- Updated nginx.conf with new API routing

---

## Support

- GitHub Issues: https://github.com/usercourses63/ez-data-processing-platform/issues
- Documentation: Included in release package
- API Documentation: Available at `/swagger` on each backend service
```

---

## 2. Complete Change Report

### 2.1 Kubernetes YAML Changes

#### A. ConfigMaps (`k8s/configmaps/services-config.yaml`)

**Change Summary:**
```diff
+ database-name: "ezplatform"
```

**Impact:**
- Ensures all services use consistent database name
- Previously relied on appsettings.json defaults
- **CRITICAL:** Update `release-package/k8s/configmaps/services-config.yaml`
- **CRITICAL:** Update `release-package/helm/ez-platform/templates/configmaps/services-config.yaml`

**Required Updates:**
- File: `release-package/k8s/configmaps/services-config.yaml` → Add `database-name` key
- File: `release-package/helm/ez-platform/templates/configmaps/services-config.yaml` → Add `database-name` key

---

#### B. Deployments (`k8s/deployments/metrics-configuration-deployment.yaml`)

**Change Summary:**
```diff
- imagePullPolicy: Always
+ imagePullPolicy: Never

livenessProbe:
-  initialDelaySeconds: 30
-  periodSeconds: 10
+  initialDelaySeconds: 60
+  periodSeconds: 30
+  timeoutSeconds: 5
+  failureThreshold: 5

readinessProbe:
-  initialDelaySeconds: 15
-  periodSeconds: 5
+  initialDelaySeconds: 30
+  periodSeconds: 10
+  timeoutSeconds: 5
+  failureThreshold: 3
```

**Impact:**
- Fixed health check failures for metrics-configuration service
- Increased probe timeouts for MongoDB connection initialization
- Changed imagePullPolicy to Never for offline deployment compatibility

**Required Updates:**
- File: `release-package/k8s/deployments/metrics-configuration-deployment.yaml` → Update probe settings
- File: `release-package/helm/ez-platform/templates/deployments/metrics-configuration-deployment.yaml` → Update probe settings
- File: `release-package/helm/ez-platform/values.yaml` → Update `services.metricsConfiguration` probe values

---

### 2.2 Docker & Container Changes

#### A. Frontend Dockerfile (`docker/Frontend.Dockerfile`)

**Change Summary:**
```diff
+ # Debug: List public folder to verify docs exist
+ RUN ls -la ./public/docs/ || echo "docs folder missing!"
+
+ # Build React app
+ RUN npm run build
+
+ # Debug: List build folder to check if docs were copied
+ RUN ls -la ./build/docs/ || echo "docs not in build!"

+ # Copy help documentation directly from source (public/docs -> build/docs)
+ COPY --from=build /app/public/docs/USER-GUIDE-HE.md ./docs/USER-GUIDE-HE.md
```

**Impact:**
- Fixes missing USER-GUIDE-HE.md in production frontend
- Adds debug output for build verification
- Ensures documentation files are available in container

**Required Updates:**
- File: `docker/Frontend.Dockerfile` → Already updated in main repo (copy to release-package if needed)

---

#### B. Nginx Configuration (`docker/nginx.conf`)

**Change Summary:**
```diff
+ # Serve static markdown files directly (don't fallback to index.html)
+ location /docs/ {
+     try_files $uri =404;
+     add_header Content-Type text/markdown;
+ }

- location /api/datasources/ {
-     proxy_pass http://datasource-management.ez-platform.svc.cluster.local:5001/;
+ location /api/v1/datasource {
+     proxy_pass http://datasource-management.ez-platform.svc.cluster.local:5001/api/v1/datasource;
+     proxy_http_version 1.1;
+     proxy_set_header Upgrade $http_upgrade;
+     proxy_set_header Connection 'upgrade';
+     proxy_set_header Host $host;
+     proxy_cache_bypass $http_upgrade;
+     proxy_set_header X-Real-IP $remote_addr;
+     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
+ }

+ # Added 4 new API proxy routes:
+ location /api/v1/categories { ... }
+ location /api/v1/invalid-records { ... }
+ location /api/v1/metrics { ... }
+ location /api/v1/global-alerts { ... }
```

**Impact:**
- **CRITICAL:** Frontend routing was broken (incorrect API paths)
- Fixes API calls to backend services
- Adds proper proxy headers for request forwarding
- Enables markdown file serving for documentation

**Required Updates:**
- File: `docker/nginx.conf` → Already updated in main repo (copy to release-package if needed)

---

### 2.3 Source Code Changes

#### A. Backend Services - Swagger Integration

**All 8 services received Swagger/OpenAPI additions:**

1. **DataSourceManagementService:**
   - Added: `Swashbuckle.AspNetCore` package reference
   - Modified: `Program.cs` - Full Swagger configuration with metadata

2. **FileDiscoveryService, FileProcessorService, ValidationService, InvalidRecordsService, SchedulingService:**
   - Modified: `Program.cs` - Enabled Swagger endpoint at `/swagger`
   - Changed: RoutePrefix from empty string to `"swagger"`

3. **OutputService:**
   - Added: OpenApi and Swagger package references
   - Modified: `Program.cs` - Added Controllers and Swagger configuration

4. **MetricsConfigurationService:**
   - Modified: `Program.cs` - Enabled Swagger endpoint
   - Modified: `appsettings.json` - Removed hardcoded Kestrel endpoint configuration
   - **CRITICAL:** Fixed MongoDB connection and configuration management

**Impact:**
- All backend APIs now have interactive documentation at `/swagger`
- Better API discoverability for developers and integrators
- **REQUIRES IMAGE REBUILD** for all 8 services

---

#### B. Frontend - Splash Screen & Branding

**New Files:**
- `src/Frontend/src/components/SplashScreen.tsx` (NEW - 90 lines)
- `src/Frontend/public/assets/logo/ez-platform-logo.svg` (NEW)

**Modified Files:**
- `src/Frontend/src/App.tsx` (+18 lines) - Splash screen integration
- `src/Frontend/src/App.css` (+140 lines) - Splash screen styling
- `src/Frontend/src/components/layout/AppHeader.tsx` (+71 lines) - Logo in header
- `src/Frontend/src/i18n/locales/en.json` (+3 keys) - English translations
- `src/Frontend/src/i18n/locales/he.json` (+3 keys) - Hebrew translations

**Impact:**
- Professional branding on app startup
- Logo in application header
- Enhanced user experience
- **REQUIRES IMAGE REBUILD** for frontend

---

#### C. DemoDataGenerator - Error Format

**Modified Files:**
- `tools/DemoDataGenerator/Program.cs`
- `tools/DemoDataGenerator/Generators/AllGenerators.cs`

**Impact:**
- Error messages now use Corvus.Json.Validator format
- Consistent with frontend error parser
- **NOT CRITICAL** for deployment (development tool only)

---

## 3. release-package Folder - File-by-File Analysis

### 3.1 Files Requiring Updates

#### Root Files

| File | Current Version | Status | Update Required |
|------|----------------|--------|-----------------|
| `README.md` | v0.1.0-beta | ❌ Outdated | Update version refs to v0.1.1-rc1 |
| `RELEASE-PACKAGE-MANIFEST.md` | v0.1.0-beta (commit d7e18f8) | ❌ Outdated | Update to v0.1.1-rc1 (commit e99b71a) |
| `IMAGE-MANIFEST.txt` | v0.1.0-beta | ❌ Outdated | Update 9 image tags to v0.1.1-rc1 |
| `Deploy Docs.txt` | Static | ✅ OK | No changes needed |
| `install.sh` | v0.1.0-beta | ❌ Outdated | Update version string in script |
| `uninstall.sh` | v0.1.0-beta | ❌ Outdated | Update version string in script |

**Detailed Updates:**

**File: `README.md`**
```diff
- # EZ Platform v0.1.0-beta - Installation Package
+ # EZ Platform v0.1.1-rc1 - Installation Package

- - ✅ **21 Docker Images** (3.96GB)
+ - ✅ **21 Docker Images** (4.1GB)

- **Version:** v0.1.0-beta
- **Release Date:** December 29, 2025
+ **Version:** v0.1.1-rc1
+ **Release Date:** January 1, 2026
```

**File: `RELEASE-PACKAGE-MANIFEST.md`**
```diff
- **Release Date:** December 30, 2025
- **Version:** 0.1.0-beta
- **Git Commit:** d7e18f8
+ **Release Date:** January 1, 2026
+ **Version:** 0.1.1-rc1
+ **Git Commit:** e99b71a

+ ## Changes from v0.1.0-beta
+
+ ### Backend Services - Swagger/OpenAPI
+ - Added interactive API documentation to all 8 backend services
+ - Swagger UI available at `/swagger` endpoint
+
+ ### Frontend Enhancements
+ - Added EZ Platform splash screen and logo
+ - Fixed documentation loading (USER-GUIDE-HE.md)
+ - Updated nginx routing for API v1 endpoints
+
+ ### Configuration Fixes
+ - Added database-name to services-config ConfigMap
+ - Fixed MetricsConfigurationService health checks
+ - Updated probe timings for production stability
```

**File: `IMAGE-MANIFEST.txt`**
```diff
- # EZ Platform v0.1.0-beta - Complete Image Manifest
+ # EZ Platform v0.1.1-rc1 - Complete Image Manifest

## Application Services (10 images)
- datasource-management:v0.1.0-beta
- filediscovery:v0.1.0-beta
- fileprocessor:v0.1.0-beta
- validation:v0.1.0-beta
- output:v0.1.0-beta
- invalidrecords:v0.1.0-beta
- scheduling:v0.1.0-beta
- metrics-configuration:v0.1.0-beta
- frontend:v0.1.0-beta
+ datasource-management:v0.1.1-rc1
+ filediscovery:v0.1.1-rc1
+ fileprocessor:v0.1.1-rc1
+ validation:v0.1.1-rc1
+ output:v0.1.1-rc1
+ invalidrecords:v0.1.1-rc1
+ scheduling:v0.1.1-rc1
+ metrics-configuration:v0.1.1-rc1
+ frontend:v0.1.1-rc1
  ezplatform-docs:v0.1.0-beta

## Infrastructure Services (11 images) - NO CHANGES
```

**File: `install.sh`**
```bash
# Line 3: Update version
- # Version: 0.1.0-beta
+ # Version: 0.1.1-rc1

# Line 4: Update date
- # Date: December 30, 2025
+ # Date: January 1, 2026

# Line 9: Update header
- echo "  EZ Platform v0.1.0-beta Installation"
+ echo "  EZ Platform v0.1.1-rc1 Installation"
```

**File: `uninstall.sh`**
```bash
# Update version references similar to install.sh
- # Version: 0.1.0-beta
+ # Version: 0.1.1-rc1
```

---

### 3.2 Kubernetes Manifests (`release-package/k8s/`)

#### ConfigMaps

**File: `k8s/configmaps/services-config.yaml`**
```diff
data:
  mongodb-connection: "mongodb"
+ database-name: "ezplatform"
  kafka-server: "kafka:9092"
```

**Status:** ❌ **CRITICAL UPDATE REQUIRED**

---

#### Deployments

**File: `k8s/deployments/metrics-configuration-deployment.yaml`**
```diff
- imagePullPolicy: Always
+ imagePullPolicy: Never

livenessProbe:
-  initialDelaySeconds: 30
-  periodSeconds: 10
+  initialDelaySeconds: 60
+  periodSeconds: 30
+  timeoutSeconds: 5
+  failureThreshold: 5

readinessProbe:
-  initialDelaySeconds: 15
-  periodSeconds: 5
+  initialDelaySeconds: 30
+  periodSeconds: 10
+  timeoutSeconds: 5
+  failureThreshold: 3
```

**Status:** ❌ **CRITICAL UPDATE REQUIRED**

**File: All other deployment YAMLs**
- Update image tags from `v0.1.0-beta` to `v0.1.1-rc1` for 9 services
- Services: datasource-management, filediscovery, fileprocessor, validation, output, invalidrecords, scheduling, metrics-configuration, frontend

---

### 3.3 Helm Chart (`release-package/helm/ez-platform/`)

#### Chart.yaml

**File: `helm/ez-platform/Chart.yaml`**
```yaml
apiVersion: v2
name: ez-platform
description: EZ Platform Data Processing System - Complete Helm Chart
type: application
# Update these:
version: 1.1.0  # Chart version (was 1.0.0)
appVersion: "0.1.1-rc1"  # Application version (was 0.1.0-beta)
```

**Status:** ❌ **UPDATE REQUIRED**

---

#### values.yaml

**File: `helm/ez-platform/values.yaml`**

**Updates Required:**

1. **Global image tag:**
```yaml
global:
  namespace: ez-platform
  imageRegistry: docker.io
  imagePullPolicy: Never  # Changed from Always for offline deployment
```

2. **All service image tags:**
```yaml
services:
  filediscovery:
    image:
      repository: ez-platform/filediscovery
      tag: v0.1.1-rc1  # Update from 'latest'

  fileprocessor:
    image:
      repository: ez-platform/fileprocessor
      tag: v0.1.1-rc1  # Update from 'latest'

  validation:
    image:
      repository: ez-platform/validation
      tag: v0.1.1-rc1  # Update from 'latest'

  output:
    image:
      repository: ez-platform/output
      tag: v0.1.1-rc1  # Update from 'latest'

  datasourceManagement:
    image:
      repository: ez-platform/datasource-management
      tag: v0.1.1-rc1  # Update from 'latest'

  metricsConfiguration:
    image:
      repository: ez-platform/metrics-configuration
      tag: v0.1.1-rc1  # Update from 'latest'
    # Update probe settings:
    livenessProbe:
      initialDelaySeconds: 60  # Was 30
      periodSeconds: 30        # Was 10
      timeoutSeconds: 5        # Add this
      failureThreshold: 5      # Was 3
    readinessProbe:
      initialDelaySeconds: 30  # Was 20
      periodSeconds: 10        # Was 5
      timeoutSeconds: 5        # Add this
      failureThreshold: 3      # Was 2

  invalidrecords:
    image:
      repository: ez-platform/invalidrecords
      tag: v0.1.1-rc1  # Update from 'latest'

  scheduling:
    image:
      repository: ez-platform/scheduling
      tag: v0.1.1-rc1  # Update from 'latest'

  frontend:
    image:
      repository: ez-platform/frontend
      tag: v0.1.1-rc1  # Update from 'latest'
```

**Status:** ❌ **CRITICAL UPDATE REQUIRED** (9 image tags + probe settings)

---

#### Helm Templates

**File: `helm/ez-platform/templates/configmaps/services-config.yaml`**
```diff
data:
  mongodb-connection: "mongodb"
+ database-name: "ezplatform"
  kafka-server: "kafka:9092"
```

**Status:** ❌ **CRITICAL UPDATE REQUIRED**

**File: `helm/ez-platform/templates/deployments/metrics-configuration-deployment.yaml`**
- Update probe settings (same as k8s/deployments/ version)

**Status:** ❌ **CRITICAL UPDATE REQUIRED**

**All other deployment templates:**
- Image tags are templated from values.yaml - no direct changes needed

---

### 3.4 Scripts (`release-package/scripts/`)

**File: `scripts/load-images.sh`**
```bash
# Line 50: Update grep pattern to include new version
- docker images | grep -E "v0.1.0-beta|mongo|rabbitmq|kafka|..."
+ docker images | grep -E "v0.1.1-rc1|mongo|rabbitmq|kafka|..."
```

**Status:** ⚠️ **RECOMMENDED UPDATE** (not critical, but improves output)

---

### 3.5 Documentation (`release-package/docs/`)

**Files to Update:**

1. **`docs/docs/release-notes.md`**
   - Add v0.1.1-rc1 section with changes

2. **`docs/docs/changelog.md`**
   - Add v0.1.1-rc1 entry with commit list

3. **`docs/mkdocs.yml`**
   - Update `site_name` version if present

4. **`docs/docs/index.md`**
   - Update version badge/reference

**Status:** ❌ **UPDATE REQUIRED** for completeness

---

### 3.6 Images Directory (`release-package/images/`)

**Current Images:** 21 `.tar` files (3.96GB)

**Updates Required:**
- **REBUILD:** 9 application service images
- **KEEP:** 11 infrastructure images (no changes)
- **SKIP:** ezplatform-docs (no changes to docs site itself)

**New Images to Build:**
1. `datasource-management-v0.1.1-rc1.tar`
2. `filediscovery-v0.1.1-rc1.tar`
3. `fileprocessor-v0.1.1-rc1.tar`
4. `validation-v0.1.1-rc1.tar`
5. `output-v0.1.1-rc1.tar`
6. `invalidrecords-v0.1.1-rc1.tar`
7. `scheduling-v0.1.1-rc1.tar`
8. `metrics-configuration-v0.1.1-rc1.tar`
9. `frontend-v0.1.1-rc1.tar`

**Images to Keep:**
- `mongo-8.0.tar`
- `rabbitmq-3-management-alpine.tar`
- `kafka-7.5.0.tar`
- `zookeeper-7.5.0.tar`
- `hazelcast-5.6.tar`
- `elasticsearch-8.17.0.tar`
- `prometheus-latest.tar`
- `grafana-latest.tar`
- `jaeger-all-in-one-latest.tar`
- `otel-collector-contrib-latest.tar`
- `fluent-bit-latest.tar`

**Total Updated Package Size:** ~4.1GB (up from 3.96GB due to Swagger packages)

---

## 4. Docker Image Rebuild Strategy

### 4.1 Build Environment Setup

**Prerequisites:**
- Docker Desktop running
- No cache builds (`--no-cache` flag) to ensure latest changes
- Proper tagging with v0.1.1-rc1
- Namespace prefix: `ez-platform/`

---

### 4.2 Backend Services Build Commands

**Location:** `C:\Users\UserC\source\repos\EZ\`

#### DataSourceManagementService
```bash
docker build --no-cache \
  -t ez-platform/datasource-management:v0.1.1-rc1 \
  -t ez-platform/datasource-management:latest \
  -f docker/DataSourceManagementService.Dockerfile \
  .
```

#### FileDiscoveryService
```bash
docker build --no-cache \
  -t ez-platform/filediscovery:v0.1.1-rc1 \
  -t ez-platform/filediscovery:latest \
  -f docker/FileDiscoveryService.Dockerfile \
  .
```

#### FileProcessorService
```bash
docker build --no-cache \
  -t ez-platform/fileprocessor:v0.1.1-rc1 \
  -t ez-platform/fileprocessor:latest \
  -f docker/FileProcessorService.Dockerfile \
  .
```

#### ValidationService
```bash
docker build --no-cache \
  -t ez-platform/validation:v0.1.1-rc1 \
  -t ez-platform/validation:latest \
  -f docker/ValidationService.Dockerfile \
  .
```

#### OutputService
```bash
docker build --no-cache \
  -t ez-platform/output:v0.1.1-rc1 \
  -t ez-platform/output:latest \
  -f docker/OutputService.Dockerfile \
  .
```

#### InvalidRecordsService
```bash
docker build --no-cache \
  -t ez-platform/invalidrecords:v0.1.1-rc1 \
  -t ez-platform/invalidrecords:latest \
  -f docker/InvalidRecordsService.Dockerfile \
  .
```

#### SchedulingService
```bash
docker build --no-cache \
  -t ez-platform/scheduling:v0.1.1-rc1 \
  -t ez-platform/scheduling:latest \
  -f docker/SchedulingService.Dockerfile \
  .
```

#### MetricsConfigurationService (CRITICAL)
```bash
docker build --no-cache \
  -t ez-platform/metrics-configuration:v0.1.1-rc1 \
  -t ez-platform/metrics-configuration:latest \
  -f docker/MetricsConfigurationService.Dockerfile \
  .
```

---

### 4.3 Frontend Build Commands

**Location:** `C:\Users\UserC\source\repos\EZ\`

```bash
# Build frontend with updated Dockerfile and nginx.conf
docker build --no-cache \
  -t ez-platform/frontend:v0.1.1-rc1 \
  -t ez-platform/frontend:latest \
  -f docker/Frontend.Dockerfile \
  .
```

**Critical Files Included:**
- Updated nginx.conf with API v1 routing
- USER-GUIDE-HE.md documentation
- EZ Platform logo (SVG)
- Splash screen component

---

### 4.4 Image Export for Offline Deployment

**Export Location:** `release-package/images/`

```bash
# Navigate to release-package
cd release-package/images

# Export each updated image
docker save ez-platform/datasource-management:v0.1.1-rc1 | gzip > datasource-management-v0.1.1-rc1.tar.gz
docker save ez-platform/filediscovery:v0.1.1-rc1 | gzip > filediscovery-v0.1.1-rc1.tar.gz
docker save ez-platform/fileprocessor:v0.1.1-rc1 | gzip > fileprocessor-v0.1.1-rc1.tar.gz
docker save ez-platform/validation:v0.1.1-rc1 | gzip > validation-v0.1.1-rc1.tar.gz
docker save ez-platform/output:v0.1.1-rc1 | gzip > output-v0.1.1-rc1.tar.gz
docker save ez-platform/invalidrecords:v0.1.1-rc1 | gzip > invalidrecords-v0.1.1-rc1.tar.gz
docker save ez-platform/scheduling:v0.1.1-rc1 | gzip > scheduling-v0.1.1-rc1.tar.gz
docker save ez-platform/metrics-configuration:v0.1.1-rc1 | gzip > metrics-configuration-v0.1.1-rc1.tar.gz
docker save ez-platform/frontend:v0.1.1-rc1 | gzip > frontend-v0.1.1-rc1.tar.gz
```

**Note:** Keep `.tar.gz` extension for compression (saves ~50% space)

---

### 4.5 Image Verification

**Verify Images Exist:**
```bash
docker images | grep v0.1.1-rc1
```

**Expected Output:**
```
ez-platform/datasource-management    v0.1.1-rc1    <ID>    <SIZE>
ez-platform/filediscovery           v0.1.1-rc1    <ID>    <SIZE>
ez-platform/fileprocessor           v0.1.1-rc1    <ID>    <SIZE>
ez-platform/validation              v0.1.1-rc1    <ID>    <SIZE>
ez-platform/output                  v0.1.1-rc1    <ID>    <SIZE>
ez-platform/invalidrecords          v0.1.1-rc1    <ID>    <SIZE>
ez-platform/scheduling              v0.1.1-rc1    <ID>    <SIZE>
ez-platform/metrics-configuration   v0.1.1-rc1    <ID>    <SIZE>
ez-platform/frontend                v0.1.1-rc1    <ID>    <SIZE>
```

---

## 5. Environment Variables & Configuration

### 5.1 ConfigMap Changes

**File:** `k8s/configmaps/services-config.yaml`

**New Key Added:**
```yaml
data:
  database-name: "ezplatform"  # NEW - Ensures consistent database name
```

**Impact:**
- All microservices read `database-name` from ConfigMap
- Previously defaulted to appsettings.json value
- Ensures consistency across services

**Deployment Update:**
```yaml
# All service deployments reference this ConfigMap
env:
- name: ConnectionStrings__DatabaseName
  valueFrom:
    configMapKeyRef:
      name: services-config
      key: database-name  # NEW reference
```

---

### 5.2 Service-Specific Environment Variables

**No changes to existing env vars**, but **new Swagger endpoints** are configured via:

```yaml
# Program.cs configuration (embedded in code, not env vars)
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "EZ Platform [ServiceName] API",
        Version = "v0.1.1-rc1",
        Description = "API documentation for [ServiceName]"
    });
});
```

**Swagger Access:**
- URL: `http://<service>:5001/swagger` (DataSourceManagement)
- URL: `http://<service>:5003/swagger` (Validation)
- etc.

---

### 5.3 Connection Strings

**No changes** - all connection strings remain ConfigMap-based:

```yaml
# Existing ConfigMap keys (unchanged)
mongodb-connection: "mongodb"
kafka-server: "kafka:9092"
hazelcast-server: "hazelcast:5701"
prometheus-endpoint: "http://prometheus:9090"
otlp-endpoint: "http://otel-collector:4317"
elasticsearch-endpoint: "http://elasticsearch:9200"
rabbitmq-connection: "amqp://guest:guest@rabbitmq:5672"
```

---

## 6. Volume Mounts & Persistent Storage

### 6.1 Existing Mounts (No Changes)

**StatefulSet Mounts:**

#### MongoDB StatefulSet
```yaml
volumeMounts:
- name: mongodb-data
  mountPath: /data/db
volumeClaimTemplates:
- metadata:
    name: mongodb-data
  spec:
    accessModes: ["ReadWriteOnce"]
    resources:
      requests:
        storage: 20Gi  # Per replica
```

#### Kafka StatefulSet
```yaml
volumeMounts:
- name: kafka-data
  mountPath: /var/lib/kafka/data
volumeClaimTemplates:
- metadata:
    name: kafka-data
  spec:
    accessModes: ["ReadWriteOnce"]
    resources:
      requests:
        storage: 10Gi  # Per replica
```

#### Hazelcast StatefulSet
```yaml
volumeMounts:
- name: hazelcast-data
  mountPath: /opt/hazelcast/data
volumeClaimTemplates:
- metadata:
    name: hazelcast-data
  spec:
    accessModes: ["ReadWriteOnce"]
    resources:
      requests:
        storage: 5Gi  # Per replica
```

---

### 6.2 File Discovery Mounts (No Changes)

```yaml
# FileDiscovery Service
volumeMounts:
- name: input-data
  mountPath: /mnt/input-data
volumes:
- name: input-data
  hostPath:
    path: /data/ez-platform/input  # Or NFS/PVC in production
    type: DirectoryOrCreate
```

---

### 6.3 Output Service Mounts (No Changes)

```yaml
# Output Service
volumeMounts:
- name: output-data
  mountPath: /mnt/output-data
volumes:
- name: output-data
  hostPath:
    path: /data/ez-platform/output  # Or NFS/PVC in production
    type: DirectoryOrCreate
```

---

## 7. Network & VPC Configuration

### 7.1 Kubernetes Service Configuration (No Changes)

**All services use ClusterIP** by default:

```yaml
# Example: DataSourceManagement Service
apiVersion: v1
kind: Service
metadata:
  name: datasource-management
  namespace: ez-platform
spec:
  type: ClusterIP  # Internal cluster access only
  selector:
    app: datasource-management
  ports:
  - port: 5001
    targetPort: 5001
    protocol: TCP
```

---

### 7.2 Frontend Service (NodePort for External Access)

**No changes**, but verify NodePort configuration:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: ez-platform
spec:
  type: NodePort  # External access
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
    nodePort: 30080  # Fixed port for offline deployment
    protocol: TCP
```

**Access URL:** `http://<NODE-IP>:30080`

---

### 7.3 Ingress Configuration (Optional)

**No changes** - Ingress is optional for production. For offline LAN:

```yaml
# Optional: If using Ingress in production
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ez-platform-ingress
  namespace: ez-platform
spec:
  rules:
  - host: ez-platform.local  # Update for customer's internal domain
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

---

## 8. Installation & Deployment Scripts

### 8.1 Updated install.sh Script

**File:** `release-package/install.sh`

**Changes Required:**
- Line 3: Version string
- Line 4: Date
- Line 9: Header text

**No functional changes** - script logic remains the same.

---

### 8.2 Updated load-images.sh Script

**File:** `release-package/scripts/load-images.sh`

**Changes Required:**
- Line 50: Update grep pattern to include v0.1.1-rc1

**Optional Enhancement:**
```bash
# Line 50: Update verification grep
docker images | grep -E "v0.1.1-rc1|v0.1.0-beta|mongo|rabbitmq|kafka|hazelcast|elasticsearch|prometheus|grafana|jaeger|otel|fluent"
```

---

### 8.3 Helm Installation Commands

**No changes** - Helm commands remain the same:

```bash
# Standard installation
helm install ez-platform ./helm/ez-platform \
  --namespace ez-platform \
  --create-namespace \
  --wait \
  --timeout 15m

# With custom values
helm install ez-platform ./helm/ez-platform \
  --namespace ez-platform \
  --create-namespace \
  --values custom-values.yaml \
  --wait \
  --timeout 15m
```

---

### 8.4 Deployment Verification Script

**New recommended script:** `release-package/scripts/verify-deployment.sh`

```bash
#!/bin/bash
# Verify EZ Platform v0.1.1-rc1 deployment

echo "EZ Platform v0.1.1-rc1 - Deployment Verification"
echo "=================================================="

# Check all pods running
echo "1. Checking pod status..."
kubectl get pods -n ez-platform

# Check services
echo "2. Checking services..."
kubectl get svc -n ez-platform

# Test health endpoints (requires port-forward or NodePort)
echo "3. Testing health endpoints..."
for port in 5001 5002 5003 5004 5006 5007 5008 5009; do
    echo -n "Port $port: "
    curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health
    echo ""
done

# Test Swagger endpoints
echo "4. Testing Swagger endpoints..."
for port in 5001 5002 5003 5004 5006 5007 5008 5009; do
    echo -n "Swagger on port $port: "
    curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/swagger/index.html
    echo ""
done

# Check MongoDB replica set
echo "5. Checking MongoDB..."
kubectl exec -it mongodb-0 -n ez-platform -- mongosh --eval "rs.status().ok"

# Check Kafka
echo "6. Checking Kafka..."
kubectl exec -it kafka-0 -n ez-platform -- kafka-topics.sh --bootstrap-server localhost:9092 --list

# Check Hazelcast
echo "7. Checking Hazelcast..."
kubectl exec -it hazelcast-0 -n ez-platform -- curl -s http://localhost:5701/hazelcast/health

echo "=================================================="
echo "Verification complete!"
```

---

## 9. Documentation Updates

### 9.1 Release Notes

**File:** `release-package/docs/docs/release-notes.md`

**Add New Section:**

```markdown
## v0.1.1-rc1 (January 1, 2026)

### New Features

#### Swagger/OpenAPI Integration
- Added interactive API documentation to all 8 backend services
- Swagger UI accessible at `/swagger` endpoint on each service
- OpenAPI 3.0 specification with full endpoint documentation
- Services: DataSourceManagement, FileDiscovery, FileProcessor, Validation, Output, InvalidRecords, Scheduling, MetricsConfiguration

#### Frontend Enhancements
- **Splash Screen:** Added EZ Platform branded splash screen on app startup
- **Logo Integration:** EZ Platform logo in application header
- **Hebrew Localization:** Splash screen and branding text in Hebrew and English

### Bug Fixes

#### Critical Fixes
- **MetricsConfigurationService:** Fixed MongoDB connection and health check configuration
- **Frontend Documentation:** Fixed USER-GUIDE-HE.md not loading in help page
- **Frontend Routing:** Corrected nginx.conf API proxy routes to use `/api/v1/` prefix
- **Error Messages:** Standardized error format to Corvus.Json.Validator format

#### Configuration Updates
- **services-config.yaml:** Added `database-name: "ezplatform"` for consistency
- **Probe Timings:** Increased health check timeouts for MetricsConfigurationService
- **Image Pull Policy:** Changed to `Never` for offline deployment compatibility

### Technical Improvements
- Enhanced frontend Docker build with explicit documentation copy
- Updated nginx configuration with proper proxy headers
- Improved error message parsing in frontend error parser
- Standardized demo data generator to use Corvus format

### Deployment Changes
- Updated image tags from v0.1.0-beta to v0.1.1-rc1 (9 images)
- Modified ConfigMap with database-name key
- Adjusted health check probe settings for production stability

### Known Issues
- E2E test gaps remain (XML, Excel, high-load scenarios)
- Jaeger persistence still in-memory (requires Elasticsearch backend)
- Grafana credentials hardcoded (needs K8s Secret)
- Elasticsearch security disabled (needs production hardening)

### Upgrade from v0.1.0-beta
- **Backward Compatible:** Yes
- **Breaking Changes:** None
- **Migration Required:** No (clean deployment recommended)
```

---

### 9.2 Changelog

**File:** `release-package/docs/docs/changelog.md`

**Add Entry:**

```markdown
## [0.1.1-rc1] - 2026-01-01

### Added
- Swagger/OpenAPI documentation to all backend services (#17 commits)
- Frontend splash screen with EZ Platform branding
- EZ Platform logo in SVG format
- Hebrew and English translations for branding elements
- database-name ConfigMap key for consistent database naming

### Changed
- Updated nginx.conf with correct `/api/v1/` API routing
- Increased MetricsConfigurationService health check timeouts
- Changed imagePullPolicy to Never for offline deployment
- Standardized error messages to Corvus format in DemoDataGenerator

### Fixed
- MetricsConfigurationService MongoDB connection configuration
- USER-GUIDE-HE.md not loading in frontend help page
- Frontend API routing to backend services
- Corvus error parser field name extraction

### Technical
- 17 commits since v0.1.0-beta
- 38 files modified
- 9 Docker images rebuilt
- Updated Helm chart to version 1.1.0
```

---

### 9.3 Installation Documentation

**File:** `release-package/docs/docs/installation.md`

**Update version references:**
- Replace all `v0.1.0-beta` with `v0.1.1-rc1`
- Update package size: `3.96GB` → `4.1GB`
- Update release date: `December 29, 2025` → `January 1, 2026`

**Add Swagger section:**

```markdown
## API Documentation

All backend services now include Swagger/OpenAPI documentation:

### Accessing Swagger UI

After deployment, access Swagger UI for each service:

```bash
# Port-forward to service
kubectl port-forward svc/datasource-management 5001:5001 -n ez-platform

# Open Swagger UI
http://localhost:5001/swagger
```

### Available Swagger Endpoints

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
```

---

## 10. Deployment Checklist

### 10.1 Pre-Deployment

- [ ] **Git Tag Created:** v0.1.1-rc1
- [ ] **GitHub Release Created:** With release notes
- [ ] **All 9 Docker Images Built:** No cache, v0.1.1-rc1 tag
- [ ] **Images Exported:** To release-package/images/ (gzipped)
- [ ] **ConfigMaps Updated:** database-name key added
- [ ] **Deployments Updated:** Image tags and probe settings
- [ ] **Helm Chart Updated:** Chart.yaml version, values.yaml tags
- [ ] **Scripts Updated:** Version strings in install.sh, load-images.sh
- [ ] **Documentation Updated:** Release notes, changelog, installation guide
- [ ] **IMAGE-MANIFEST.txt Updated:** New image tags listed

---

### 10.2 Build Verification

- [ ] **Backend Services (8):** All images build successfully without errors
- [ ] **Frontend Service (1):** Image builds with nginx.conf and docs
- [ ] **Image Sizes:** Verify total package size (~4.1GB)
- [ ] **Image Tags:** All tagged with v0.1.1-rc1 and latest
- [ ] **Image Export:** All .tar.gz files created successfully

---

### 10.3 Package Assembly

- [ ] **Root Files:** README, MANIFEST, IMAGE-MANIFEST updated
- [ ] **k8s/ Folder:** ConfigMaps and deployments updated
- [ ] **helm/ Folder:** Chart.yaml, values.yaml, templates updated
- [ ] **images/ Folder:** 9 new images + 11 infrastructure images
- [ ] **scripts/ Folder:** install.sh, load-images.sh, verify-deployment.sh
- [ ] **docs/ Folder:** Release notes, changelog, installation guide

---

### 10.4 Testing

- [ ] **Helm Lint:** `helm lint release-package/helm/ez-platform/`
- [ ] **Helm Template Render:** `helm template test release-package/helm/ez-platform/ > test.yaml`
- [ ] **Kubectl Dry-Run:** `kubectl apply --dry-run=client -f test.yaml`
- [ ] **Image Load Test:** Load one image to verify tar.gz format
- [ ] **Install Script Test:** Run install.sh in test cluster

---

### 10.5 Offline LAN Deployment

- [ ] **Package Created:** ezplatform-v0.1.1-rc1.tar.gz
- [ ] **Package Checksum:** SHA256 checksum generated
- [ ] **Transfer to Offline Network:** Via USB/offline method
- [ ] **Extract Package:** Verify all files present
- [ ] **Load Images:** Run load-images.sh (5-10 minutes)
- [ ] **Verify Images:** `docker images | grep v0.1.1-rc1`
- [ ] **Install:** Run install.sh or helm install
- [ ] **Verify Deployment:** Run verify-deployment.sh
- [ ] **Test Frontend:** Access http://<NODE-IP>:30080
- [ ] **Test Swagger:** Access http://localhost:5001/swagger (via port-forward)
- [ ] **Test Monitoring:** Grafana, Prometheus, Jaeger

---

## 11. Critical Files Reference

### Files That MUST Be Updated

| Category | File Path | Change Required |
|----------|-----------|-----------------|
| **Root** | `release-package/README.md` | Version refs: v0.1.0-beta → v0.1.1-rc1 |
| **Root** | `release-package/RELEASE-PACKAGE-MANIFEST.md` | Version, commit hash, change log |
| **Root** | `release-package/IMAGE-MANIFEST.txt` | 9 image tags updated |
| **Root** | `release-package/install.sh` | Version string, date |
| **ConfigMap** | `release-package/k8s/configmaps/services-config.yaml` | Add database-name key |
| **Deployment** | `release-package/k8s/deployments/metrics-configuration-deployment.yaml` | Probe settings, imagePullPolicy |
| **Deployment** | `release-package/k8s/deployments/*.yaml` (9 files) | Image tags v0.1.1-rc1 |
| **Helm Chart** | `release-package/helm/ez-platform/Chart.yaml` | version: 1.1.0, appVersion: 0.1.1-rc1 |
| **Helm Values** | `release-package/helm/ez-platform/values.yaml` | 9 image tags, probe settings |
| **Helm ConfigMap** | `release-package/helm/ez-platform/templates/configmaps/services-config.yaml` | Add database-name key |
| **Helm Deployment** | `release-package/helm/ez-platform/templates/deployments/metrics-configuration-deployment.yaml` | Probe settings |
| **Images** | `release-package/images/` (9 files) | New v0.1.1-rc1 tar.gz files |
| **Docs** | `release-package/docs/docs/release-notes.md` | v0.1.1-rc1 section |
| **Docs** | `release-package/docs/docs/changelog.md` | v0.1.1-rc1 entry |

**Total Critical Files:** 24+ files

---

## 12. Summary

### Changes Overview

- **17 commits** after v0.1.0-beta tag
- **38 files modified** in main repository
- **9 Docker images** require rebuild
- **24+ files** in release-package require updates
- **Major features:** Swagger integration, frontend branding, config fixes

### Key Impacts

1. **Swagger/OpenAPI:** All backend services now have interactive API documentation
2. **Frontend:** Professional branding with splash screen and logo
3. **Configuration:** Critical fixes for MetricsConfigurationService and MongoDB
4. **Routing:** Fixed frontend-to-backend API communication

### Deployment Confidence

- **Backward Compatible:** Yes
- **Breaking Changes:** None
- **Testing Status:** Code changes verified, full deployment testing recommended
- **Production Readiness:** Release Candidate - suitable for final testing before production

---

## 13. Next Steps

1. **Execute Docker Builds:** Build all 9 images with v0.1.1-rc1 tag
2. **Update release-package Files:** Use this plan as checklist
3. **Test in Development:** Deploy to test cluster first
4. **Package for Offline:** Create ezplatform-v0.1.1-rc1.tar.gz
5. **Deploy to Offline LAN:** Follow installation guide
6. **Verify Deployment:** Run verification script
7. **Document Learnings:** Update documentation with any findings

---

**Plan Version:** 1.0
**Created:** January 1, 2026
**Repository:** C:\Users\UserC\source\repos\EZ
**Target Package:** C:\Users\UserC\source\repos\EZ\release-package
