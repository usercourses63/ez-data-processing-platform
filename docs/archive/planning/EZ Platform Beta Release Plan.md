# EZ Platform Beta Release Plan

## Overview
Prepare EZ Platform v0.1.0-beta for testing and demonstration deployment on Kubernetes.

**Target:** Production-ready installation package without compilation requirements
**Timeline:** 8-13 days estimated

---

## User Decisions (Confirmed)

| Decision | Choice |
|----------|--------|
| **Docker Distribution** | Tar Export Only (offline installation) |
| **Admin Page Scope** | Categories Only (minimal for beta) |
| **Categories** | Custom list to be defined by user |

**Simplified Scope for Beta:**
- Admin page focuses ONLY on Category Management
- Other system settings remain in ConfigMaps (can add admin UI in future)
- Docker images exported as .tar files for offline deployment

---

## Phase 1: Category Management Infrastructure (2-3 days)

### 1.1 Backend - Category Management (Simplified)
**Files to create/modify:**
- `src/Services/Shared/Entities/DataSourceCategory.cs` - New entity for categories
- `src/Services/DataSourceManagementService/Services/CategoryService.cs` - New service
- `src/Services/DataSourceManagementService/Controllers/CategoriesController.cs` - New API
- `src/Services/DataSourceManagementService/Data/CategorySeeder.cs` - Seed default categories

**API Endpoints:**
```
GET    /api/v1/categories           - Get all categories
POST   /api/v1/categories           - Add category
PUT    /api/v1/categories/{id}      - Update category
DELETE /api/v1/categories/{id}      - Remove category
POST   /api/v1/categories/reorder   - Reorder categories
```

**Note:** System settings remain in K8s ConfigMaps (not in admin UI for beta)

### 1.2 Frontend - Category Management Page
**Files to create/modify:**
- `src/Frontend/src/pages/admin/CategoryManagement.tsx` - New page (Categories ONLY)
- `src/Frontend/src/services/categories-api-client.ts` - New API client
- `src/Frontend/src/App.tsx` - Add route /admin/categories
- `src/Frontend/src/components/layout/Sidebar.tsx` - Add menu item

**Page Features:**
1. List categories with drag-drop reordering
2. Add/Edit modal (Hebrew name, English name)
3. Delete with confirmation
4. Activate/Deactivate toggle

### 1.3 Update DataSource Form
**Files to modify:**
- `src/Frontend/src/components/datasource/tabs/BasicInfoTab.tsx` - Fetch categories from API
- `src/Frontend/src/components/datasource/shared/constants.ts` - Remove hardcoded categories

---

## Phase 2: Security Fixes (1 day)

### 2.1 Grafana Credentials
**Files to modify:**
- `k8s/infrastructure/grafana-deployment.yaml` - Remove hardcoded password
- `k8s/secrets/grafana-secret.yaml` - New secret file

### 2.2 Jaeger Persistence
**Files to modify:**
- `k8s/deployments/jaeger.yaml` - Add SPAN_STORAGE_TYPE=elasticsearch

### 2.3 Elasticsearch Security (Optional for beta)
- Enable xpack.security for production readiness

---

## Phase 3: Documentation (2-3 days)

### 3.1 User Guide (Hebrew)
**File to create:**
- `docs/user-guide/USER-GUIDE-HE.md` (מדריך למשתמש)

**Sections:**
1. סקירה כללית (Overview)
2. התחברות למערכת (Login)
3. ניהול מקורות נתונים (Data Source Management)
4. הגדרת סכמות (Schema Configuration)
5. תזמון ועיבוד (Scheduling & Processing)
6. צפייה בדוחות ומטריקות (Reports & Metrics)
7. טיפול בשגיאות (Error Handling)

### 3.2 Installation Guide
**File to create:**
- `docs/installation/INSTALLATION-GUIDE.md`

**Sections:**
1. Prerequisites (K8s cluster, resources)
2. Quick Start (one-command install)
3. Configuration Options
4. Verification Steps
5. Troubleshooting

### 3.3 Admin Guide
**File to create:**
- `docs/admin/ADMIN-GUIDE.md`

**Sections:**
1. System Settings Management
2. Category Configuration
3. Monitoring & Alerts
4. Backup & Recovery
5. Scaling Guidelines

### 3.4 Release Notes
**File to create:**
- `docs/releases/RELEASE-NOTES-v0.1.0-beta.md`

---

## Phase 4: Deployment Packaging (2 days)

### 4.1 Helm Chart Enhancement
**Files to modify/create:**
- `helm/ez-platform/Chart.yaml` - Version info
- `helm/ez-platform/values.yaml` - All configurable values
- `helm/ez-platform/templates/` - K8s templates

### 4.2 Docker Images
**Actions:**
- Build all 9 service images with version tags
- Push to container registry (or provide tar exports)
- Document image versions in release

### 4.3 Installation Scripts
**Files to create:**
- `scripts/install.sh` - One-click installation
- `scripts/uninstall.sh` - Clean removal
- `scripts/upgrade.sh` - Version upgrade

### 4.4 Release Package Structure
```
ez-platform-v0.1.0-beta/
├── helm/ez-platform/
├── docs/
│   ├── USER-GUIDE-HE.md
│   ├── INSTALLATION-GUIDE.md
│   ├── ADMIN-GUIDE.md
│   └── RELEASE-NOTES.md
├── scripts/
│   ├── install.sh
│   └── uninstall.sh
└── README.md
```

---

## Phase 5: Git Release (0.5 day)

