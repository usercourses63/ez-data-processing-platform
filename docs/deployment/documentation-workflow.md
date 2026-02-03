---
last-verified: 2026-02-03
status: current
---

# Documentation Update Workflow

This guide documents the process for updating the Docusaurus documentation portal before each release.

## Overview

EZ Platform uses a dual documentation approach:

- **GSD (.planning/)**: Source of truth for project planning, architecture, and development decisions
- **Docusaurus**: User-facing documentation portal deployed at `/docs` path

Before each release, relevant GSD content is synchronized to Docusaurus.

## Documentation Structure

### Source (GSD)

```
.planning/
├── PROJECT.md           # Project overview
├── ROADMAP.md           # Phase roadmap
├── STATE.md             # Current execution state
├── codebase/            # Architecture docs
│   ├── ARCHITECTURE.md
│   ├── STACK.md
│   └── CONVENTIONS.md
└── phases/              # Phase execution docs
    └── XX-name/
        ├── XX-YY-PLAN.md
        └── XX-YY-SUMMARY.md
```

### Target (Docusaurus)

```
release-package/docs-docusaurus/
├── docs/
│   ├── intro.md                 # Welcome page
│   ├── getting-started/         # Quick start guides
│   │   ├── installation.md
│   │   └── configuration.md
│   ├── architecture/            # System architecture
│   │   ├── system-architecture.md
│   │   └── microservices.md
│   ├── deployment/              # Deployment guides
│   │   ├── deployment-plan.md
│   │   ├── ocp-deployment.md
│   │   └── rollback.md
│   ├── api-reference/           # API documentation
│   └── user-guide/              # End-user documentation
│       ├── dashboard.md
│       └── he/                  # Hebrew translations
├── docusaurus.config.js         # Site configuration
├── sidebars.js                  # Navigation structure
└── src/
    └── css/
        └── custom.css           # Custom styling
```

## Pre-Release Checklist

Before each release, complete these steps in order:

### 1. Update Version Number

Update version in `docusaurus.config.js`:

```javascript
// release-package/docs-docusaurus/docusaurus.config.js
title: 'EZ Platform v0.2.0',  // Update version here
```

The Dockerfile also injects version at build time via the `VERSION` build arg.

### 2. Sync Architecture Documentation

Copy relevant architecture content from GSD:

```bash
# Copy ARCHITECTURE.md to Docusaurus
cp .planning/codebase/ARCHITECTURE.md \
   release-package/docs-docusaurus/docs/architecture/overview.md

# Update any internal links to use Docusaurus format
# Change: [Link](../other.md) to [Link](./other.md)
```

### 3. Update Deployment Guides

Ensure deployment documentation is current:

```bash
# Copy deployment guides
cp docs/deployment/ocp-deployment-guide.md \
   release-package/docs-docusaurus/docs/deployment/ocp-deployment.md

cp docs/deployment/rollback-procedures.md \
   release-package/docs-docusaurus/docs/deployment/rollback.md
```

### 4. Update API Reference

If API changes occurred, update API documentation:

```bash
# Export Swagger/OpenAPI (if service running)
curl http://localhost:5001/swagger/v1/swagger.json \
  > release-package/docs-docusaurus/static/api/swagger.json

# Or manually update API docs
edit release-package/docs-docusaurus/docs/api-reference/*.md
```

### 5. Verify Hebrew Translations

Check Hebrew content is up to date:

```bash
# List Hebrew docs
ls release-package/docs-docusaurus/docs/user-guide/he/

# Verify RTL rendering locally
cd release-package/docs-docusaurus
npm install
npm run start -- --locale he
```

### 6. Build and Test Locally

```bash
cd release-package/docs-docusaurus

# Install dependencies
npm install

# Build static site
npm run build

# Serve locally to verify
npm run serve
# Open http://localhost:3000/docs/
```

### 7. Build Docker Image

```bash
# Build Docusaurus image with version
docker build -f docker/Docusaurus.Dockerfile \
  --build-arg VERSION=v0.2.0 \
  --build-arg COMMIT_SHA=$(git rev-parse --short HEAD) \
  -t ezplatform-docs:v0.2.0 \
  release-package/docs-docusaurus

# Test locally
docker run -p 8080:8080 ezplatform-docs:v0.2.0
# Open http://localhost:8080/docs/
```

## Content Guidelines

### Markdown Format

Docusaurus uses standard Markdown with YAML frontmatter:

```markdown
---
sidebar_position: 1
title: Getting Started
description: Quick start guide for EZ Platform
---

# Getting Started

Content here...
```

### Internal Links

Use relative paths for internal links within docs:

```markdown
<!-- Good - relative to current file -->
[Architecture](./architecture/overview.md)
[Deployment](../deployment/ocp-deployment.md)

<!-- Avoid - absolute paths can break in dev mode -->
[Architecture](/architecture/overview)
```

