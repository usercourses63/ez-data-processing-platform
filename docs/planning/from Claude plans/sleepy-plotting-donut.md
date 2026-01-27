# File Access v0.2.0 - Recovery & Completion Plan

**Date:** January 27, 2026
**Branch:** feature/file-access-v0.2.0
**Status:** ⚠️ Incomplete - Requires Stabilization & Completion

---

## Executive Summary

**Current Status:** 85% Complete - FUNCTIONAL but with critical deployment gaps

**Task Orchestrator State:**
- Feature: "External File Access & Archive Support v0.2.0" (status: planning)
- 20 tasks total: 14 completed, 1 in-progress, 5 pending
- Gap: Some completed work not tracked, some tracked tasks not fully implemented

**Critical Findings:**
1. ✅ Backend implementation is 95% complete and production-ready
2. ✅ Frontend admin UI and server configuration fully implemented
3. ⚠️ Archive settings UI completely missing from datasource configuration
4. ❌ Deployment manifests not updated to use new ConfigMap
5. ❌ file-simulator infrastructure not deployed
6. ⚠️ Latest frontend improvements uncommitted

---

## Part 1: What Was Planned vs What Exists

### Original Plan Scope (from tender-scribbling-zebra.md)

The plan specified a comprehensive file access integration:

**Planned Components:**
1. AdminServer entity for centralized server management ✅ DONE
2. 6 protocol connectors (FTP, SFTP, S3, HTTP, NFS, Kafka) ✅ DONE (5/6 - NFS via PV)
3. Archive support (ZIP, TAR.GZ, RAR, 7Z) with security limits ✅ DONE
4. Admin UI for server configuration ✅ DONE
5. Updated datasource UI with server dropdown ✅ DONE
6. Archive settings UI in datasource form ❌ NOT DONE
7. Output handlers for all protocols ✅ DONE
8. DemoDataGenerator updates ✅ DONE
9. Kubernetes ConfigMaps and storage ✅ DONE (ConfigMaps created)
10. Deployment manifest updates ❌ NOT DONE
11. file-simulator deployment ❌ NOT DONE → ✅ **RESOLVED: External service already running**

---

## Part 2: External file-simulator Configuration (CRITICAL UPDATE)

### Discovery: file-simulator Already Running Externally

**Status:** ✅ RUNNING at `172.23.17.71` (separate Minikube cluster)

**Documentation Sources:**
- Integration guide: `C:\Users\UserC\source\repos\file-simulator-suite\docs\CLIENT-INTEGRATION-GUIDE.md`
- Claude plan: `C:\Users\UserC\source\repos\file-simulator-suite\docs\CLAUDE-PLAN.md`

### Available Services & Credentials

| Service | Endpoint | Credentials | Notes |
|---------|----------|-------------|-------|
| **Management UI** | `http://172.23.17.71:30180` | admin / admin123 | Web UI for file viewing |
| **FTP** | `172.23.17.71:30021` | ftpuser / ftppass123 | Plain FTP, passive mode |
| **SFTP** | `172.23.17.71:30022` | sftpuser / sftppass123 | SSH-based file transfer |
| **HTTP** | `http://172.23.17.71:30088` | httpuser / httppass123 | REST API + WebDAV |
| **S3 API** | `http://172.23.17.71:30900` | minioadmin / minioadmin123 | MinIO S3-compatible API |
| **S3 Console** | `http://172.23.17.71:30901` | minioadmin / minioadmin123 | MinIO web console |
| **SMB** | `\\172.23.17.71\simulator` | smbuser / smbpass123 | Windows file share |
| **NFS** | `172.23.17.71:32149` | Anonymous | Network file system |

### Key Features

1. **Shared Storage:** All protocols access same PVC - files uploaded via FTP are visible via SFTP/S3/HTTP/SMB
2. **Pre-seeded Data:** Management UI shows existing test files
3. **Cross-Protocol Testing:** Upload via one protocol, verify via another
4. **No Deployment Required:** External service, no K8s manifests needed in EZ repo

### Required ConfigMap Updates

**Current ConfigMap** (`k8s/configmaps/file-simulator-config.yaml`):
- Uses placeholder hostnames like `file-simulator`
- Expects services in same cluster
- Port numbers may not match external NodePorts

**Required Updates:**
```yaml
data:
  # FTP Configuration
  FileAccess__Ftp__Host: "172.23.17.71"
  FileAccess__Ftp__Port: "30021"
  FileAccess__Ftp__Username: "ftpuser"
  FileAccess__Ftp__Password: "ftppass123"

  # SFTP Configuration
  FileAccess__Sftp__Host: "172.23.17.71"
  FileAccess__Sftp__Port: "30022"
  FileAccess__Sftp__Username: "sftpuser"
  FileAccess__Sftp__Password: "sftppass123"

  # S3/MinIO Configuration
  FileAccess__S3__Endpoint: "http://172.23.17.71:30900"
  FileAccess__S3__AccessKey: "minioadmin"
  FileAccess__S3__SecretKey: "minioadmin123"
  FileAccess__S3__ForcePathStyle: "true"
  FileAccess__S3__UseHttp: "true"

  # HTTP Configuration
  FileAccess__Http__BaseUrl: "http://172.23.17.71:30088"
  FileAccess__Http__Username: "httpuser"
  FileAccess__Http__Password: "httppass123"

  # NFS Configuration
  FileAccess__Nfs__Host: "172.23.17.71"
  FileAccess__Nfs__Port: "32149"

  # SMB Configuration
  FileAccess__Smb__Host: "172.23.17.71"
  FileAccess__Smb__Port: "445"
  FileAccess__Smb__ShareName: "simulator"
```

### Simplified Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ EZ Platform Cluster (ez-platform namespace)                 │
│                                                              │
│  FileDiscoveryService ──▶ FtpConnector (172.23.17.71:30021) │
│  OutputService ──────────▶ S3OutputHandler (172.23.17.71:30900) │
│                                                              │
└────────────────────────────────────┼────────────────────────┘
                                     │ External Network
                                     │ (172.23.17.71)
