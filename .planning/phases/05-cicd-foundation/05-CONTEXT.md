# Phase 5: CI/CD Foundation - Context

**Created:** 2026-02-02
**Phase Goal:** Every commit triggers automated builds with test quality gates, version injection, and Docusaurus build

---

## Implementation Decisions

### Docker Build Strategy

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build Tool | PowerShell script | Matches existing `scripts/` convention (start-port-forwards.ps1, verify-file-simulator.ps1) |
| Parallelism | All 9 services in parallel | Maximum speed; GitHub Actions runners have sufficient resources |
| Cache Strategy | GitHub Actions cache | Use `actions/cache` to persist Docker layers between runs |
| Base Image | Official .NET images | Use `mcr.microsoft.com/dotnet/aspnet:10.0` directly; no custom base image maintenance |

**Build Script Pattern:**
```powershell
# scripts/build-all-images.ps1
$services = @("datasourcemanagement", "validation", "fileprocessor", ...)
$jobs = $services | ForEach-Object -Parallel { docker build ... }
```

### CI Workflow Structure

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Job Structure | Multi-job pipeline | Separate jobs for build, test, push with `needs:` dependencies |
| Runner | Self-hosted (documented) | Document self-hosted requirement for OCP deployment; use ubuntu-latest for initial setup |
| Triggers | Push + PR to main | Run on every push to main and PRs targeting main |
| Artifacts | Push on main only | PRs verify build works; only merge to main pushes images |

**Workflow Structure:**
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps: [checkout, setup-dotnet, restore, build]

  test:
    needs: build
    steps: [run unit tests, run integration tests]

  docker:
    needs: test
    if: github.ref == 'refs/heads/main'
    steps: [build images, push to registry]
```

### Test Quality Gates

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Test Scope | Unit + Integration | Run Shared.Tests (63 tests) + IntegrationTests (non-infrastructure dependent) |
| Timeout | 10 minutes | Balanced - enough for test suites without excessive waiting |
| Block Policy | Strict | All tests must pass; no exceptions for PR merges |
| Code Coverage | No gate | Focus on test quality over quantity; no coverage threshold enforced |

**Test Execution:**
```bash
dotnet test tests/Shared.Tests --logger trx --results-directory TestResults
dotnet test tests/IntegrationTests --filter "Category!=Infrastructure" --logger trx
```

### Version Injection Method

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Version Format | SemVer + Build# | `v0.2.0.123` - semantic version plus GitHub Actions run number |
| Frontend Injection | Build-time replacement | Replace placeholder in `version.ts` during Docker build |
| Docker Tags | Version + latest + SHA | Tag images with `v0.2.0.123`, `latest`, and `abc1234` |
| Build Metadata | Version + SHA only | No build date; SHA provides traceability to commit time |

**Version Injection Pattern:**
```dockerfile
# Frontend Dockerfile
ARG VERSION=0.0.0
ARG COMMIT_SHA=unknown
RUN sed -i "s/__VERSION__/${VERSION}/g" src/version.ts
RUN sed -i "s/__COMMIT_SHA__/${COMMIT_SHA}/g" src/version.ts
```

**Docker Tagging:**
```bash
docker tag ez-frontend:latest registry/ez-frontend:v0.2.0.123
docker tag ez-frontend:latest registry/ez-frontend:latest
docker tag ez-frontend:latest registry/ez-frontend:abc1234
```

---

## Requirements Mapping

| Requirement | Decision Impact |
|-------------|-----------------|
| TEST-05 | Test quality gates in CI pipeline |
| CD-01 | PowerShell build script for all 9 Docker images |
| CD-03 | GitHub Actions workflow on push/PR to main |
| CD-07 | SemVer+Build# injected into frontend version.ts and Docusaurus config |
| CD-08 | Commit SHA injected into frontend build |
| CD-09 | Docusaurus portal builds in CI (part of docker build job) |

---

## Open Questions (None)

All gray areas resolved through discussion.

---

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `scripts/build-all-images.ps1` | Parallel Docker build script |
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline |
| `src/Frontend/src/version.ts` | Version placeholder file |
| `release-package/docs-docusaurus/docusaurus.config.js` | Version injection point |
| `Dockerfile` (each service) | Add VERSION and COMMIT_SHA build args |

---

*Context captured: 2026-02-02*
*Ready for: /gsd:plan-phase 5*
