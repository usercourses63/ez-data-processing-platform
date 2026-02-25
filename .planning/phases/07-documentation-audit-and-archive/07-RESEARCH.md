# Phase 7: Documentation Audit & Archive - Research

**Researched:** 2026-02-02
**Domain:** Documentation Management, Technical Writing Organization, Markdown File Categorization
**Confidence:** HIGH

## Summary

This research investigates how to audit, categorize, and archive 428 markdown documentation files across the EZ Platform repository. The goal is to establish a clean, maintainable documentation structure where current, relevant documents are easily discoverable and obsolete/historical content is properly archived.

The project has already undergone one documentation cleanup (October 2025) that reduced the docs/ root from 70+ files to 9 core files. However, since then documentation has grown again (286 files in docs/, 428 total in project), with significant accumulation in planning subdirectories and scattered root-level files.

The key challenge is **categorization criteria**: defining clear rules for what stays, what archives, and what deletes. Session logs (27+ files) need dedicated archival with an index. The solution is a systematic inventory using file age, naming patterns, and content analysis to categorize documents into keep/archive/delete buckets.

**Primary recommendation:** Create a PowerShell script that generates an inventory CSV with metadata (path, modified date, size, category suggestion), then manually review and execute moves in batches. Archive session logs to `/docs/archive/sessions/` with an auto-generated index.

## Standard Stack

The established tools for documentation audit and organization:

### Core (File Management)

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| PowerShell | 7.x | File scanning, metadata extraction | Cross-platform, native Windows integration |
| Get-ChildItem | Core | Recursive file enumeration | Handles large directories efficiently |
| Get-FileHash | Core | Duplicate detection (optional) | SHA256 for reliable comparison |
| ConvertTo-Csv | Core | Inventory export | Standard interchange format |

### Supporting (Organization)

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Git | 2.x | Track documentation moves | All changes should be committed |
| VSCode | 1.85+ | Bulk file review | Multi-file search and preview |
| Markdown Preview | Any | Content validation | Verify documents before archiving |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PowerShell script | Manual file-by-file review | Tedious, error-prone, no inventory |
| CSV inventory | JSON inventory | CSV easier to review in Excel/spreadsheets |
| Git mv | Regular move + git add | Git mv preserves history better |
| Single batch archive | Incremental batches | Single batch is faster, incremental safer |

## Architecture Patterns

### Recommended Documentation Structure

```
docs/
├── index.md                           # Entry point (Docusaurus home)
├── README.md                          # GitHub/browsing navigation
├── data_processing_prd.md             # Requirements (stable reference)
├── PROJECT_STANDARDS.md               # Coding standards (stable reference)
├── DOCUMENTATION-INDEX.md             # Updated master index
│
├── admin/                             # Admin/deployment guides
├── architecture/                      # System architecture
├── deployment/                        # Deployment procedures
├── design-system/                     # UI/UX design docs
├── frontend/                          # Frontend-specific docs
├── installation/                      # Installation guides
├── maintenance/                       # Ops/maintenance docs
├── reference/                         # API refs, technical specs
├── releases/                          # Release notes
├── testing/                           # Test documentation
├── troubleshooting/                   # Troubleshooting guides
├── user-guide/                        # End-user documentation
├── mockups/                           # UI mockups (non-markdown)
├── planning/                          # Active planning docs ONLY
│   └── [active plans only]
│
└── archive/                           # Historical documentation
    ├── sessions/                      # All session logs with index
    │   ├── INDEX.md                   # Auto-generated session index
    │   ├── SESSION-3-SUMMARY.md
    │   ├── SESSION-4-SUMMARY.md
    │   └── ...
    ├── old-reports/                   # Existing old reports
    ├── completed-features/            # Feature impl docs (done)
    └── superseded-plans/              # Old planning docs
```

### Pattern 1: Inventory-First Approach