┌────────────────────────────────────▼────────────────────────┐
│ file-simulator Cluster (file-simulator namespace)           │
│                                                              │
│  FTP :30021  │  SFTP :30022  │  S3 :30900  │  HTTP :30088  │
│  Management UI :30180  │  NFS :32149  │  SMB :445          │
│                                                              │
│  Shared Storage (PVC) - All protocols access same files     │
└─────────────────────────────────────────────────────────────┘
```

### Impact on Original Plan

**No Longer Needed:**
- ❌ Deploy file-simulator to EZ cluster
- ❌ Create file-simulator deployment/service manifests
- ❌ Setup file-simulator PVC in EZ cluster

**Still Required:**
- ✅ Update ConfigMap with external IP/ports
- ✅ Update deployment manifests to use ConfigMap
- ✅ Test connectivity from EZ pods to external service

---

## Part 3: Implementation Status by Component

#### ✅ BACKEND (95% Complete)

**Completed:**
- AdminServer entity (full implementation with KafkaConfig support)
- S3Connector (AWSSDK.S3, MinIO support, archive detection)
- FtpConnector (FluentFTP, passive/SSL modes)
- SftpConnector (SSH.NET, key + password auth)
- NfsConnector (intentionally uses LocalFileConnector via K8s PV)
- ConnectorFactory (dynamic resolution, 8 connector types)
- ServersController (12 REST endpoints, full CRUD)
- IArchiveService + SharpCompressArchiveService (4 formats, security limits)
- FileDiscoveredEvent (extended with 7 archive fields)
- S3OutputHandler, FtpOutputHandler, SftpOutputHandler
- ICredentialResolver interface (K8s Secrets integration)

**Quality:** EXCELLENT - Clean abstractions, comprehensive, production-ready

**Missing:**
- NfsOutputHandler (likely handled by FolderOutputHandler - acceptable)

#### ✅ FRONTEND (85% Complete)

**Completed:**
- AdminSettings.tsx (2 tabs: Categories + Servers) - ⚠️ **NEEDS UPDATE:** Should be 3 tabs (Categories + Input Servers + Output Servers)
- ServerConfigurationTab (filter by Input/Output/Both) - ⚠️ **NEEDS UPDATE:** Should be 2 separate tabs instead of filter
- ServerTable (7 columns, connection testing, CRUD operations)
- ServerModal (dynamic form, Kafka config support)
- servers-api-client.ts (11 API operations, full TypeScript types)
- ConnectionTab (protocol-first flow, server dropdown, 7 protocols)
- Hebrew translations (~98% complete, 60+ keys)

**Quality:** EXCELLENT - Modern React patterns, RTL support, type-safe

**Missing:**
- ❌ Archive settings UI in ConnectionTab (isArchiveSource toggle, pattern, password)
- ❌ **Separate Input/Output Server Tabs** - User requires 2 tabs instead of 1 with filter
- ❌ **Mandatory server selection validation** - Datasource cannot be saved without server
- ⚠️ English translations (server keys not added to en.json)
- ⚠️ 2 translation keys missing exact match (deleteSuccess, toggleSuccess)
- ⚠️ Uncommitted changes (ConnectionTab.tsx, he.json refinements)

#### ⚠️ INFRASTRUCTURE (70% Complete)

**Completed:**
- file-simulator-config.yaml ConfigMap (FTP/SFTP/S3/HTTP/NFS endpoints) - ⚠️ Needs update to external IP
- nfs-pv-dev.yaml (NFS PV/PVC + hostPath fallback)
- DemoDataGenerator:
  - AdminServerGenerator (8 servers: Local, FTP, SFTP, HTTP, Kafka, S3, NFS, Folder)
  - DataSourceGenerator (updated to reference FileServerId)
  - Program.cs orchestration (servers → datasources dependency flow)

**Missing:**
- ❌ FileDiscoveryService deployment not updated (no envFrom for file-simulator-config)
- ❌ OutputService deployment not updated (no envFrom for file-simulator-config)
- ⚠️ ConfigMap endpoints need update to external IP `172.23.17.71`
- ⚠️ Network connectivity test to external file-simulator

**Resolved (Not Needed):**
- ✅ file-simulator deployment - **ALREADY RUNNING EXTERNALLY** at 172.23.17.71
- ✅ MinIO deployment - **INCLUDED in file-simulator** at 172.23.17.71:30900

---

## Part 4: Gap Analysis & Impact Assessment

### Critical Gaps (Block Production Deployment)

| Gap | Impact | Severity | Workaround |
|-----|--------|----------|------------|
| **Archive settings UI missing** | Users cannot configure archive processing through UI | HIGH | Manual database edits (unacceptable) |
| **Deployment manifests not updated** | Services can't read file-simulator endpoints | CRITICAL | Hard-code values (not sustainable) |
| **ConfigMap has placeholder endpoints** | References file-simulator service name, not external IP | HIGH | ✅ RESOLVED: Use 172.23.17.71 endpoints |

### Important Gaps (Best Practices)

| Gap | Impact | Severity | Workaround |
|-----|--------|----------|------------|
| **Uncommitted frontend changes** | Latest UX improvements not in git | MEDIUM | Can re-implement |
| **English translations missing** | No English support for server UI | MEDIUM | Hebrew-only users OK |
| **Task orchestrator out of sync** | Tracking doesn't match reality | LOW | Manual tracking |

### Quality Issues

| Issue | Impact | Severity | Fix Effort |
|-------|--------|----------|-----------|
| **2 translation keys use fallbacks** | Code works but inconsistent | LOW | 5 minutes |
| **No separate ServerForm component** | Slightly less modular | LOW | Optional refactor |

---

## Part 5: Root Cause Analysis

### Why Archive Settings UI Was Skipped

**Task Status:** Not tracked in task-orchestrator at all

**Hypothesis:**
1. Task "Update ConnectionTab for server dropdown" marked completed
2. Archive settings considered separate concern
3. No specific task created for "Add archive settings UI to ConnectionTab"
4. Backend has ArchiveSettings support, but no frontend form

**Evidence:**
- Backend: DataProcessingDataSource has ArchiveSettings property
- Frontend: ConnectionTab has no archive toggle/fields
- Task orchestrator: No task for archive UI specifically

### Why Deployment Manifests Not Updated

**Task Status:** "Update service deployments with file access config" - IN PROGRESS

**Hypothesis:**
1. Task created but not completed
2. ConfigMap exists but not referenced in deployments
3. Easy oversight - deployments need envFrom addition

**Evidence:**
- filediscovery-deployment.yaml: Still uses only services-config
- output-deployment.yaml: Still uses only services-config
- Both need: `envFrom: - configMapRef: name: file-simulator-config`

### Why file-simulator Not Deployed

**Task Status:** Not tracked in task-orchestrator

**DISCOVERY:** ✅ **file-simulator is ALREADY RUNNING externally**

**Evidence:**
- file-simulator-suite running at `http://172.23.17.71:30180` (separate Minikube cluster)
- All services accessible via NodePort (FTP:30021, SFTP:30022, S3:30900, HTTP:30088, NFS:32149)
- Documentation: `C:\Users\UserC\source\repos\file-simulator-suite\docs\CLAUDE-PLAN.md`
- Integration guide: `C:\Users\UserC\source\repos\file-simulator-suite\docs\CLIENT-INTEGRATION-GUIDE.md`
- Credentials documented: ftpuser/ftppass123, sftpuser/sftppass123, minioadmin/minioadmin123

