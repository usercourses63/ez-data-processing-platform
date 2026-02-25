# Generate comprehensive markdown file inventory
# Phase 07-01 Task 1: Documentation Audit Inventory Generation
# Excludes: node_modules, .git, .planning directories

param(
    [string]$RepoRoot = "c:\Users\UserC\source\repos\EZ",
    [string]$OutputPath = "c:\Users\UserC\source\repos\EZ\docs-inventory.csv"
)

Write-Host "Scanning for markdown files in $RepoRoot..."

# Get all markdown files, excluding node_modules, .git, and .planning
$mdFiles = Get-ChildItem -Path $RepoRoot -Filter "*.md" -Recurse -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.FullName -notmatch '\\.git\\' -and
        $_.FullName -notmatch '\\.planning\\'
    }

Write-Host "Found $($mdFiles.Count) markdown files"

# Create inventory objects
$inventory = $mdFiles | ForEach-Object {
    $relativePath = $_.FullName -replace [regex]::Escape($RepoRoot + '\'), ''
    $relativePath = $relativePath -replace '\\', '/'

    $directory = $_.DirectoryName -replace [regex]::Escape($RepoRoot + '\'), ''
    $directory = $directory -replace '\\', '/'
    # Handle root level files - if directory equals full path, it means it's in the root
    if ($directory -eq $_.DirectoryName -or $directory -match '^[A-Z]:') { $directory = '' }

    [PSCustomObject]@{
        Path = $relativePath
        Directory = $directory
        LastModified = $_.LastWriteTime.ToString('yyyy-MM-dd')
        Size = $_.Length
        Category = 'TBD'
    }
}

# Export to CSV
$inventory | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding UTF8

Write-Host ""
Write-Host "Inventory exported to: $OutputPath"
Write-Host "Total files: $($inventory.Count)"
Write-Host ""
Write-Host "Files by directory (top 15):"
$inventory | Group-Object Directory | Sort-Object Count -Descending | Select-Object -First 15 | Format-Table Name, Count -AutoSize