**What:** Generate complete file inventory before making any changes
**When to use:** Any documentation audit with 100+ files
**Example:**
```powershell
# Source: Documentation audit best practice
# Generate inventory CSV with categorization metadata

$docs = Get-ChildItem -Path "c:\Users\UserC\source\repos\EZ" -Filter "*.md" -Recurse |
    Where-Object { $_.FullName -notmatch "node_modules|\.git" } |
    Select-Object @{N='Path';E={$_.FullName -replace 'c:\\Users\\UserC\\source\\repos\\EZ\\',''}},
                  @{N='Name';E={$_.Name}},
                  @{N='Directory';E={$_.DirectoryName -replace 'c:\\Users\\UserC\\source\\repos\\EZ\\',''}},
                  @{N='ModifiedDate';E={$_.LastWriteTime.ToString('yyyy-MM-dd')}},
                  @{N='SizeKB';E={[math]::Round($_.Length/1KB,2)}},
                  @{N='Category';E={Get-SuggestedCategory $_.Name $_.DirectoryName}},
                  @{N='Action';E={'review'}}

$docs | Export-Csv -Path "docs-inventory.csv" -NoTypeInformation
```

### Pattern 2: Session Log Detection and Archival

**What:** Identify all session-related files using naming patterns, archive with index
**When to use:** Project has accumulated work session documentation
**Example:**
```powershell
# Source: EZ Platform session file patterns observed
# SESSION-*, DAY-*, *-COMPLETE.md, *-SESSION-*.md

$sessionPatterns = @(
    '*SESSION*',
    '*DAY*-COMPLETE*',
    '*-DAY-*',
    '2-DAY-*'
)

$sessionFiles = Get-ChildItem -Path "docs" -Recurse -Filter "*.md" |
    Where-Object {
        $name = $_.Name
        $sessionPatterns | Where-Object { $name -like $_ }
    }

# Move to archive/sessions/
$sessionFiles | ForEach-Object {
    $dest = "docs/archive/sessions/$($_.Name)"
    git mv $_.FullName $dest
}
```

### Pattern 3: Date-Based Archival Criteria

**What:** Files not modified in 90+ days with status/report naming move to archive
**When to use:** Distinguishing current from historical documentation
**Example:**
```powershell
# Source: Documentation audit best practices
$cutoffDate = (Get-Date).AddDays(-90)

$archiveCandidates = Get-ChildItem -Path "docs" -Filter "*.md" -Recurse |
    Where-Object {
        $_.LastWriteTime -lt $cutoffDate -and
        ($_.Name -match 'COMPLETE|STATUS|REPORT|SUMMARY|PROGRESS|ANALYSIS')
    }
```

### Anti-Patterns to Avoid

- **Delete without review:** Always move to archive first; delete in separate phase after validation
- **Flat archive dump:** Maintain sub-categories in archive (sessions/, completed-features/, etc.)
- **Breaking links:** Search for internal links before moving files
- **No inventory backup:** Keep the inventory CSV for audit trail
- **Ignoring root files:** Project root has 23 markdown files that also need attention

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File enumeration | Manual directory listing | Get-ChildItem -Recurse | Handles deep nesting, filters |
| Duplicate detection | Line-by-line comparison | Get-FileHash | Reliable, fast SHA256 |
| CSV generation | Manual text formatting | ConvertTo-Csv | Proper escaping, headers |
| Git history preservation | Regular copy/delete | git mv | Preserves file history |
| Session index | Manual list maintenance | Auto-generated from file list | Always current, no maintenance |
| Broken link detection | Manual grep | markdownlint or custom regex | Pattern-based, comprehensive |

**Key insight:** The existing DOCUMENTATION-INDEX.md (last updated Oct 2025) shows the project values structured navigation. The audit should update this index, not replace the pattern.

## Common Pitfalls

### Pitfall 1: Over-Aggressive Deletion

**What goes wrong:** Deleting files that are still referenced or contain valuable historical context
**Why it happens:** Pressure to "clean up" leads to premature deletion
**How to avoid:**
1. Always archive first, never delete in initial pass
2. Search codebase for file references before archiving
3. Wait 30 days after archival before deletion phase
**Warning signs:** Broken links in other docs, users asking "where did X go?"

### Pitfall 2: Inconsistent Categorization