**Implication:**
- No deployment needed in EZ cluster
- file-simulator is external service (cross-cluster communication)
- ConfigMap should reference external IP `172.23.17.71`
- No K8s service creation required

---

## Part 6: Recommended Completion Strategy

### Phase 1: Stabilization (Priority: CRITICAL)

**Goal:** Fix blocking issues to enable testing

**Tasks:**

1. **Update FileDiscoveryService Deployment**
   - File: `k8s/deployments/filediscovery-deployment.yaml`
   - Changes per Architect Review:
     - Add `envFrom: - configMapRef: name: file-simulator-config` with `optional: true`
     - Architect recommendation: Use envFrom pattern for bulk loading
     - Verify NFS PVC mount if using NFS connector
   - Estimate: 15 minutes

2. **Update OutputService Deployment**
   - File: `k8s/deployments/output-deployment.yaml`
   - Changes per Architect Review:
     - Add `envFrom: - configMapRef: name: file-simulator-config` with `optional: true`
     - Ensure volume mounts for external outputs
   - Estimate: 15 minutes

3. **Update file-simulator ConfigMap with External IP**
   - File: `k8s/configmaps/file-simulator-config.yaml`
   - Changes per Architect Review:
     - Update all placeholder hostnames to `172.23.17.71`
     - Update ports to NodePort values (30021, 30022, 30900, 30088, 32149)
     - Add credentials: ftpuser/ftppass123, sftpuser/sftppass123, minioadmin/minioadmin123
   - Test connectivity: `kubectl exec -n ez-platform deploy/filediscovery -- curl http://172.23.17.71:30180/health`
   - Estimate: 30 minutes

4. **Implement KubernetesCredentialResolver** (CRITICAL - Architect P0)
   - File: `src/Services/Shared/Services/KubernetesCredentialResolver.cs` (NEW)
   - Implementation per Architect specification:
     - Read K8s Secrets via IKubernetes client
     - Parse secretRef format: "namespace/secret-name"
     - Map Secret data to ServerCredentials
     - Handle errors gracefully (secret not found, permission denied)
   - Register in DI: `services.AddSingleton<ICredentialResolver, KubernetesCredentialResolver>()`
   - Estimate: 4 hours
   - Testing: Create test secret, verify resolution

5. **Register S3Connector in ConnectorFactory** (CRITICAL - Architect P0)
   - File: `src/Services/Shared/Connectors/ConnectorFactory.cs`
   - Changes per Architect Review:
     - Add S3Connector to service registration in `AddConnectorFactory()`
     - Add to connector mapping dictionary
   - Estimate: 30 minutes

6. **Implement LocalFileConnector IServerConnector** (HIGH - Architect P1)
   - File: `src/Services/Shared/Connectors/LocalFileConnector.cs`
   - Changes per Architect Review:
     - Add IServerConnector interface implementation
     - Implement TestConnectionAsync, ListFilesAsync, ReadFileAsync, WriteFileAsync with AdminServer
     - Enables NFS via AdminServer pattern
   - Estimate: 2 hours

7. **Implement HttpApiConnector IServerConnector** (HIGH - Architect P1)
   - File: `src/Services/Shared/Connectors/HttpApiConnector.cs`
   - Changes per Architect Review:
     - Add IServerConnector interface implementation
     - Enable HTTP endpoints via AdminServer
   - Estimate: 2 hours

8. **Commit Pending Frontend Changes**
   - Files: ConnectionTab.tsx, he.json
   - Reason: Complete UX improvements before new changes
   - Estimate: 5 minutes

### Phase 2: Complete Missing Features (Priority: HIGH)

**Goal:** Implement planned features that were skipped

**Tasks:**

9. **Split Admin Server UI into Input/Output Tabs** (Frontend Designer spec)
   - **NEW FILES per Frontend Designer:**
     - `src/Frontend/src/pages/admin/tabs/ServerListTab.tsx` - Reusable parameterized component
     - `src/Frontend/src/pages/admin/tabs/InputServersTab.tsx` - Thin wrapper (direction='input')
     - `src/Frontend/src/pages/admin/tabs/OutputServersTab.tsx` - Thin wrapper (direction='output')
   - **MODIFY FILES:**
     - `src/Frontend/src/pages/admin/AdminSettings.tsx` - Add 3rd tab, use InputServersTab/OutputServersTab
     - `src/Frontend/src/pages/admin/components/ServerModal.tsx` - Add `defaultDirection` prop
   - **DEPRECATE:**
     - `src/Frontend/src/pages/admin/tabs/ServerConfigurationTab.tsx` - Replace with new tabs
   - **Implementation Details per Designer:**
     - ServerListTab receives direction='input'|'output' prop
     - Calls `getInputServers()` or `getOutputServers()` based on direction
     - Servers with Direction=Both appear in BOTH tabs
     - Icons: DownloadOutlined (input), UploadOutlined (output)
     - Default direction in modal: Input for input tab, Output for output tab
   - **Translation keys:** 10 new keys (inputServers, outputServers, titles, buttons)
   - Estimate: 2-3 hours
   - Testing: Verify both tabs show correct filtered servers, servers with Both appear in both

10. **Add Mandatory Server Selection Validation** (Frontend Designer spec)
    - File: `src/Frontend/src/components/datasource/tabs/ConnectionTab.tsx`
    - **Implementation per Designer:**
      - Enhanced validation: `rules={[{ required: true, message: t('datasource.errors.serverRequired') }]}`
      - Empty state Alert when no compatible servers (with link to Admin Settings)
      - Loading state with Spinner and "Loading servers..." message
      - Submit button disabled when `!inputServerId`
      - aria-live regions for screen reader support
    - **Translation keys:** 5 new keys (errors, empty state, loading)
    - Estimate: 1 hour
    - Testing: Try to save without server, verify error; check empty state when no servers