### Images

Place images in `static/img/` and reference with absolute path:

```markdown
![Architecture Diagram](/img/architecture.png)
```

### Code Blocks

Use language hints for syntax highlighting:

````markdown
```yaml
# Kubernetes manifest
apiVersion: v1
kind: Service
metadata:
  name: frontend
```

```csharp
// C# code
public class DataSource
{
    public string Name { get; set; }
}
```
````

Supported languages: bash, powershell, csharp, yaml, json, javascript, typescript

## Hebrew/RTL Content

### File Organization

Hebrew content goes in locale-specific directories:

```
docs/user-guide/
├── dashboard.md           # English (default)
└── he/
    └── dashboard.md       # Hebrew translation
```

Or using Docusaurus i18n structure:

```
i18n/
└── he/
    └── docusaurus-plugin-content-docs/
        └── current/
            └── user-guide/
                └── dashboard.md
```

### RTL Configuration

Hebrew pages automatically get RTL direction via the `i18n` config in `docusaurus.config.js`:

```javascript
i18n: {
  defaultLocale: 'en',
  locales: ['en', 'he'],
  localeConfigs: {
    en: {
      label: 'English',
      direction: 'ltr',
      htmlLang: 'en-US',
    },
    he: {
      label: 'Hebrew',
      direction: 'rtl',
      htmlLang: 'he-IL',
    },
  },
},
```

### Mixed LTR/RTL Content

For technical terms in Hebrew documents that should remain LTR:

```markdown
<!-- Use dir attribute for inline LTR in RTL context -->
לפתוח את <span dir="ltr">`/api/datasources`</span> בדפדפן

<!-- Code blocks automatically use LTR -->
```bash
kubectl get pods -n ez-platform
```

<!-- URLs and paths stay LTR -->
הקובץ נמצא ב: <code dir="ltr">src/Services/Shared/</code>
```

### Testing Hebrew Locale

```bash
# Start dev server with Hebrew locale
cd release-package/docs-docusaurus
npm run start -- --locale he

# Build Hebrew version
npm run build -- --locale he

# Build all locales
npm run build
```

## Deployment Integration

### Routing Configuration

The documentation portal is deployed at the `/docs` path:

| Environment | Access URL | Configuration |
|-------------|------------|---------------|
| Vanilla K8s | `https://ez-platform.example.com/docs/` | Ingress path rule |
| OpenShift | `https://ez-platform.apps.cluster/docs/` | OCP Route with path |

### Docusaurus baseUrl

The `baseUrl` in `docusaurus.config.js` must match the deployment path:

```javascript
// docusaurus.config.js
baseUrl: '/docs/',  // Matches K8s Ingress and OCP Route paths
```

### CI Pipeline Integration

Documentation build is part of the CI pipeline:

```yaml
# .github/workflows/ci.yml
- name: Build Docusaurus
  run: |
    cd release-package/docs-docusaurus
    npm ci
    npm run build
```

### Version Injection

Version is injected at Docker build time:

```dockerfile
# docker/Docusaurus.Dockerfile
ARG VERSION=dev
RUN sed -i "s/v0.0.0/${VERSION}/g" docusaurus.config.js
```

## Troubleshooting

### Build Fails with Broken Links

```bash
# Find broken links in build output
npm run build 2>&1 | grep -i "broken"

# Temporarily allow broken links (for debugging)
# In docusaurus.config.js:
onBrokenLinks: 'warn',  // Change from 'throw' to 'warn'
```

### Hebrew Text Not Rendering RTL

1. Check locale config in `docusaurus.config.js` has `direction: 'rtl'`
2. Verify file is in correct locale directory (`docs/*/he/` or `i18n/he/`)
3. Check for conflicting inline CSS overriding direction
4. Inspect element to verify `dir="rtl"` on html/body

### Assets Not Loading at /docs Path

1. Verify `baseUrl: '/docs/'` in docusaurus.config.js
2. Check asset paths start with `/` (e.g., `/img/logo.png`)
3. Clear build cache: `rm -rf .docusaurus build`
4. Rebuild: `npm run build`

### Local Dev Server Shows Wrong Path

```bash
# Development uses baseUrl, verify it works
npm run start
# Should open at http://localhost:3000/docs/

# If wrong, check docusaurus.config.js baseUrl
```

## Release Schedule

| Milestone | Documentation Task |
|-----------|-------------------|
| Feature freeze | Sync architecture docs from GSD |
| Release candidate | Full content review, Hebrew verification |
| Release | Version bump, final Docker build |
| Post-release | Update changelog, archive release notes |

## Related Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Full deployment procedures
- [OCP Deployment](./ocp-deployment-guide.md) - OpenShift-specific deployment
- [CI/CD Pipeline](.github/workflows/ci.yml) - Automated build configuration
