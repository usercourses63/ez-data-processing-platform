# Complete Java Task-Orchestrator Installation Script
# This script automates the entire installation process

$ErrorActionPreference = "Stop"

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host "Java Task-Orchestrator Complete Installation" -ForegroundColor Cyan
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host ""

# Step 1: Download and Install Java
Write-Host "[1/6] Downloading Java 21..." -ForegroundColor Yellow
$javaUrl = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jdk_x64_windows_hotspot_21.0.5_11.zip"
$javaZip = "$env:TEMP\openjdk21.zip"
$javaDir = "C:\Java\jdk-21"

if (!(Test-Path $javaZip)) {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $javaUrl -OutFile $javaZip
    Write-Host "  Downloaded Java to: $javaZip" -ForegroundColor Green
} else {
    Write-Host "  Java ZIP already downloaded" -ForegroundColor Green
}

# Step 2: Extract Java
Write-Host "[2/6] Extracting Java..." -ForegroundColor Yellow
if (!(Test-Path $javaDir)) {
    New-Item -ItemType Directory -Path "C:\Java" -Force | Out-Null
    Expand-Archive -Path $javaZip -DestinationPath "C:\Java" -Force

    # Find the extracted directory (it has a version-specific name)
    $extractedDir = Get-ChildItem "C:\Java" -Directory | Where-Object { $_.Name -like "jdk-*" } | Select-Object -First 1
    if ($extractedDir.FullName -ne $javaDir) {
        Rename-Item $extractedDir.FullName -NewName "jdk-21"
    }
    Write-Host "  Extracted to: $javaDir" -ForegroundColor Green
} else {
    Write-Host "  Java already extracted" -ForegroundColor Green
}

# Step 3: Set JAVA_HOME
Write-Host "[3/6] Configuring JAVA_HOME..." -ForegroundColor Yellow
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", $javaDir, [System.EnvironmentVariableTarget]::User)
$env:JAVA_HOME = $javaDir
Write-Host "  JAVA_HOME = $javaDir" -ForegroundColor Green

# Add to PATH
$currentPath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)
if ($currentPath -notlike "*$javaDir\bin*") {
    [System.Environment]::SetEnvironmentVariable("Path", "$currentPath;$javaDir\bin", [System.EnvironmentVariableTarget]::User)
    $env:Path = "$env:Path;$javaDir\bin"
    Write-Host "  Added Java to PATH" -ForegroundColor Green
} else {
    Write-Host "  Java already in PATH" -ForegroundColor Green
}

# Verify Java
Write-Host ""
Write-Host "Verifying Java installation..." -ForegroundColor Cyan
& "$javaDir\bin\java" -version
Write-Host ""

# Step 4: Build Task-Orchestrator
Write-Host "[4/6] Building Task-Orchestrator..." -ForegroundColor Yellow
$repoDir = "C:\Users\UserC\task-orchestrator"

if (!(Test-Path $repoDir)) {
    Write-Host "  Cloning repository..." -ForegroundColor Yellow
    Set-Location "C:\Users\UserC"
    & git clone https://github.com/jpicklyk/task-orchestrator.git
}

Set-Location $repoDir
Write-Host "  Running Gradle build..." -ForegroundColor Yellow
& ".\gradlew.bat" clean build -x test

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Build successful!" -ForegroundColor Green
} else {
    Write-Host "  Build failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

# Step 5: Setup JAR Location
Write-Host "[5/6] Setting up JAR..." -ForegroundColor Yellow
$mcpDir = "C:\MCP-Servers\task-orchestrator"
New-Item -ItemType Directory -Path $mcpDir -Force | Out-Null

$jar = Get-ChildItem "$repoDir\build\libs" -Filter "*.jar" | Select-Object -First 1
if ($jar) {
    Copy-Item $jar.FullName "$mcpDir\task-orchestrator.jar" -Force
    Write-Host "  JAR copied to: $mcpDir\task-orchestrator.jar" -ForegroundColor Green
    Write-Host "  JAR size: $([math]::Round($jar.Length / 1MB, 2)) MB" -ForegroundColor Green
} else {
    Write-Host "  ERROR: No JAR file found in build/libs" -ForegroundColor Red
    exit 1
}

# Step 6: Configure Claude Code MCP
Write-Host "[6/6] Configuring Claude Code..." -ForegroundColor Yellow
$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$configDir = Split-Path $configPath

if (!(Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

$config = @{
    mcpServers = @{
        "task-orchestrator" = @{
            command = "java"
            args = @(
                "-jar",
                "C:\MCP-Servers\task-orchestrator\task-orchestrator.jar"
            )
            env = @{
                TASK_ORCHESTRATOR_DB = "C:\Users\UserC\.task-orchestrator\tasks.db"
            }
        }
    }
}

# If config exists, merge; otherwise create new
if (Test-Path $configPath) {
    $existing = Get-Content $configPath -Raw | ConvertFrom-Json
    if (!$existing.mcpServers) {
        $existing | Add-Member -MemberType NoteProperty -Name mcpServers -Value @{}
    }
    $existing.mcpServers | Add-Member -MemberType NoteProperty -Name "task-orchestrator" -Value $config.mcpServers."task-orchestrator" -Force
    $existing | ConvertTo-Json -Depth 10 | Set-Content $configPath
} else {
    $config | ConvertTo-Json -Depth 10 | Set-Content $configPath
}

Write-Host "  Configuration saved to: $configPath" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host ""

Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Java Location: $javaDir" -ForegroundColor White
Write-Host "  Java Version: " -NoNewline -ForegroundColor White
& java -version 2>&1 | Select-Object -First 1
Write-Host "  JAR Location: C:\MCP-Servers\task-orchestrator\task-orchestrator.jar" -ForegroundColor White
Write-Host "  Config File: $configPath" -ForegroundColor White
Write-Host "  Database: C:\Users\UserC\.task-orchestrator\tasks.db" -ForegroundColor White
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Restart Claude Code completely" -ForegroundColor White
Write-Host "  2. Test with: get_overview()" -ForegroundColor White
Write-Host "  3. Create a test task" -ForegroundColor White
Write-Host ""

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
