---
last-verified: 2026-02-02
status: current
---
# EZ Platform - Project Cleanup Plan

**Date:** October 29, 2025  
**Purpose:** Clean up obsolete folders and fix solution file discrepancies  
**Priority:** Medium - Improves maintainability

---

## 🚨 Discrepancies Found

### Solution vs Folder Mismatch

**Projects in DataProcessingPlatform.sln:** 6
1. DataProcessing.Shared
2. DataProcessing.DataSourceManagement
3. DataProcessing.Scheduling
4. DataProcessing.FilesReceiver
5. DataProcessing.Validation
6. DataProcessing.Chat

**Service Folders in src/Services:** 8
1. Shared ✅
2. DataSourceManagementService ✅
3. SchedulingService ✅
4. FilesReceiverService ✅
5. ValidationService ✅
6. DataSourceChatService ✅
7. **SchemaManagementService** ⚠️ NOT in solution
8. **MetricsConfigurationService** ⚠️ NOT in solution

---

## Cleanup Actions Required

### 1. DELETE Obsolete SchemaManagementService Folder 🗑️

**Reason:** Schema management is now 100% consolidated into DataSourceManagementService

**Evidence:**
- SchemaController.cs is in DataSourceManagementService ✅
- SchemaService.cs is in DataSourceManagementService ✅
- SchemaRepository.cs is in DataSourceManagementService ✅
- All Schema models are in DataSourceManagementService ✅
- Frontend uses port 5001 (DataSourceManagement) for schemas ✅

**Folder to DELETE:**
```
src/Services/SchemaManagementService/
```

**Impact:** None - folder is completely unused

**Verification before deletion:**
- ✅ No project reference in solution
- ✅ Frontend not using port 5050
- ✅ All schema functionality confirmed in DataSourceManagementService

**Command to execute:**
```powershell
Remove-Item -Path "src\Services\SchemaManagementService" -Recurse -Force
```

---

### 2. ADD MetricsConfigurationService to Solution OR Document Standalone Status 🔧

**Situation:** MetricsConfigurationService exists, is functional, has .csproj, but NOT in solution file

**Current Status:**
- Has functional MetricsConfigurationService.csproj ✅
- Running on port 5060 ✅
- Frontend IS using it successfully ✅
- Has Program.cs, Controllers, Models, Repositories ✅
- NOT referenced in DataProcessingPlatform.sln ⚠️

**Options:**

**Option A: Add to Solution (Recommended)**
```xml
<!-- Add to DataProcessingPlatform.sln -->
Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "MetricsConfigurationService", "src\Services\MetricsConfigurationService\MetricsConfigurationService.csproj", "{NEW-GUID}"
EndProject
```

**Benefits:**
- Consistent with other services
- Easier build and deployment
- Better IDE integration

**Option B: Document as Standalone**
- Add note to documentation that it runs independently
- Keep separate for specific deployment needs

**Recommendation:** Add to solution for consistency

---

### 3. Clean Up Open Tabs in VS Code

**Obsolete Tabs to Close:**
- `src/Services/SchemaManagementService/Properties/launchSettings.json` ← From deleted service

---

## Implementation Steps

### Step 1: Backup (Safety First)
```powershell
# Create backup of SchemaManagementService before deletion
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item -Path "src\Services\SchemaManagementService" -Destination "backups\SchemaManagementService_$timestamp" -Recurse
```

### Step 2: Delete Obsolete Folder
```powershell
# After backup verification
Remove-Item -Path "src\Services\SchemaManagementService" -Recurse -Force
Write-Host "SchemaManagementService folder deleted successfully" -ForegroundColor Green
```

### Step 3: Add MetricsConfigurationService to Solution

**Manual Edit Required:**
1. Open DataProcessingPlatform.sln
2. Add project reference after DataSourceChatService:
```xml
Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "MetricsConfigurationService", "src\Services\MetricsConfigurationService\MetricsConfigurationService.csproj", "{NEW-GUID-HERE}"
EndProject
```
3. Add to NestedProjects section
4. Save and test build

**OR use dotnet CLI:**
```powershell
cd src\Services\MetricsConfigurationService
dotnet sln ..\..\..\ DataProcessingPlatform.sln add MetricsConfigurationService.csproj
```

### Step 4: Verify Build
```powershell
dotnet build DataProcessingPlatform.sln
```

---

## Expected Outcome

**Before Cleanup:**
- Solution: 6 projects
- Folders: 8 (2 mismatched)
- Confusion about service count

**After Cleanup:**
- Solution: 7 projects (added Metrics)
- Folders: 7 (deleted Schema)
- Clear 1-to-1 mapping

**Service Count:**
- ✅ DataSourceManagementService (includes Schema)
- ✅ SchedulingService
- ✅ FilesReceiverService
- ✅ ValidationService
- ✅ DataSourceChatService
- ✅ MetricsConfigurationService
- ✅ Shared

**Total:** 7 projects (6 services + 1 shared library)

---

## Documentation Updates Needed

After cleanup, update:
1. ✅ **BACKEND-IMPLEMENTATION-STATUS-REPORT.md** - Already updated
2. **COMPREHENSIVE-PROJECT-ANALYSIS.md** - Update service count from 8 to 6
3. **README.md** files - Reference correct service count
4. **Architecture diagrams** - Remove SchemaManagementService

---

## Risks and Mitigation

### Risk: Accidental deletion of needed code
**Mitigation:** Backup before deletion, verify consolidation first ✅

### Risk: Breaking solution build
**Mitigation:** Test build after each change ✅

### Risk: Losing historical context
**Mitigation:** Backup folder preserved in backups/ directory ✅

---

## Verification Checklist

Before declaring cleanup complete:

- [ ] SchemaManagementService folder backed up
- [ ] SchemaManagementService folder deleted
- [ ] Frontend still works (schemas on port 5001)
- [ ] MetricsConfigurationService added to solution
- [ ] Solution builds successfully
- [ ] All services start correctly
- [ ] Documentation updated
- [ ] No broken references in code

---

## Timeline

**Total Time:** 30-45 minutes

- Backup: 2 minutes
- Delete folder: 1 minute  
- Add to solution: 5 minutes
- Verify build: 5 minutes
- Test services: 10 minutes
- Update docs: 15 minutes

---

**Status:** Ready to Execute  
**Risk Level:** Low (with backups)  
**Recommended:** Execute during next maintenance window