**What goes wrong:** Similar files end up in different locations
**Why it happens:** No clear categorization criteria documented
**How to avoid:**
1. Document categorization rules in DOCUMENTATION-INDEX.md
2. Use naming conventions to guide placement
3. Review categorization decisions in batches, not individually
**Warning signs:** Multiple "planning" folders, duplicate topic coverage

### Pitfall 3: Missing Session Index

**What goes wrong:** Archived session logs become unsearchable
**Why it happens:** Files moved without creating navigation
**How to avoid:**
1. Generate INDEX.md automatically with file list and dates
2. Include brief summary/context for each session (extracted from first paragraph)
3. Link index from main DOCUMENTATION-INDEX.md
**Warning signs:** Archive folder becomes "dumping ground"

### Pitfall 4: Root File Sprawl Ignored

**What goes wrong:** Project root accumulates status/report files outside docs/
**Why it happens:** Quick status updates saved to root for visibility
**How to avoid:**
1. Include root in audit scope (23 files identified)
2. Move completed reports to docs/releases/ or docs/archive/
3. Establish rule: only README.md, CLAUDE.md, CHANGELOG.md at root
**Warning signs:** 20+ markdown files in project root

### Pitfall 5: Planning Directory Confusion

**What goes wrong:** docs/planning/ and .planning/ have overlapping content
**Why it happens:** GSD uses .planning/, legacy uses docs/planning/
**How to avoid:**
1. Clarify: .planning/ is GSD source of truth (per STATE.md decision)
2. docs/planning/ should only have user-facing planning context
3. Archive completed planning phases from docs/planning/
**Warning signs:** Same topic documented in both locations

## Code Examples

Verified patterns for documentation audit:

### Complete Inventory Script

```powershell
# Source: Documentation audit best practices + EZ Platform patterns
# File: scripts/audit-documentation.ps1

param(
    [string]$RepoRoot = "c:\Users\UserC\source\repos\EZ",
    [string]$OutputPath = "docs-inventory.csv"
)

function Get-SuggestedCategory {
    param([string]$Name, [string]$Directory)

    # Session patterns -> archive/sessions
    if ($Name -match 'SESSION|DAY.*COMPLETE') { return 'archive/sessions' }

    # Already in archive
    if ($Directory -match '\\archive') { return 'keep-in-archive' }

    # Status/Report patterns -> potential archive
    if ($Name -match 'COMPLETE|STATUS|REPORT|SUMMARY|PROGRESS|ANALYSIS') {
        return 'review-for-archive'
    }

    # Planning subdirectories with completed work
    if ($Directory -match 'planning\\(InvalidRecords|Phase-MVP|Task-)') {
        return 'archive/completed-features'
    }

    # Root files that should move to docs/
    if ($Directory -eq $RepoRoot -and $Name -notmatch 'README|CLAUDE|CHANGELOG') {
        return 'move-to-docs'
    }

    return 'keep'
}

$docs = Get-ChildItem -Path $RepoRoot -Filter "*.md" -Recurse |
    Where-Object { $_.FullName -notmatch "node_modules|\.git|\.planning" } |
    Select-Object @{N='Path';E={$_.FullName -replace [regex]::Escape($RepoRoot + '\'),''}}},
                  @{N='Name';E={$_.Name}},
                  @{N='Directory';E={$_.DirectoryName -replace [regex]::Escape($RepoRoot + '\'),''}},
                  @{N='ModifiedDate';E={$_.LastWriteTime.ToString('yyyy-MM-dd')}},
                  @{N='SizeKB';E={[math]::Round($_.Length/1KB,2)}},
                  @{N='Category';E={Get-SuggestedCategory $_.Name $_.DirectoryName}},
                  @{N='Action';E={'review'}}

$docs | Export-Csv -Path $OutputPath -NoTypeInformation
Write-Host "Inventory exported to $OutputPath"
Write-Host "Total files: $($docs.Count)"
Write-Host "Category breakdown:"
$docs | Group-Object Category | Format-Table Name, Count
```

### Session Index Generator