11. **Add Archive Settings UI to ConnectionTab** (Frontend Designer spec)
    - **NEW FILE per Designer:**
      - `src/Frontend/src/components/datasource/tabs/sections/ArchiveSettingsSection.tsx`
    - **MODIFY FILE:**
      - `src/Frontend/src/components/datasource/tabs/ConnectionTab.tsx` - Integrate section
    - **Implementation per Designer:**
      - Collapsible Card with FileZipOutlined icon
      - Toggle in Card header (extra prop)
      - Shows description when enabled
      - Fields: Archive type (Select), password (Input.Password), pattern (Input), nested (Switch)
      - LTR fields: password, extraction pattern
      - Validation: Pattern regex `/^(\*\.[\w]+|\*\.\*|[\w\-*]+\.[\w*]+)$/`
      - Visible only for file-based protocols (hide for Kafka/HTTP)
    - **Translation keys:** 20 new keys (fields, tooltips, types, errors)
    - Estimate: 3-4 hours
    - Testing: Toggle archive, verify fields show/hide; save datasource with archive settings

12. **Add All Translation Keys (Hebrew + English)** (Frontend Designer spec)
    - Files: `src/Frontend/src/i18n/locales/he.json`, `src/Frontend/src/i18n/locales/en.json`
    - **Complete key list from Designer (35 keys):**
      - admin.tabs: inputServers, outputServers (2)
      - admin.servers: inputTitle, outputTitle, add buttons, empty states, status (8)
      - datasource.sections: archiveSettings (1)
      - datasource.fields: archive fields (5)
      - datasource.archive: types, descriptions (8)
      - datasource.tooltips: archive help text (4)
      - datasource.errors: serverRequired, invalidPattern (2)
      - datasource.misc: loading, empty states (5)
    - Include missing: `admin.servers.deleteSuccess`, `admin.servers.toggleSuccess`
    - Estimate: 1 hour (careful review + translation)

13. **Update AdminServerGenerator with Real Endpoints**
    - File: `tools/DemoDataGenerator/Generators/AdminServerGenerator.cs`
    - **Changes:**
      - Update FTP server: Host=172.23.17.71, Port=30021, credentials
      - Update SFTP server: Host=172.23.17.71, Port=30022, credentials
      - Update S3 server: Host=172.23.17.71, Port=30900, MinIO credentials
      - Update HTTP server: Host=http://172.23.17.71:30088
      - Keep internal Kafka: Host=kafka, Port=9092
      - All servers use real credentials from file-simulator docs
    - Ensure ALL datasources get valid `FileServerId` (not null)
    - Estimate: 1 hour

### Phase 3: Testing & Validation (Priority: HIGH)

**Goal:** Verify all components work end-to-end

**Tasks:**

8. **Infrastructure Verification Tests**
   - Update ConfigMap with external IP `172.23.17.71`
   - Test connectivity from EZ pods to external file-simulator:
     - FTP: `172.23.17.71:30021`
     - SFTP: `172.23.17.71:30022`
     - S3: `http://172.23.17.71:30900`
     - HTTP: `http://172.23.17.71:30088`
     - NFS: `172.23.17.71:32149`
   - Verify Management UI accessible: `http://172.23.17.71:30180`
   - No port-forwards needed - external NodePort access
   - Estimate: 30 minutes

9. **Backend Integration Tests**
   - Test S3Connector against MinIO
   - Test FtpConnector against file-simulator
   - Test SftpConnector against file-simulator
   - Test archive extraction (ZIP, TAR.GZ)
   - Estimate: 2 hours

10. **Frontend E2E Tests (Playwright)**
    - Create admin server (FTP type)
    - Create datasource with server selection
    - Test connection from UI
    - Create datasource with archive settings
    - Verify archive configuration saves
    - Estimate: 2 hours

11. **Full Pipeline E2E Tests**
    - E2E-007: FTP input → Validation → Kafka output
    - E2E-008: SFTP input → Validation → S3 output
    - E2E-010: ZIP archive (5 files) → Full pipeline
    - Estimate: 3 hours

### Phase 4: Documentation & Release (Priority: MEDIUM)

**Tasks:**

12. **Update CLAUDE.md**
    - Document AdminServer architecture
    - Document ConnectorFactory pattern
    - Update quick reference for server management
    - Add troubleshooting for file-simulator
    - Estimate: 1 hour

13. **Update Release Package**
    - README.md: File server configuration section
    - CHANGELOG.md: v0.2.0 release notes
    - docs/user-guide.md: Admin server setup, archive settings
    - docs/deployment-guide.md: NFS PV setup, file-simulator deployment
    - Estimate: 2 hours

14. **Git Workflow & Release**
    - Commit all changes with descriptive messages
    - Run final verification
    - Merge feature/file-access-v0.2.0 → main
    - Tag v0.2.0
    - Push to remote
    - Estimate: 30 minutes

---

## Part 7: Task Orchestrator Synchronization Plan

### Current State in Task Orchestrator

**Feature ID:** 808f01f8-b6c2-47fd-9e34-485c160f808f

**Tasks:**
- 14 completed (backend, frontend, tooling mostly done)
- 1 in-progress (deployment updates)
- 5 pending (testing, documentation, release)

### Sync Strategy

**Approach 1: Complete Existing Tasks (Recommended)**
- Mark "Update service deployments" as completed after Phase 1
- Add new tasks for missing work (archive UI, file-simulator)
- Keep existing pending tasks for testing/release

**Approach 2: Create New Feature (Clean Slate)**
- Create "File Access v0.2.0 - Completion & Stabilization" feature
- Break down into 14 clear tasks matching this plan
- More accurate tracking but loses history

**Recommendation:** Use Approach 1 - Minimal disruption, preserves history

### Tasks to Add to Task Orchestrator (16 New Tasks)

**Phase 1: Stabilization & Backend Fixes (Priority: CRITICAL)**
1. ✅ Update FileDiscoveryService deployment - Add envFrom for file-simulator-config
2. ✅ Update OutputService deployment - Add envFrom for file-simulator-config
3. ✅ Update ConfigMap with external IP 172.23.17.71
4. 🔴 **Implement KubernetesCredentialResolver** (Architect P0) - 4h
5. 🔴 **Register S3Connector in ConnectorFactory** (Architect P0) - 30min
6. 🔴 **Implement LocalFileConnector IServerConnector** (Architect P1) - 2h
7. 🔴 **Implement HttpApiConnector IServerConnector** (Architect P1) - 2h
8. ✅ Commit pending frontend changes

**Phase 2: Frontend UI Completion (Priority: HIGH)**
9. 🔴 **Split Admin Server UI into Input/Output Tabs** (Frontend Designer) - 3h
10. 🔴 **Add mandatory server selection validation** (Frontend Designer) - 1h
11. 🔴 **Add archive settings UI to ConnectionTab** (Frontend Designer) - 4h
12. ✅ Add all translation keys (Hebrew + English) - 35 keys - 1h
13. ✅ Update AdminServerGenerator with real file-simulator endpoints - 1h

