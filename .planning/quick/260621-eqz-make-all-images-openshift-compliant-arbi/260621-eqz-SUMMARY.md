---
phase: quick-260621-eqz
plan: 01
subsystem: containers / deployment
tags: [openshift, ocp, restricted-v2, docker, nginx, dotnet, arbitrary-uid]
requires: []
provides:
  - OCP restricted-v2 (arbitrary-UID) compliant image set (12 Dockerfiles + 1 nginx conf)
affects:
  - scripts/build-all-images.sh (consumes the fixed Dockerfiles — unchanged)
  - helm/ez-platform charts (ship docker/Frontend.Dockerfile — unchanged)
tech-stack:
  added: []
  patterns:
    - "GID-0 group-writable runtime paths: chgrp -R 0 PATHS && chmod -R g=u PATHS"
    - "Numeric non-zero USER 1001 (validatable by runAsNonRoot; OCP overrides actual UID)"
    - "nginx on non-privileged 8080 with pid + temp under /tmp"
    - ".NET HOME=/app on group-0-writable /app for DataProtection key persistence"
key-files:
  created:
    - .planning/quick/260621-eqz-make-all-images-openshift-compliant-arbi/260621-eqz-SUMMARY.md
  modified:
    - src/Frontend/Dockerfile
    - docker/Frontend.Dockerfile
    - docker/nginx.conf
    - docker/Docusaurus.Dockerfile
    - docker/DataSourceManagementService.Dockerfile
    - docker/ValidationService.Dockerfile
    - docker/FileProcessorService.Dockerfile
    - docker/FileDiscoveryService.Dockerfile
    - docker/OutputService.Dockerfile
    - docker/SchedulingService.Dockerfile
    - docker/MetricsConfigurationService.Dockerfile
    - docker/InvalidRecordsService.Dockerfile
decisions:
  - "docker/Frontend.Dockerfile (the shipped image) absorbs the config.js entrypoint + nginx-main.conf from src/Frontend; build-all-images.sh and helm left pointing at it unchanged"
  - "All 8 .NET images share one byte-for-byte compliance block (ENV HOME=/app; chgrp 0 + chmod g=u /app; USER 1001) for uniform lint"
  - ".NET ports kept at 5001-5009 (already >1024); only nginx moved to 8080"
metrics:
  duration: ~25m
  completed: 2026-06-21
  tasks: 3
  files: 12
---

# Quick Task 260621-eqz: Make All Container Images OpenShift restricted-v2 (arbitrary-UID) Compliant Summary

Converted all 12 deployable Dockerfiles (+ docker/nginx.conf) to the OpenShift restricted-v2
pattern — group-0-owned/group-writable runtime paths, numeric `USER 1001`, nginx on 8080 — so any
random UID assigned by the SCC (always with supplementary GID 0) can start and serve the image.

## What Was Done

### Task 1 — Three nginx images (frontend x2 + docusaurus)
- **src/Frontend/Dockerfile**: removed the fixed `adduser/addgroup -u/-g 1000` + all `chown`/`COPY --chown`
  to a named user; now uses plain `COPY` then a single `chgrp -R 0 ... && chmod -R g=u ...` over
  `/tmp /var/cache/nginx /var/log/nginx /usr/share/nginx/html /etc/nginx`; numeric `USER 1001`;
  keeps EXPOSE 8080 + the config.js `CMD ["/docker-entrypoint.sh"]`.
- **docker/Frontend.Dockerfile** (the image build-all-images.sh + helm actually ship): rewrote the
  runtime stage to be compliant AND fold in the working config.js runtime-env entrypoint
  (`src/Frontend/nginx-main.conf` for the writable PID/temp main conf, `src/Frontend/docker-entrypoint.sh`,
  kept `docker/nginx.conf` as the server conf so the proxy upstreams the port-gate checks stay intact).
  EXPOSE 80 -> 8080, HEALTHCHECK -> `:8080`, CMD -> the entrypoint, numeric `USER 1001`.
- **docker/nginx.conf**: `listen 80;` -> `listen 8080;` (only the listen line; upstreams untouched).
- **docker/Docusaurus.Dockerfile**: dropped the `nginx-user`/`nginx-group` creation + chowns; plain
  COPY + the `chgrp 0` / `chmod g=u` block; numeric `USER 1001`; EXPOSE 8080 + 8080 healthcheck kept.

### Task 2 — Eight .NET service images
Inserted the identical 4-line block immediately after `COPY --from=build /app/publish .` in all 8:
```
# OCP arbitrary-UID compliance: group-0 owns a group-writable /app + HOME so a random UID can write DataProtection keys
ENV HOME=/app
RUN chgrp -R 0 /app && chmod -R g=u /app
USER 1001
```
Removed InvalidRecordsService's fixed `USER 1000:1000`. All service ports (5001-5009) kept.

### Task 3 — Cross-image lint + port gate (verification only, no edits)
All guardrails green: 11/11 app Dockerfiles declare numeric `USER 1001`; 0 declare root/username/USER 1000;
the 3 nginx Dockerfiles carry `chmod -R g=u` with no `adduser`/`chown`-to-user leftovers and no bare
`EXPOSE 80`; `docker/nginx.conf` listens 8080; `scripts/validate-nginx-ports.sh --ci` passes (exit 0).

## Verification (the `docker run --user 99999:0` SCC proxy — a random UID owning nothing, in group 0)
- **docker/Frontend.Dockerfile** built; ran as `--user 99999:0`: the config.js entrypoint wrote
  `/usr/share/nginx/html/config.js`, nginx served the React index on 8080 (HTTP 200), no permission
  errors. (In-cluster upstream DNS names were stubbed with `--add-host ...:127.0.0.1` purely so nginx
  could resolve them at startup outside k8s — not a Dockerfile change.)
- **docker/Docusaurus.Dockerfile** built; ran as `--user 99999:0`: served docs on 8080 (HTTP 200), no
  permission errors.
- **docker/ValidationService.Dockerfile** (representative .NET) built; ran as `--user 99999:0`:
  container stays running, Kestrel binds 5003 (TCP accept confirmed), no permission/UnauthorizedAccess
  errors. Directly proved the fix: as `uid=99999 gid=0`, `/app` is `drwxrwxr-x root root`, `HOME=/app`,
  and writing both a `/app` file and `$HOME/.aspnet/DataProtection-Keys/key-test.xml` succeeded.
- The other 7 .NET images are proven by the byte-for-byte identical block (Task 3 grep: 8/8) — full
  10-image build intentionally skipped per the plan.

## Deviations from Plan

None affecting the Dockerfiles. One verification-environment note: the frontend nginx image initially
exited because nginx resolves `proxy_pass` upstream hostnames (`*.ez-platform.svc.cluster.local`) at
startup and those k8s service names do not exist on the docker host. This is expected outside the
cluster (docusaurus passed because it has no upstreams). Verified arbitrary-UID compliance by stubbing
those hostnames to 127.0.0.1 via `--add-host` at run time — no Dockerfile/config change was required.

## Known Stubs

None.

## Self-Check: PASSED
- All 12 modified Dockerfiles + docker/nginx.conf exist with the compliant pattern.
- Commits 3444eac (Task 1) and 3be9f42 (Task 2) present in git log.
- SUMMARY.md created at the plan directory.
