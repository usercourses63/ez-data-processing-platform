# Build and deploy EZ Platform documentation (PowerShell)
# Usage: .\build-and-deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Building EZ Platform Documentation..." -ForegroundColor Cyan

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install failed" -ForegroundColor Red
    exit 1
}

# Build the documentation
Write-Host "🔨 Building documentation site..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

# Check if build was successful
if (-not (Test-Path "build")) {
    Write-Host "❌ Build failed - build directory not found" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed successfully" -ForegroundColor Green

# Deploy options
Write-Host ""
Write-Host "Choose deployment option:" -ForegroundColor Cyan
Write-Host "1. Docker (docker-compose)"
Write-Host "2. Kubernetes (kubectl)"
Write-Host "3. Static hosting (copy build/)"
Write-Host "4. Exit"
$choice = Read-Host "Enter choice [1-4]"

switch ($choice) {
    "1" {
        Write-Host "🐳 Building Docker image..." -ForegroundColor Yellow
        docker-compose build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Docker build failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "🚀 Starting Docker container..." -ForegroundColor Yellow
        docker-compose up -d
        Write-Host "✅ Documentation available at http://localhost:8080" -ForegroundColor Green
    }
    "2" {
        Write-Host "☸️  Building Docker image for Kubernetes..." -ForegroundColor Yellow
        docker build -t ez-platform-docs:latest .
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Docker build failed" -ForegroundColor Red
            exit 1
        }
        Write-Host "📤 Loading image to minikube..." -ForegroundColor Yellow
        minikube image load ez-platform-docs:latest
        Write-Host "🚀 Deploying to Kubernetes..." -ForegroundColor Yellow
        kubectl apply -f k8s-deployment.yaml
        Write-Host "⏳ Waiting for deployment..." -ForegroundColor Yellow
        kubectl wait --for=condition=ready pod -l app=docs -n ez-platform-docs --timeout=120s
        $minikubeIp = minikube ip
        Write-Host "✅ Documentation available at http://${minikubeIp}:30081" -ForegroundColor Green
    }
    "3" {
        Write-Host "📁 Build artifacts are in: .\build" -ForegroundColor Yellow
        Write-Host "📋 Copy the contents to your web server" -ForegroundColor Yellow
        explorer.exe "build"
    }
    "4" {
        Write-Host "👋 Exiting..." -ForegroundColor Yellow
        exit 0
    }
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "🎉 Deployment completed!" -ForegroundColor Green