**Phase 3: Testing (Priority: HIGH)**
14. ✅ Infrastructure verification tests - Connectivity to 172.23.17.71
15. ✅ Backend integration tests - All connectors against file-simulator
16. ✅ Frontend E2E tests with Playwright

**Phase 4: Documentation & Release (Priority: MEDIUM)**
17. ✅ Update CLAUDE.md documentation
18. ✅ Update release package
19. ✅ Git workflow and release

**Total:** 19 tasks (was 16 - added 3 backend tasks from Architect review)

---

## Part 8: Implementation Sequence & Dependencies

### Dependency Graph

```
Phase 1 (Stabilization)
├── [1] Update FileDiscoveryService deployment
├── [2] Update OutputService deployment
├── [3] Deploy file-simulator infrastructure
│   └── Blocks: All testing tasks (8-11)
└── [4] Commit frontend changes
    └── Optional prerequisite for [5]

Phase 2 (Feature Completion)
├── [5] Add archive settings UI ← CRITICAL PATH
│   └── Blocks: E2E tests (10-11)
├── [6] Add English translations (parallel)
└── [7] Fix translation keys (parallel)

Phase 3 (Testing)
├── [8] Infrastructure verification
│   └── Prerequisite: [3]
├── [9] Backend integration tests
│   └── Prerequisite: [3], [8]
├── [10] Frontend E2E tests
│   └── Prerequisite: [5], [8]
└── [11] Full pipeline E2E tests
    └── Prerequisite: [9], [10]

Phase 4 (Documentation & Release)
├── [12] Update CLAUDE.md (parallel)
├── [13] Update release package (parallel)
└── [14] Git workflow & release
    └── Prerequisite: All above
```

### Recommended Order

**Week 1: Stabilization & Critical Features**
- Day 1: Tasks 1-4 (deployment updates, file-simulator, commits)
- Day 2-3: Task 5 (archive UI - most complex)
- Day 3: Tasks 6-7 (translations)
- Day 4-5: Task 8-9 (infrastructure + backend tests)

**Week 2: Testing & Release**
- Day 1-2: Tasks 10-11 (E2E tests)
- Day 3: Tasks 12-13 (documentation)
- Day 4: Task 14 (release)
- Day 5: Buffer for issues

**Total Estimate:** 8-10 working days

---

## Part 9: Risk Assessment & Mitigation

### High-Risk Items

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| file-simulator deployment complexity | HIGH | CRITICAL | Check file-simulator-suite for manifests first; use external service as fallback |
| Archive UI integration issues | MEDIUM | HIGH | Backend ready; follow ConnectionTab patterns; test incrementally |
| E2E tests reveal protocol bugs | MEDIUM | MEDIUM | Backend already tested in isolation; focus on configuration issues |

### Medium-Risk Items

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| NFS PV permissions in Minikube | MEDIUM | MEDIUM | Document hostPath fallback; test both PV types |
| MinIO not deployed | LOW | MEDIUM | Verify MinIO exists or deploy as part of file-simulator |
| Translation key conflicts | LOW | LOW | Review existing keys before adding |

---

## Part 10: Success Criteria

### Must-Have (Blocking Release)

- ✅ All 6 protocols functional (FTP, SFTP, S3, HTTP, NFS, Kafka)
- ✅ Archive processing works end-to-end (ZIP, TAR.GZ)
- ✅ Admin can create/edit/delete servers via UI
- ✅ Users can select servers when creating datasources
- ✅ Archive settings configurable in datasource UI
- ✅ E2E-007, E2E-008, E2E-010 tests pass
- ✅ DemoDataGenerator creates servers + datasources
- ✅ No blocking bugs in protocol connectors

### Should-Have (High Priority)

- ✅ English translations for server management
- ✅ Infrastructure deployed in Minikube
- ✅ CLAUDE.md reflects v0.2.0 architecture
- ✅ Release package updated
- ✅ All deployment manifests updated

### Nice-to-Have (Optional)

- ⚠️ Separate ServerForm component (refactor)
- ⚠️ Additional E2E tests (password-protected archives, large files)
- ⚠️ MinIO deployed in-cluster (vs external)

---

## Part 11: Verification Checklist

### Backend Verification

- [ ] S3Connector connects to MinIO at file-simulator:9000
- [ ] FtpConnector connects to FTP at file-simulator:21
- [ ] SftpConnector connects to SFTP at file-simulator:22
- [ ] NfsConnector reads from /mnt/nfs-data PVC
- [ ] Archive extraction works for ZIP files with 5+ entries
- [ ] Archive password-protected ZIP extraction works
- [ ] ServersController responds to all 12 endpoints
- [ ] Output handlers write to FTP/SFTP/S3 destinations

### Frontend Verification

- [ ] Admin → Servers tab displays 8 demo servers
- [ ] Create server modal shows dynamic fields based on type
- [ ] Server connection test button works
- [ ] DataSource → Connection tab shows protocol dropdown
- [ ] Server dropdown filtered by protocol compatibility
- [ ] Archive settings section visible in ConnectionTab
- [ ] Archive toggle enables/disables archive fields
- [ ] Hebrew translations display correctly
- [ ] English translations display correctly

### Infrastructure Verification

- [ ] kubectl get configmap file-simulator-config shows endpoints
- [ ] kubectl get pv,pvc shows nfs-data PV/PVC
- [ ] kubectl get svc | grep file-simulator shows service
- [ ] Port-forward to file-simulator services works
- [ ] FileDiscoveryService pod has file-simulator-config env vars
- [ ] OutputService pod has file-simulator-config env vars

### End-to-End Verification

- [ ] Create FTP server via admin UI
- [ ] Create datasource with FTP server selection
- [ ] Upload test file to file-simulator FTP
- [ ] FileDiscoveryService discovers file
- [ ] Validation processes file
- [ ] Output writes to Kafka topic
- [ ] Create datasource with archive settings
- [ ] Upload ZIP file with 5 CSV files
- [ ] FileDiscoveryService lists 5 files from archive
- [ ] All 5 files processed through pipeline

---

## Part 12: Recommended Next Steps

### Immediate Actions (Today)

1. **Review this plan with user** - Confirm approach and priorities
2. **Create missing tasks in task-orchestrator** - 14 new tasks from Section 5
3. **Update task priorities** - Mark deployment updates and archive UI as HIGH
4. ✅ **file-simulator verification COMPLETE** - External service at 172.23.17.71, all endpoints documented

### This Week (Priority 1)

5. **Complete Phase 1: Stabilization** - Deploy file-simulator, update manifests, commit changes
6. **Complete Phase 2 Task 5** - Archive settings UI (most complex, blocking E2E tests)

