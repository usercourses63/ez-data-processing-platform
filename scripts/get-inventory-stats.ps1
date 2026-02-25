# Get inventory statistics for categorization report
param(
    [string]$InventoryPath = "c:\Users\UserC\source\repos\EZ\docs-inventory.csv"
)

$inv = Import-Csv $InventoryPath

Write-Host "=== CATEGORY TOTALS ==="
$inv | Group-Object Category | Sort-Object Count -Descending | Format-Table Name, Count

Write-Host ""
Write-Host "=== BY DIRECTORY (5+ files) ==="
$inv | Group-Object Directory | Where-Object { $_.Count -ge 5 } | ForEach-Object {
    $dir = if ($_.Name -eq '') { '(root)' } else { $_.Name }
    $keep = ($_.Group | Where-Object { $_.Category -eq 'KEEP' }).Count
    $archive = ($_.Group | Where-Object { $_.Category -eq 'ARCHIVE' }).Count
    $delete = ($_.Group | Where-Object { $_.Category -eq 'DELETE' }).Count
    [PSCustomObject]@{
        Directory = $dir
        KEEP = $keep
        ARCHIVE = $archive
        DELETE = $delete
        Total = $_.Count
    }
} | Format-Table -AutoSize

Write-Host ""
Write-Host "=== ARCHIVE BY SOURCE DIRECTORY ==="
$archiveFiles = $inv | Where-Object { $_.Category -eq 'ARCHIVE' }
$archiveFiles | Group-Object Directory | Sort-Object Count -Descending | Select-Object -First 10 | Format-Table Name, Count