### 5.1 Version Bump
- Update version in all relevant files
- Update CHANGELOG.md

### 5.2 Git Tag & Release
```bash
git tag -a v0.1.0-beta -m "Beta release for testing"
git push origin v0.1.0-beta
```

### 5.3 GitHub Release
- Create release with:
  - Release notes
  - Installation instructions
  - Known limitations
  - Link to documentation

---

## Task Dependencies

```
Phase 1.1 (Backend Settings) ──┐
                               ├── Phase 1.3 (Update Forms)
Phase 1.2 (Admin UI) ──────────┘

Phase 2 (Security) ─── Independent

Phase 3 (Documentation) ─── Can start parallel with Phase 1-2

Phase 4 (Packaging) ─── Requires Phase 1-2 complete

Phase 5 (Release) ─── Requires all phases complete
```

---

## Critical Files Summary

### Backend (New)
- `src/Services/Shared/Entities/SystemSetting.cs`
- `src/Services/Shared/Entities/DataSourceCategory.cs`
- `src/Services/DataSourceManagementService/Services/SystemSettingsService.cs`
- `src/Services/DataSourceManagementService/Controllers/SystemSettingsController.cs`

### Backend (Modify)
- `src/Services/DataSourceManagementService/Program.cs` (DI registration)

### Frontend (New)
- `src/Frontend/src/pages/admin/SystemSettings.tsx`
- `src/Frontend/src/pages/admin/CategoryManagement.tsx`
- `src/Frontend/src/services/settings-api-client.ts`

### Frontend (Modify)
- `src/Frontend/src/App.tsx`
- `src/Frontend/src/components/layout/Sidebar.tsx`
- `src/Frontend/src/components/datasource/tabs/BasicInfoTab.tsx`

### K8s (Modify)
- `k8s/infrastructure/grafana-deployment.yaml`
- `k8s/deployments/jaeger.yaml`

### Documentation (New)
- `docs/user-guide/USER-GUIDE-HE.md`
- `docs/installation/INSTALLATION-GUIDE.md`
- `docs/admin/ADMIN-GUIDE.md`
- `docs/releases/RELEASE-NOTES-v0.1.0-beta.md`

---

## Success Criteria

1. ✅ Admin can manage datasource categories through UI
2. ✅ Admin settings page functional with all configurable values
3. ✅ Security issues resolved (Grafana, Jaeger)
4. ✅ Hebrew user guide complete and accurate
5. ✅ One-command installation works on clean K8s cluster
6. ✅ Git release v0.1.0-beta created with documentation

---

## Task Orchestrator Reference

**Feature ID:** `32c113a5-f705-473c-8d10-75983ab48123`
**Feature Name:** BETA Release v0.1.0 - Pre-Release Package
**Status:** in-development

### Tasks Created (17 total)

#### Phase 1: Admin Settings Infrastructure (10 tasks)
| Task | Priority | Complexity |
|------|----------|------------|
| BETA: Backend - Create SystemSetting Entity & Repository | High | 4 |
| BETA: Backend - Create DataSourceCategory Entity & Repository | High | 4 |
| BETA: Backend - Create SystemSettingsService | High | 5 |
| BETA: Backend - Create Settings & Categories API Controllers | High | 5 |
| BETA: Backend - Seed Default Settings & Categories | High | 4 |
| BETA: Frontend - Create Admin Settings Page | High | 6 |
| BETA: Frontend - Create Category Management Component | High | 6 |
| BETA: Frontend - Create Settings API Client | High | 4 |
| BETA: Frontend - Update DataSource Form to Use Dynamic Categories | High | 3 |
| BETA: Frontend - Add Admin Menu Item & Route | High | 2 |

#### Phase 2: Security (2 tasks)
| Task | Priority | Complexity |
|------|----------|------------|
| BETA: Security - Fix Grafana Hardcoded Credentials | High | 2 |
| BETA: Security - Configure Jaeger Elasticsearch Persistence | High | 3 |

#### Phase 3: Documentation (4 tasks)
| Task | Priority | Complexity |
|------|----------|------------|
| BETA: Docs - Create Hebrew User Guide (מדריך למשתמש) | High | 7 |
| BETA: Docs - Create Installation Guide | High | 5 |
| BETA: Docs - Create Admin Guide | Medium | 5 |
| BETA: Docs - Create Release Notes v0.1.0-beta | Medium | 4 |

#### Phase 4: Packaging (4 tasks)
| Task | Priority | Complexity |
|------|----------|------------|
| BETA: Package - Enhance Helm Chart for Production | High | 6 |
| BETA: Package - Build & Tag Docker Images v0.1.0-beta | High | 4 |
| BETA: Package - Create Installation Scripts | High | 4 |
| BETA: Package - Create Release Package Structure | Medium | 3 |

#### Phase 5: Release (2 tasks)
| Task | Priority | Complexity |
|------|----------|------------|
| BETA: Release - Version Bump & Changelog | Medium | 3 |
| BETA: Release - Create Git Tag & GitHub Release | Medium | 2 |

### Execution Order
```
Phase 1 (Backend) → Phase 1 (Frontend) → Phase 2 (Security)
                                              ↓
Phase 3 (Documentation) ←──── Can start in parallel
                                              ↓
Phase 4 (Packaging) ← Requires Phase 1-2 complete
                                              ↓
Phase 5 (Release) ← Requires all phases complete
```

### Command to View Tasks
```
get_overview
search_tasks(tag: "beta")
```