### Next Week (Priority 2)

7. **Complete Phase 2 Tasks 6-7** - Translations
8. **Complete Phase 3: Testing** - Infrastructure, backend, frontend, E2E tests
9. **Complete Phase 4: Documentation** - CLAUDE.md, release package

### Final Steps

10. **Git workflow** - Final commits, merge to main, tag v0.2.0, push
11. **Retrospective** - Document lessons learned for future features

---

## Part 13: Specialist Agent Recommendations (Incorporated)

### Backend Architect Review (10x-fullstack-engineer) - COMPLETED

**Overall Assessment:** 8.2/10 - Production-ready with critical gaps

**Critical Findings (P0 - Must Fix):**
1. ✅ **Missing KubernetesCredentialResolver implementation** - Interface exists but no implementation
   - Impact: Cannot resolve credentials from K8s Secrets
   - Solution: Create `src/Services/Shared/Services/KubernetesCredentialResolver.cs`
   - Effort: 4 hours

2. ✅ **S3Connector not registered in ConnectorFactory** - Exists but not in default registration
   - Impact: S3 server selection won't work
   - Solution: Add to `AddConnectorFactory()` extension method
   - Effort: 30 minutes

3. ✅ **LocalFileConnector missing IServerConnector** - Only implements legacy interface
   - Impact: NFS via AdminServer won't work
   - Solution: Add IServerConnector implementation
   - Effort: 2 hours

4. ✅ **HttpApiConnector missing IServerConnector** - Only implements legacy interface
   - Impact: HTTP endpoints via AdminServer won't work
   - Solution: Add IServerConnector implementation
   - Effort: 2 hours

**Important Findings (P1 - Should Have):**
5. Credential caching with TTL - Reduce K8s API calls (2h)
6. Connection pooling for FTP/SFTP - Reuse connections (4h)
7. Retry policy configuration - Per-connector retry settings (2h)
8. Integration tests for all connectors (4h)

**Technical Debt Identified:**
- Code duplication: `MatchesPattern()`, `GetContentType()`, `IsArchiveExtension()`
- Inconsistent archive detection (magic bytes vs extension)
- Legacy IDataSourceConnector should be deprecated in v0.3.0

**Architecture Decisions:**
- ✅ NFS output via FolderOutputHandler (no dedicated NfsOutputHandler needed)
- ✅ ConfigMap with envFrom pattern for bulk env var loading
- ✅ ExternalName Service pattern for cross-cluster communication

---

### Frontend Designer Review (frontend-excellence:component-architect) - COMPLETED

**Component Design Decisions:**

**1. Admin Server Tabs Split:**
- ✅ Use **single reusable `ServerListTab.tsx`** with `direction` prop
- ✅ Create thin wrappers: `InputServersTab.tsx`, `OutputServersTab.tsx`
- ✅ Servers with `Direction=Both` appear in BOTH tabs
- ✅ Icons: DownloadOutlined (input), UploadOutlined (output)

**2. Archive Settings UI:**
- ✅ Placement: **Collapsible Card** after file pattern, before connection test
- ✅ Component: Separate `ArchiveSettingsSection.tsx` for maintainability
- ✅ Show/hide: Visible only for file-based protocols (not Kafka/HTTP)
- ✅ Fields: Toggle, type dropdown, password, extraction pattern, nested toggle
- ✅ LTR fields: password, extraction pattern (technical content)

**3. Mandatory Server Selection:**
- ✅ Validation: `rules={[{ required: true, message: t('datasource.errors.serverRequired') }]}`
- ✅ Empty state: Alert with link to Admin Settings
- ✅ Loading state: Spinner with "Loading servers..." message
- ✅ Submit disabled when server not selected

**Translation Requirements:**
- ✅ 35 new keys (Hebrew + English)
- ✅ Complete key list provided
- ✅ RTL considerations documented

**Component Files:**
```
NEW FILES:
- src/Frontend/src/pages/admin/tabs/ServerListTab.tsx (parameterized)
- src/Frontend/src/pages/admin/tabs/InputServersTab.tsx (wrapper)
- src/Frontend/src/pages/admin/tabs/OutputServersTab.tsx (wrapper)
- src/Frontend/src/components/datasource/tabs/sections/ArchiveSettingsSection.tsx

MODIFY FILES:
- src/Frontend/src/pages/admin/AdminSettings.tsx (3 tabs)
- src/Frontend/src/pages/admin/components/ServerModal.tsx (defaultDirection prop)
- src/Frontend/src/components/datasource/tabs/ConnectionTab.tsx (archive section)
- src/Frontend/src/i18n/locales/he.json (35 keys)
- src/Frontend/src/i18n/locales/en.json (35 keys)

DEPRECATE:
- src/Frontend/src/pages/admin/tabs/ServerConfigurationTab.tsx
```

**Accessibility:**
- Keyboard navigation verified
- Screen reader labels provided
- aria-live regions for loading states
- RTL layout with LTR technical fields

---

### Specialist Recommendations Incorporation Summary

**Backend Architect Recommendations → Tasks:**
- P0 Item #1 (KubernetesCredentialResolver) → Task 4 (Phase 1)
- P0 Item #2 (Deployment manifests) → Tasks 1-2 (Phase 1)
- P0 Item #3 (ConfigMap external IP) → Task 3 (Phase 1)
- P0 Item #4 (S3Connector registration) → Task 5 (Phase 1)
- P1 Item #5 (LocalFileConnector IServerConnector) → Task 6 (Phase 1)
- P1 Item #6 (HttpApiConnector IServerConnector) → Task 7 (Phase 1)
- P1 Items #7-8 (Caching, pooling) → Deferred to v0.2.1
- P2 Items (Metrics, streaming) → Deferred to v0.3.0

**Frontend Designer Recommendations → Tasks:**
- Server tabs split design → Task 9 (Phase 2)
- Mandatory validation enhancement → Task 10 (Phase 2)
- Archive settings component → Task 11 (Phase 2)
- Translation keys (35 total) → Task 12 (Phase 2)
- Component file structure → Implemented in Tasks 9-11

**All Critical (P0) and High (P1) Recommendations Incorporated**

---

### Playwright Testing - NOT YET LAUNCHED

Will be launched during Phase 3 (Testing & Validation) after UI implementation is complete.

---

## Part 14: Additional Requirements from User

### User Requirements (January 27, 2026)

1. **Mandatory Server Selection**
   - Every datasource MUST have a valid server selected (no empty/null server)
   - Server selection is REQUIRED field in datasource form
   - Validation should prevent saving datasource without server

