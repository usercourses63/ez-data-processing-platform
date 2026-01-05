# Rebuild Task-Orchestrator with Java 21

$env:JAVA_HOME = "C:\Java\jdk-21"
$env:Path = "C:\Java\jdk-21\bin;$env:Path"

Write-Host "Java Version:" -ForegroundColor Cyan
& java -version
Write-Host ""

Write-Host "Rebuilding Task-Orchestrator..." -ForegroundColor Yellow
Set-Location "C:\Users\UserC\task-orchestrator"
& .\gradlew.bat clean build -x test

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Build successful! Copying JAR..." -ForegroundColor Green
    $jar = Get-ChildItem "build\libs" -Filter "*.jar" | Select-Object -First 1
    Copy-Item $jar.FullName "C:\MCP-Servers\task-orchestrator\task-orchestrator.jar" -Force
    Write-Host "JAR updated: C:\MCP-Servers\task-orchestrator\task-orchestrator.jar" -ForegroundColor Green

    Write-Host ""
    Write-Host "Testing JAR..." -ForegroundColor Yellow
    & java -jar "C:\MCP-Servers\task-orchestrator\task-orchestrator.jar" --version
} else {
    Write-Host "Build failed!" -ForegroundColor Red
}
