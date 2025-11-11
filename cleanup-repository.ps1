# Git Repository Cleanup Script
# Generated: 2025-11-11
# Purpose: Remove obsolete files, build artifacts, and reorganize repository structure

param(
    [switch]$DryRun = $false,
    [switch]$SkipBackup = $false
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Git Repository Cleanup Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in a git repository
if (-not (Test-Path ".git")) {
    Write-Host "ERROR: Not in a git repository root directory!" -ForegroundColor Red
    exit 1
}

# Check for uncommitted changes
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "WARNING: You have uncommitted changes!" -ForegroundColor Yellow
    Write-Host "Please commit or stash your changes before running cleanup." -ForegroundColor Yellow
    Write-Host ""
    git status --short
    Write-Host ""
    $continue = Read-Host "Continue anyway? (yes/no)"
    if ($continue -ne "yes") {
        Write-Host "Cleanup cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Create backup branch unless skipped
if (-not $SkipBackup -and -not $DryRun) {
    $backupBranch = "backup-before-cleanup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Write-Host "Creating backup branch: $backupBranch" -ForegroundColor Green
    git branch $backupBranch
    Write-Host "Backup created. To restore: git checkout $backupBranch" -ForegroundColor Gray
    Write-Host ""
}

if ($DryRun) {
    Write-Host "DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# Function to execute git command or show what would be executed
function Invoke-GitCommand {
    param([string]$Command)
    
    if ($DryRun) {
        Write-Host "[DRY RUN] Would execute: $Command" -ForegroundColor Gray
    } else {
        Write-Host "Executing: $Command" -ForegroundColor Cyan
        Invoke-Expression $Command
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Warning: Command failed with exit code $LASTEXITCODE" -ForegroundColor Yellow
        }
    }
}

# Phase 1: Remove Build Artifacts
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "PHASE 1: Removing Build Artifacts" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$buildArtifacts = @(
    "tools/DemoDataGenerator/bin",
    "tools/DemoDataGenerator/obj",
    "tools/ServiceOrchestrator/bin",
    "tools/ServiceOrchestrator/obj"
)

foreach ($artifact in $buildArtifacts) {
    if (Test-Path $artifact) {
        Write-Host "Removing: $artifact" -ForegroundColor Yellow
        Invoke-GitCommand "git rm -r --cached $artifact"
    } else {
        Write-Host "Not found (already removed?): $artifact" -ForegroundColor Gray
    }
}

# Remove log files
Write-Host ""
Write-Host "Removing log files from git tracking..." -ForegroundColor Yellow
$logFiles = git ls-files | Select-String "src/Services/.*/logs/.*\.txt$"
if ($logFiles) {
    foreach ($log in $logFiles) {
        Invoke-GitCommand "git rm --cached '$log'"
    }
} else {
    Write-Host "No log files found in git tracking" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Phase 1 Complete!" -ForegroundColor Green
Write-Host ""

# Phase 2: Remove Obsolete Folders
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "PHASE 2: Removing Obsolete Folders" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$obsoleteFolders = @(
    "Services",
    "Frontend",
    "backups"
)

foreach ($folder in $obsoleteFolders) {
    if (Test-Path $folder) {
        Write-Host "Removing: $folder/" -ForegroundColor Yellow
        Invoke-GitCommand "git rm -r $folder"
    } else {
        Write-Host "Not found (already removed?): $folder" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Phase 2 Complete!" -ForegroundColor Green
Write-Host ""

# Phase 3: Reorganize Root Documentation
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "PHASE 3: Reorganizing Documentation" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Ensure docs/archive exists
if (-not (Test-Path "docs/archive")) {
    Write-Host "Creating docs/archive directory..." -ForegroundColor Yellow
    if (-not $DryRun) {
        New-Item -ItemType Directory -Path "docs/archive" -Force | Out-Null
    }
}

# Move session documentation to archive
$sessionDocs = @(
    "100-PERCENT-COMPLIANCE-IMPLEMENTATION.md",
    "BROWSER-CACHE-ISSUE.md",
    "CLAUDE.md",
    "DEMO-TOOLS-COMPLETE.md",
    "DEMO-TOOLS-DATABASE-ISSUE.md",
    "ENTITY-RELATIONSHIP-ANALYSIS-REPORT.md",
    "METRICS-WORKFLOW-FIXED.md",
    "SCHEMA-PERSISTENCE-FIX-SUMMARY.md",
    "SERVICES-AUDIT-REPORT.md",
    "SESSION-COMPLETE-SUMMARY.md"
)

foreach ($doc in $sessionDocs) {
    if (Test-Path $doc) {
        Write-Host "Moving: $doc -> docs/archive/" -ForegroundColor Yellow
        Invoke-GitCommand "git mv $doc docs/archive/"
    } else {
        Write-Host "Not found: $doc" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Moving verify-demo-data.py to scripts/" -ForegroundColor Yellow
if (Test-Path "verify-demo-data.py") {
    Invoke-GitCommand "git mv verify-demo-data.py scripts/"
} else {
    Write-Host "Not found: verify-demo-data.py" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Removing temporary test files..." -ForegroundColor Yellow
$tempFiles = @(
    "check-patterns.py",
    "check-schema-patterns.ps1",
    "check-transaction-pattern.ps1",
    "clear-browser-cache.html"
)

foreach ($file in $tempFiles) {
    if (Test-Path $file) {
        Invoke-GitCommand "git rm $file"
    } else {
        Write-Host "Not found: $file" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Phase 3 Complete!" -ForegroundColor Green
Write-Host ""

# Commit changes
if (-not $DryRun) {
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host "Committing Changes" -ForegroundColor Cyan
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host ""
    
    $hasChanges = git diff --cached --quiet; $LASTEXITCODE -ne 0
    
    if ($hasChanges) {
        Write-Host "Creating commit with all cleanup changes..." -ForegroundColor Yellow
        git commit -m "chore: repository cleanup - remove build artifacts, backups, and reorganize docs

- Remove build artifacts (bin/obj) from tools projects
- Remove log files from git tracking
- Remove obsolete Services/ and Frontend/ placeholder folders
- Remove backup folders (300+ old files)
- Move session documentation to docs/archive/
- Move verify-demo-data.py to scripts/
- Remove temporary test scripts

This cleanup removes ~500 unnecessary files from git tracking."
        
        Write-Host ""
        Write-Host "Changes committed successfully!" -ForegroundColor Green
    } else {
        Write-Host "No changes to commit (all files already removed?)" -ForegroundColor Yellow
    }
}

# Summary
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Cleanup Summary" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN completed. No actual changes were made." -ForegroundColor Yellow
    Write-Host "Run without -DryRun to execute the cleanup." -ForegroundColor Yellow
} else {
    Write-Host "Repository cleanup completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Review changes: git show HEAD" -ForegroundColor White
    Write-Host "2. Update .gitignore (run: .\update-gitignore.ps1)" -ForegroundColor White
    Write-Host "3. Add tools projects to solution file (manual step)" -ForegroundColor White
    Write-Host "4. Rebuild projects: dotnet build" -ForegroundColor White
    Write-Host "5. Push changes: git push origin main" -ForegroundColor White
    Write-Host ""
    Write-Host "To rollback: git reset --hard $backupBranch" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
