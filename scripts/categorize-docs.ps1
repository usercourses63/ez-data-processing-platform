# Categorize documentation files based on heuristic rules
# Phase 07-01 Task 2: Apply categorization to docs-inventory.csv
# Categories: KEEP, ARCHIVE, DELETE

param(
    [string]$InventoryPath = "c:\Users\UserC\source\repos\EZ\docs-inventory.csv"
)

Write-Host "Loading inventory from $InventoryPath..."
$inventory = Import-Csv -Path $InventoryPath

Write-Host "Applying categorization rules to $($inventory.Count) files..."

foreach ($file in $inventory) {
    $path = $file.Path
    $name = [System.IO.Path]::GetFileName($path)
    $dir = $file.Directory

    # Default to KEEP
    $category = "KEEP"

    # Rule 1: Session logs -> ARCHIVE
    # Matches: *SESSION*, *DAY*COMPLETE*, DAY-*, 2-DAY-*
    if ($name -match 'SESSION|DAY.*COMPLETE|DAY-\d+|^2-DAY-') {
        $category = "ARCHIVE"
    }
    # Rule 2: docs/planning/ entire directory -> ARCHIVE (per GSD "single source of truth" decision)
    elseif ($dir -match '^docs/planning') {
        $category = "ARCHIVE"
    }
    # Rule 3: Root markdown files (directory is empty string)
    elseif ($dir -eq '' -or $dir -eq '.') {
        if ($name -match '^(README|CLAUDE|CHANGELOG)\.md$') {
            $category = "KEEP"
        }
        elseif ($name -match 'RELEASE|COMPLETION-REPORT|FINAL-DEPLOYMENT|VERIFICATION-REPORT') {
            $category = "ARCHIVE"  # Release artifacts
        }
        elseif ($name -match 'DEPLOYMENT-PLAN|DEPLOYMENT-.*STATUS') {
            $category = "ARCHIVE"  # Deployment guides -> will move to docs/deployment/
        }
        elseif ($name -match 'Presentation|SYNC|RECOVERY|GIT-|PRODUCTION-SYNC') {
            $category = "ARCHIVE"  # Presentations, operational logs
        }
        elseif ($name -match 'STATUS|REPORT|SUMMARY') {
            $category = "ARCHIVE"  # Status reports
        }
        else {
            $category = "ARCHIVE"  # Other root files -> archive
        }
    }
    # Rule 4: Service/component READMEs -> KEEP
    elseif ($dir -match '^src/Services|^src/Frontend|^k8s|^tools|^test-data') {
        $category = "KEEP"
    }
    # Rule 5: docs/ reference documentation -> KEEP
    elseif ($dir -match '^docs/(reference|architecture|testing|admin|deployment|design-system|frontend|installation|maintenance|user-guide|troubleshooting)') {
        $category = "KEEP"
    }
    elseif ($path -eq 'docs/DOCUMENTATION-INDEX.md') {
        $category = "KEEP"
    }
    elseif ($path -eq 'docs/README.md') {
        $category = "KEEP"
    }
    elseif ($path -eq 'docs/index.md') {
        $category = "KEEP"
    }
    elseif ($path -eq 'docs/data_processing_prd.md') {
        $category = "KEEP"
    }
    elseif ($path -eq 'docs/PROJECT_STANDARDS.md') {
        $category = "KEEP"
    }
    # Rule 6: Already in archive -> KEEP (in archive location)
    elseif ($dir -match 'archive') {
        $category = "KEEP"
    }
    # Rule 7: release-package -> KEEP (deployment artifacts)
    elseif ($dir -match '^release-package') {
        $category = "KEEP"
    }
    # Rule 8: docs/ root files that are core reference -> KEEP
    elseif ($dir -eq 'docs') {
        if ($name -match 'DOCUMENTATION-INDEX|README|index|data_processing_prd|PROJECT_STANDARDS') {
            $category = "KEEP"
        }
        elseif ($name -match 'COMPREHENSIVE|CLEANUP|ANALYSIS') {
            $category = "ARCHIVE"  # Analysis/cleanup reports
        }
        else {
            $category = "KEEP"  # Other docs root files default to KEEP
        }
    }
    # Rule 9: DELETE candidates - truly deprecated content
    elseif ($name -match '^old-|^deprecated-|^backup-' -and $dir -match 'archive') {
        $category = "DELETE"
    }

    $file.Category = $category
}

# Export updated CSV
$inventory | Export-Csv -Path $InventoryPath -NoTypeInformation -Encoding UTF8

Write-Host ""
Write-Host "Categorization complete!"
Write-Host ""
Write-Host "Category Summary:"
$inventory | Group-Object Category | Sort-Object Count -Descending | Format-Table Name, Count -AutoSize

# Show breakdown by directory for ARCHIVE category
Write-Host ""
Write-Host "ARCHIVE files by directory (top 10):"
$archiveFiles = $inventory | Where-Object { $_.Category -eq 'ARCHIVE' }
$archiveFiles | Group-Object Directory | Sort-Object Count -Descending | Select-Object -First 10 | Format-Table Name, Count -AutoSize

Write-Host ""
Write-Host "DELETE candidates:"
$deleteFiles = $inventory | Where-Object { $_.Category -eq 'DELETE' }
if ($deleteFiles.Count -eq 0) {
    Write-Host "  None identified"
} else {
    $deleteFiles | ForEach-Object { Write-Host "  - $($_.Path)" }
}