```powershell
# Source: Auto-documentation patterns
# Generate INDEX.md for archived sessions

param([string]$SessionDir = "docs/archive/sessions")

$sessions = Get-ChildItem -Path $SessionDir -Filter "*.md" |
    Where-Object { $_.Name -ne "INDEX.md" } |
    Sort-Object Name

$indexContent = @"
# Session Logs Archive

**Purpose:** Historical work session documentation
**Total Sessions:** $($sessions.Count)
**Date Range:** [Auto-populated]

## Session Index

| Session | Date | Size |
|---------|------|------|
"@

foreach ($session in $sessions) {
    $date = $session.LastWriteTime.ToString('yyyy-MM-dd')
    $sizeKB = [math]::Round($session.Length/1KB, 1)
    $link = "[$($session.BaseName)](./$($session.Name))"
    $indexContent += "`n| $link | $date | ${sizeKB}KB |"
}

$indexContent += @"

---
*Index generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm')*
*Note: This index is auto-generated. Do not edit manually.*
"@

$indexContent | Out-File -FilePath "$SessionDir/INDEX.md" -Encoding UTF8
Write-Host "Generated session index with $($sessions.Count) entries"
```

### Verification After Archive

```powershell
# Source: Post-audit validation
# Check for broken internal links

param([string]$DocsDir = "docs")

$mdFiles = Get-ChildItem -Path $DocsDir -Filter "*.md" -Recurse
$brokenLinks = @()

