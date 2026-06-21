<#
.SYNOPSIS
  Run the PRODUCTION frontend build locally and serve it correctly, so the SPA
  actually loads (no blank white page).

.DESCRIPTION
  WHY THE WHITE PAGE HAPPENS
  --------------------------
  The app is a Vite/ES-module SPA. index.html loads its JavaScript with
      <script type="module" src="/assets/index-*.js">
  Two things are then mandatory and a plain "open the file" does NOT provide them:
    1. The bundle must be served over http:// - ES modules cannot load from a
       file:// URL (double-clicking build\index.html => blank page + module/CORS
       errors in the console: "Failed to load module script...").
    2. The server must return the correct MIME type (application/javascript) for
       .js and fall back to index.html for client-side routes (try_files).
  This script gives you exactly that, mirroring the production nginx image.

  -Mode nginx (default): runs nginx:alpine serving .\build on http://localhost:<Port>,
     with the same SPA fallback + cache headers as production, and proxies
     /api and /hubs to a backend on host:5001 (run the .NET services for a live API).
  -Mode node: serves .\build with `npx serve -s` (SPA fallback, correct MIME). No Docker.

.PARAMETER Mode    nginx | node   (default nginx)
.PARAMETER Port    host port to listen on (default 8088)
.PARAMETER DocsUrl value injected into window.EZ_CONFIG.docsUrl (the Help/Docs link)
.PARAMETER Stop     stop + remove the local nginx container and exit

.EXAMPLE
  .\run-local-prod.ps1                       # nginx on http://localhost:8088
.EXAMPLE
  .\run-local-prod.ps1 -Mode node -Port 9000
.EXAMPLE
  .\run-local-prod.ps1 -Stop
#>
[CmdletBinding()]
param(
    [ValidateSet('nginx', 'node')] [string] $Mode = 'nginx',
    [int]    $Port    = 8088,
    [string] $DocsUrl = '',
    [switch] $Stop
)

$ErrorActionPreference = 'Stop'
$Root      = $PSScriptRoot
$BuildDir  = Join-Path $Root 'build'
$Container = 'ez-frontend-local'

if ($Stop) {
    try { docker rm -f $Container 2>&1 | Out-Null } catch {}
    Write-Host "Stopped/removed container '$Container'." -ForegroundColor Yellow
    return
}

# --- Preconditions -------------------------------------------------------------------
if (-not (Test-Path (Join-Path $BuildDir 'index.html'))) {
    Write-Warning "No build found at $BuildDir. Building now (npm run build)..."
    Push-Location $Root
    try { npm run build } finally { Pop-Location }
}

# Production-style runtime config (overrides the dev stub build\config.js).
$escaped   = ($DocsUrl -replace '\\', '\\' -replace '"', '\"')
$configJs  = "window.EZ_CONFIG = { docsUrl: `"$escaped`" };"
$configOut = Join-Path $BuildDir 'config.js'
Set-Content -Path $configOut -Value $configJs -Encoding utf8 -NoNewline
Write-Host "Wrote runtime config: $configOut  (docsUrl='$DocsUrl')" -ForegroundColor DarkGray

# --- node mode -----------------------------------------------------------------------
if ($Mode -eq 'node') {
    Write-Host "Serving (node/serve, SPA fallback) on http://localhost:$Port ..." -ForegroundColor Green
    Write-Host "Ctrl+C to stop." -ForegroundColor DarkGray
    npx --yes serve -s $BuildDir -l $Port
    return
}

# --- nginx mode ----------------------------------------------------------------------
docker version *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker is not available. Use -Mode node instead." }

# A trimmed server config: production static-serving behaviour, but with proxy
# upstreams pointed at host.docker.internal:5001 (the real chart proxies in-cluster
# names that don't resolve outside k8s). Single-quoted here-string keeps nginx
# $variables literal.
$nginxConf = @'
server {
    listen 80;
    server_name localhost;
    client_max_body_size 100m;
    root /usr/share/nginx/html;
    index index.html;

    # Hashed build assets are real files ONLY. Never fall back to index.html here -
    # a missing asset must return a true 404, not text/html (which is exactly what
    # causes "Failed to load module script: ... MIME type of text/html").
    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=604800, must-revalidate";
        etag on;
    }

    location / {
        try_files $uri $uri/ /index.html;
        location ~* \.html$ {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            add_header Cache-Control "public, max-age=604800, must-revalidate";
            etag on;
        }
    }

    location /api/ {
        proxy_pass http://host.docker.internal:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $http_connection;
        proxy_cache_bypass $http_upgrade;
    }
    location /hubs/ {
        proxy_pass http://host.docker.internal:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $http_connection;
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
'@
$confFile = Join-Path ([System.IO.Path]::GetTempPath()) 'ez-frontend-local.conf'
Set-Content -Path $confFile -Value $nginxConf -Encoding ascii

try { docker rm -f $Container 2>&1 | Out-Null } catch {}
Write-Host "Starting nginx container '$Container' on http://localhost:$Port ..." -ForegroundColor Green
docker run -d --name $Container `
    -p "${Port}:80" `
    --add-host host.docker.internal:host-gateway `
    -v "${BuildDir}:/usr/share/nginx/html:ro" `
    -v "${confFile}:/etc/nginx/conf.d/default.conf:ro" `
    nginx:alpine | Out-Null

Start-Sleep -Seconds 1
$state = (docker inspect -f '{{.State.Running}}' $Container 2>$null)
if ($state -ne 'true') {
    Write-Warning "Container failed to start. Logs:"
    docker logs $Container
    throw "nginx did not start."
}

Write-Host ""
Write-Host "  UI (production build):  http://localhost:$Port" -ForegroundColor Cyan
Write-Host "  API/hubs proxied to  :  host.docker.internal:5001 (run the .NET services for live data)" -ForegroundColor DarkGray
Write-Host "  Stop with            :  .\run-local-prod.ps1 -Stop" -ForegroundColor DarkGray