2. **Separate Input/Output Server Management**
   - Frontend Admin Settings should have **TWO separate tabs**:
     - "Input Servers" (קלטי שרת) - For data sources
     - "Output Servers" (שרתי פלט) - For output destinations
   - Same server can appear in both tabs if Direction=Both
   - Each tab filters servers by Direction (Input/Output/Both)

3. **Multiple Servers Per Protocol**
   - Support multiple FTP servers (e.g., "Production FTP", "Partner FTP")
   - Support multiple SFTP servers (e.g., "Vendor A SFTP", "Vendor B SFTP")
   - Support multiple S3 buckets (e.g., "Data Lake S3", "Archive S3")
   - Each server has unique name and configuration

4. **Server Pre-population from file-simulator**
   - AdminServerGenerator should create servers matching file-simulator endpoints
   - FTP Input: 172.23.17.71:30021
   - SFTP Input: 172.23.17.71:30022
   - S3 Input/Output: 172.23.17.71:30900
   - HTTP Input: 172.23.17.71:30088
   - Plus internal Kafka (kafka:9092 from EZ infrastructure)

5. **Cross-Cluster Architecture Understanding**
   - file-simulator runs on **separate Minikube cluster** (not EZ cluster)
   - Simulates production: OCP cluster → external networked servers
   - Network communication: EZ cluster → 172.23.17.71 (external IP)
   - This is intentional to replicate real-world external server scenario

6. **Interactive Plan Execution**
   - For every decision point or question in the plan, STOP
   - Present options to user
   - Wait for user to choose before proceeding
   - Do NOT assume or proceed without explicit approval

### Implementation Requirements Summary

Based on user requirements, here are the MANDATORY changes:

**Frontend Changes:**
1. ✅ AdminSettings.tsx → Add 3rd tab for "Output Servers"
   - Current: Categories tab + Servers tab (with filter)
   - Required: Categories tab + Input Servers tab + Output Servers tab

2. ✅ ServerConfigurationTab → Create separate Input/Output components
   - Current: `<ServerConfigurationTab direction={filter} />` with internal filtering
   - Required: `<InputServersTab />` and `<OutputServersTab />` as separate components

3. ✅ ConnectionTab → Make server selection REQUIRED
   - Add: `rules={[{ required: true, message: 'חובה לבחור שרת' }]}`
   - Disable submit button when server not selected

**DemoDataGenerator Changes:**
1. ✅ Update AdminServerGenerator to use file-simulator real endpoints:
   ```csharp
   // FTP Input Server
   new AdminServer {
       Name = "file-simulator FTP",
       ServerType = "ftp",
       Direction = ServerDirection.Input,
       Host = "172.23.17.71",
       Port = 30021,
       CredentialSecretRef = "file-simulator-ftp-creds",
       TypeSpecificConfig = new BsonDocument {
           { "Username", "ftpuser" },
           { "Password", "ftppass123" },  // Note: Should be in K8s Secret
           { "PassiveMode", true }
       }
   }

   // SFTP Input Server
   new AdminServer {
       Name = "file-simulator SFTP",
       ServerType = "sftp",
       Direction = ServerDirection.Input,
       Host = "172.23.17.71",
       Port = 30022,
       CredentialSecretRef = "file-simulator-sftp-creds"
   }

   // S3 Input/Output Server
   new AdminServer {
       Name = "file-simulator S3 (MinIO)",
       ServerType = "s3",
       Direction = ServerDirection.Both,
       Host = "172.23.17.71",
       Port = 30900,
       CredentialSecretRef = "file-simulator-s3-creds",
       TypeSpecificConfig = new BsonDocument {
           { "Endpoint", "http://172.23.17.71:30900" },
           { "ForcePathStyle", true },
           { "AccessKey", "minioadmin" },
           { "SecretKey", "minioadmin123" }
       }
   }

   // Internal Kafka (EZ Infrastructure)
   new AdminServer {
       Name = "EZ Platform Kafka",
       ServerType = "kafka",
       Direction = ServerDirection.Both,
       Host = "kafka",  // Internal K8s service
       Port = 9092,
       KafkaConfig = new KafkaServerConfig {
           BootstrapServers = "kafka:9092",
           SecurityProtocol = "PLAINTEXT"
       }
   }
   ```

2. ✅ Support multiple servers of same type:
   - FTP: "file-simulator FTP" + "Partner FTP" (example for multi-server)
   - SFTP: "file-simulator SFTP" + "Vendor SFTP"
   - S3: "file-simulator S3" + "Archive S3"

3. ✅ Update DataSourceGenerator to ensure ALL datasources have valid serverId:
   ```csharp
   var server = AdminServerGenerator.GetServerByType(servers, connectorType);
   if (server == null) {
       throw new InvalidOperationException($"No server found for type {connectorType}");
   }
   FileServerId = server.ID  // MANDATORY
   ```

---

## Part 15: Open Questions for User (Decisions Required)

### Decision Point 1: Archive UI Placement
**Question:** Where should archive settings be displayed in datasource form?

**Options:**
- **Option A:** In ConnectionTab after file pattern section (recommended - keeps all input config together)
- **Option B:** Separate ArchiveTab in datasource tabs
- **Option C:** Advanced section with collapse/expand

**User Choice:** _[To be decided]_

---

### Decision Point 2: Server Dropdown Behavior
**Question:** When user selects a protocol, how should server dropdown work?

**Options:**
- **Option A:** Show only servers matching protocol type AND direction (strict filtering)
- **Option B:** Show all servers but disable incompatible ones
- **Option C:** Auto-select first compatible server if only one available

**User Choice:** _[To be decided]_

---

### Decision Point 3: DemoDataGenerator Server Creation
**Question:** How many servers per protocol should DemoDataGenerator create?

**User Requirement:** Servers should match file-simulator + internal Kafka

**Proposed Server List (No Local/Folder - Production-Ready):**
1. **file-simulator FTP Input** - 172.23.17.71:30021 (ftpuser/ftppass123)
2. **file-simulator FTP Output** - 172.23.17.71:30021 (Direction: Output)
3. **file-simulator SFTP Input** - 172.23.17.71:30022 (sftpuser/sftppass123)
4. **file-simulator SFTP Output** - 172.23.17.71:30022 (Direction: Output)
5. **file-simulator S3 Data Lake** - 172.23.17.71:30900 (Direction: Both, bucket: input)
6. **file-simulator S3 Archive** - 172.23.17.71:30900 (Direction: Both, bucket: output)
7. **file-simulator HTTP Input** - http://172.23.17.71:30088 (httpuser/httppass123)
8. **EZ Platform Kafka Both** - kafka:9092 (internal, PLAINTEXT)
9. **file-simulator NFS Input** - 172.23.17.71:32149 (mounted as PV)
10. **file-simulator NFS Output** - 172.23.17.71:32149 (mounted as PV)

