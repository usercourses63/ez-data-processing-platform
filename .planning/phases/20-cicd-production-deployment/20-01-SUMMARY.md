---
phase: 20-cicd-production-deployment
plan: 01
status: completed
completed: 2026-03-17
requirements: [PROD-01, PROD-03]
---

# Plan 20-01 Summary: CI Pipeline Extension & Frontend Version Injection

## What was done

### Task 1: Frontend version injection via Vite env vars
- Updated `src/Frontend/vite.config.ts` to prefer `process.env.VERSION` over `package.json` version for CI builds
- Updated `__GIT_COMMIT__` to check `process.env.COMMIT_SHA` first
- Cleaned up `docker/Frontend.Dockerfile`: removed dead `sed` commands for `__VERSION__`/`__COMMIT_SHA__`, replaced with `ENV VERSION=${VERSION}` and `ENV COMMIT_SHA=${COMMIT_SHA}` so Vite reads them at build time

### Task 2: CI pipeline tag trigger + Helm validation
- Added `tags: [ 'v*' ]` trigger to CI pipeline
- Updated docker job `if` condition to also run on tag pushes
- Updated version calculation to extract version from git tag when triggered by tag push (falls back to `SemVer.RunNumber` for branch pushes)
- Added `helm-validate` job: Helm lint + template validation with default and local values

## Files modified
- `src/Frontend/vite.config.ts` — Version/commit from env vars
- `docker/Frontend.Dockerfile` — ENV vars instead of dead sed commands
- `.github/workflows/ci.yml` — Tag trigger, tag version extraction, helm-validate job

## Verification
- All acceptance criteria pass (automated grep checks)