foreach ($file in $mdFiles) {
    $content = Get-Content $file.FullName -Raw

    # Match markdown links: [text](path.md) or [text](./path.md)
    $links = [regex]::Matches($content, '\[([^\]]+)\]\(([^)]+\.md)\)')

    foreach ($link in $links) {
        $linkPath = $link.Groups[2].Value

        # Skip external URLs
        if ($linkPath -match '^https?://') { continue }

        # Resolve relative path
        $fullPath = if ($linkPath.StartsWith('./') -or $linkPath.StartsWith('../')) {
            Join-Path $file.DirectoryName $linkPath
        } else {
            Join-Path $DocsDir $linkPath
        }

        if (-not (Test-Path $fullPath)) {
            $brokenLinks += [PSCustomObject]@{
                SourceFile = $file.FullName -replace [regex]::Escape("$DocsDir\"), ''
                BrokenLink = $linkPath
                LinkedText = $link.Groups[1].Value
            }
        }
    }
}

if ($brokenLinks.Count -gt 0) {
    Write-Host "Found $($brokenLinks.Count) broken links:"
    $brokenLinks | Format-Table -AutoSize
} else {
    Write-Host "No broken links found"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual file organization | Automated inventory + categorization | 2025-2026 | Scalable to 400+ files |
| Flat archive folder | Categorized archive subdirectories | Oct 2025 cleanup | Searchable archives |
| Delete immediately | Archive-first policy | Documentation best practices | Reversible changes |
| Single cleanup pass | Incremental audits | Continuous maintenance | Sustainable organization |

**Deprecated/outdated:**
- **docs/current/:** Planned in Oct 2025 but never fully implemented; merge into main structure
- **Multiple CLAUDE.md files:** Root CLAUDE.md is authoritative; archive or delete docs/archive/CLAUDE.md

## Open Questions

Things that couldn't be fully resolved:

1. **docs/planning/ vs .planning/ Overlap**
   - What we know: STATE.md says "GSD becomes single source of truth"
   - What's unclear: Should docs/planning/ be archived entirely or kept for user-facing context?
   - Recommendation: Archive completed features, keep only high-level roadmap docs in docs/planning/

2. **Root File Disposition**
   - What we know: 23 markdown files at project root, many are status/deployment reports
   - What's unclear: Which files should remain at root vs move to docs/releases/?
   - Recommendation: Only README.md, CLAUDE.md, CHANGELOG.md at root; others to docs/

3. **release-package/ and deployment-*/ Directories**
   - What we know: These contain release-specific documentation (5+ md files each)
   - What's unclear: Should these be archived or remain for operational reference?
   - Recommendation: Keep most recent; archive older release packages

4. **Last-Verified Date Tagging**
   - What we know: Success criteria requires "remaining docs tagged with last-verified date"
   - What's unclear: How to implement - YAML frontmatter vs footer vs filename?
   - Recommendation: Add YAML frontmatter `last-verified: YYYY-MM-DD` to kept documents

## Sources

### Primary (HIGH confidence)

- `c:\Users\UserC\source\repos\EZ\docs\DOCUMENTATION-INDEX.md` - Existing index structure and categories
- `c:\Users\UserC\source\repos\EZ\docs\DOCUMENTATION-CLEANUP-SUMMARY.md` - Previous cleanup patterns
- `c:\Users\UserC\source\repos\EZ\.planning\REQUIREMENTS.md` - DOC-01, DOC-02, DOC-03 requirements
- `c:\Users\UserC\source\repos\EZ\.planning\STATE.md` - GSD as single source of truth decision
- Codebase analysis - File counts and structure (428 total, 286 in docs/, 27+ session files)

### Secondary (MEDIUM confidence)

- [Document Archiving in 2026: Challenges, Best Practices](https://www.infrrd.ai/blog/document-archiving-solutions-in-2026) - Archive-first methodology
- [How to Audit Documentation: Complete Guide 2026](https://www.glitter.io/blog/process-documentation/how-to-audit-documentation) - Audit workflow patterns
- [Metadata Tagging Strategy](https://www.siffletdata.com/blog/metadata-tagging) - Categorization frameworks

### Tertiary (LOW confidence)

- [National Archives Digital Preservation Strategy](https://www.archives.gov/preservation/digital-preservation/strategy) - PREMIS metadata concepts (overkill for this project but good reference)
- [SharePoint Managed Metadata 2026 Guide](https://agilityportal.io/blog/sharepoint-managed-metadata-updated-2026-a-complete-guide) - Taxonomy governance concepts

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using PowerShell/Git, proven in Oct 2025 cleanup
- Architecture: HIGH - Building on existing DOCUMENTATION-INDEX.md patterns
- Pitfalls: HIGH - Derived from project history and common documentation mistakes

**Research date:** 2026-02-02
**Valid until:** 90 days (documentation structure stable; no external dependencies)

---

## Appendix: Current File Distribution

### By Location (428 total markdown files)

| Location | Count | Notes |
|----------|-------|-------|
| docs/ (all) | 286 | Main documentation |
| - docs/archive/ | 95 | Already archived |
| - docs/planning/ | 112 | Mixed active/completed |
| - docs/ root | 31 | Core reference + status |
| Project root | 23 | Status reports, guides |
| .planning/ | 26 | GSD planning (exclude from audit) |
| Other (k8s/, tools/, etc.) | 93 | Technical READMEs |

### Session Files Identified (27+)

Located primarily in:
- `docs/planning/Phase-MVP-Deployment/SESSION-*.md` (20+ files)
- `docs/planning/InvalidRecords/INVALIDRECORDS-SERVICE-DAY*.md` (7 files)
- `docs/planning/Task-3-Metrics/TASK-3-DAY-*.md` (3 files)
- `docs/archive/SESSION-COMPLETE-SUMMARY.md` (1 file)
- `docs/PHASE2-SESSION1-COMPLETE.md` (1 file)

### Categorization Heuristics

| Pattern | Suggested Action | Reasoning |
|---------|------------------|-----------|
| `*SESSION*` | archive/sessions/ | Work session logs |
| `*DAY*-COMPLETE*` | archive/sessions/ | Daily progress logs |
| `*-COMPLETE.md` | Review for archive | May be completion report |
| `*-STATUS*.md` | Review for archive | Status at point in time |
| `*-PROGRESS*.md` | Review for archive | Progress snapshot |
| `*-REPORT*.md` | Review for archive | Analysis/status report |
| `*-PLAN*.md` (active) | keep in planning/ | If still relevant |
| `*-PLAN*.md` (completed) | archive/completed-features/ | If feature done |
| Standard guides | keep | USER-GUIDE, INSTALLATION, etc. |