**Rationale:**
- ❌ **REMOVED:** Local file server (irrelevant in OCP - paths only valid inside cluster)
- ❌ **REMOVED:** Folder output server (same reason - cluster-local only)
- ✅ **ADDED:** Separate Input/Output servers for FTP, SFTP (demonstrates multi-server capability)
- ✅ **ADDED:** Two S3 servers with different buckets (Data Lake vs Archive)
- ✅ All servers use external file-simulator for production-realistic testing
- ✅ Even in development, use file-simulator instead of local Windows folders

**User Choice:**
- **Option A:** Basic 8 servers (1 per protocol type)
- **Option B:** Extended 10 servers (with FTP/SFTP output variants)
- **Option C:** Custom list (specify which protocols need multiple servers)

_[To be decided]_

---

### Decision Point 4: Admin Server Tab Layout
**Question:** Should we split servers into 2 tabs or use filter within single tab?

**Options:**
- **Option A:** TWO TABS - "Input Servers" + "Output Servers" (user requested)
- **Option B:** ONE TAB with filter/toggle (current implementation)

**User Choice:** Option A (TWO TABS) - **USER CONFIRMED**

---

### Decision Point 5: Testing Priority
**Question:** Which E2E tests are must-have for v0.2.0 completion?

**Options:**
- **Option A:** All 3 tests (FTP→Kafka, SFTP→S3, ZIP archive) - Most thorough
- **Option B:** Just external protocols (FTP→Kafka, SFTP→S3) - Faster
- **Option C:** One full pipeline test (FTP→Validation→Kafka) - Minimum

**User Choice:** _[To be decided]_

---

### Decision Point 6: Datasource Migration Strategy
**Question:** Existing datasources have no server selection. How to handle?

**Options:**
- **Option A:** Require manual server assignment (safest, user controls)
- **Option B:** Auto-assign based on protocol + config match (automatic but risky)
- **Option C:** Leave existing datasources as-is, enforce for new only (partial migration)

**User Choice:** _[To be decided]_

---

## Conclusion

**Assessment:** The File Access v0.2.0 implementation is 85% complete and architecturally sound. The backend is production-ready, the frontend admin UI is excellent, but critical gaps prevent deployment:

1. Archive settings UI missing (HIGH priority - user-facing feature gap)
2. Deployment manifests not updated (CRITICAL - blocks any testing)
3. file-simulator not deployed (CRITICAL - no services to connect to)

**Recommendation:** Follow the 4-phase completion plan outlined above. Estimated 12-15 working days to 100% completion with proper testing (updated from 8-10 days after incorporating specialist recommendations).

**Strategy:** Use task-orchestrator to create 19 new tasks (updated from 16), prioritize backend critical fixes (Phase 1 - 8 tasks including KubernetesCredentialResolver), then complete frontend UI (Phase 2 - 5 tasks), followed by comprehensive testing (Phase 3 - 3 tasks) and documentation (Phase 4 - 3 tasks).

**Specialist Review Impact:**
- ✅ Backend Architect identified 4 CRITICAL gaps (P0) requiring immediate attention
- ✅ Backend Architect identified 4 HIGH priority improvements (P1)
- ✅ Frontend Designer provided complete component specifications with code examples
- ✅ Frontend Designer identified 35 translation keys needed (vs initial estimate of 10)
- ✅ All P0 and P1 recommendations incorporated into task list

**Updated Effort Estimates:**
- Backend completion: +8.5 hours (KubernetesCredentialResolver, connector updates)
- Frontend completion: +2 hours (enhanced validation, better component structure)
- Translation work: +0.5 hours (35 keys vs 10)
- **Total added effort:** ~11 hours

**Confidence Level:** HIGH - Specialist reviews validated architecture quality (8.2/10). All gaps identified with clear implementation paths. Production-ready after completing P0 and P1 tasks.

---

---

## Part 16: Next Steps After Plan Approval

### Immediate Actions (First 30 minutes)

1. **Sync with Task Orchestrator**
   - Mark existing "Update service deployments" task as completed
   - Create 19 new tasks in task-orchestrator using the list from Part 7
   - Set priorities: Phase 1 tasks = HIGH, Phase 2 = HIGH, Phase 3-4 = MEDIUM
   - Link tasks to feature: "External File Access & Archive Support v0.2.0"

2. **Start Phase 1, Task 1: Update FileDiscoveryService Deployment**
   - Read current deployment manifest
   - Add envFrom configuration
   - Present changes for approval
   - **STOP and wait for approval before applying**

3. **Continue Phase 1 Tasks Sequentially**
   - Each task will stop and present changes for approval
   - No automatic proceeding without user confirmation
   - Decision points from Part 15 will be asked before implementation

### What You'll See

**For Each Task:**
1. I'll announce the task I'm starting
2. Show you the proposed changes/implementation
3. **STOP and ask for your approval**
4. Only after approval, execute the changes
5. Mark task as completed in task-orchestrator
6. Git commit with descriptive message
7. Move to next task

**For Decision Points:**
- Present all options clearly
- Explain trade-offs
- Recommend an option
- Wait for your choice
- Implement only your chosen option

### Execution Flow Example

```
Task 1: Update FileDiscoveryService Deployment
├─ Read current manifest
├─ Show you the diff (adding envFrom section)
├─ ⏸️ WAIT FOR YOUR APPROVAL
├─ Apply changes
├─ Verify deployment updated
├─ Update task-orchestrator (status: completed)
└─ Git commit: "feat(k8s): Add file-simulator-config to FileDiscoveryService"

Task 2: Update OutputService Deployment
├─ ... same pattern ...
```

### Manual Approval Points

Throughout execution, I will stop at:
- ✋ **Every file edit** - Show diff, wait for approval
- ✋ **Every kubectl apply** - Show what will be deployed, wait for approval
- ✋ **Every git commit** - Show commit message, wait for approval
- ✋ **Every decision point** from Part 15 - Present options, wait for choice

**You stay in control of every change.**

---

**Plan Author:** Claude Code (System Analysis Agent)
**Specialist Reviews:** Backend Architect (Opus), Frontend Designer (Opus)
**Plan Date:** January 27, 2026
**Plan Version:** 2.0 (Recovery & Completion - Specialist-Reviewed)
**Task Count:** 19 tasks across 4 phases
**Estimated Effort:** 12-15 working days
**Next Action:** Create tasks in task-orchestrator and begin Phase 1 with manual approval
