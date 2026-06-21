---
phase: quick-260621-eqz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
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
autonomous: true
requirements:
  - OCP-ARBITRARY-UID

must_haves:
  truths:
    - "Every deployable image starts and serves when run as a random non-root UID with GID 0 (the restricted-v2 SCC behavior)"
    - "No image relies on a fixed UID owning files; runtime-writable paths are group-0 owned and group-writable"
    - "Frontend runtime config.js entrypoint still works (writes /usr/share/nginx/html/config.js at start)"
    - "All nginx images listen on 8080; .NET images keep their existing >1024 ports"
    - "Every USER directive is numeric and non-zero so runAsNonRoot can validate it"
  artifacts:
    - path: "src/Frontend/Dockerfile"
      provides: "Arbitrary-UID-compliant React frontend image (config.js + 8080)"
      contains: "chmod -R g=u"
    - path: "docker/Frontend.Dockerfile"
      provides: "The image build-all-images.sh + helm actually ship; now compliant + config.js"
      contains: "USER 1001"
    - path: "docker/Docusaurus.Dockerfile"
      provides: "Arbitrary-UID-compliant docs nginx image"
      contains: "chmod -R g=u"
    - path: "docker/ValidationService.Dockerfile"
      provides: "Representative compliant .NET image (shared block applied to all 8)"
      contains: "USER 1001"
  key_links:
    - from: "scripts/build-all-images.sh"
      to: "docker/Frontend.Dockerfile + docker/Docusaurus.Dockerfile + 8 .NET Dockerfiles"
      via: "build matrix (unchanged — files are fixed in place)"
      pattern: "docker/Frontend.Dockerfile"
---

<objective>
Make ALL deployable container images compliant with OpenShift's restricted-v2 SCC, which
runs each container as a RANDOM high UID (unknown at build time) but always with supplementary
GID 0 (root group). Today the images break: the frontend chowns to a fixed UID 1000, the shipped
docker/Frontend.Dockerfile runs stock nginx as root on port 80, the docusaurus image uses a
username USER directive, and the .NET service images mostly run as root with a root-owned /app.

Purpose: The user runs the whole project on OpenShift and the frontend nginx image fails trying
to reach root-owned paths. Fix every image so an arbitrary UID in group 0 can run it.

Output: 12 Dockerfiles (+ 1 nginx conf) converted to the GID-0 group-writable pattern with
numeric non-root USER and non-privileged ports, verified by running images as a random UID.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md

Current (non-compliant) image sources — read before editing:
@src/Frontend/Dockerfile
@src/Frontend/nginx-main.conf
@src/Frontend/nginx.conf
@src/Frontend/docker-entrypoint.sh
@docker/Frontend.Dockerfile
@docker/nginx.conf
@docker/Docusaurus.Dockerfile
@docker/ValidationService.Dockerfile
@docker/DataSourceManagementService.Dockerfile
@scripts/build-all-images.sh

The authoritative OpenShift "support arbitrary user IDs" rules (apply verbatim):
1. Runtime-writable dirs/files MUST be group-0 owned and group-writable:
   chgrp -R 0 PATHS && chmod -R g=u PATHS   (g=u mirrors group perms to owner perms).
2. Use a NUMERIC, non-zero USER (e.g. USER 1001) — NOT a username — so Kubernetes
   runAsNonRoot can validate it. OpenShift overrides the actual UID at runtime.
3. Listen on a NON-privileged port (>1024). nginx -> 8080. .NET -> the existing 5001-5009
   ports are already >1024, KEEP them (do NOT switch to 8080 — it would break nginx
   proxy_pass, healthchecks, the port-forward script, and helm service targetPorts).
4. Do NOT depend on $HOME or a fixed UID's home; make HOME/temp group-0 writable.

LOCAL PROXY FOR THE SCC: there is no OpenShift cluster available. Prove compliance with
docker run --rm --user 99999:0 IMAGE  (a random UID that owns NOTHING, in group 0).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make the three nginx images (frontend x2 + docusaurus) arbitrary-UID compliant; reconcile the two frontend Dockerfiles</name>
  <files>src/Frontend/Dockerfile, docker/Frontend.Dockerfile, docker/nginx.conf, docker/Docusaurus.Dockerfile</files>
  <action>
Reconciliation decision (already made — implement it, do not re-litigate): docker/Frontend.Dockerfile
is the image that scripts/build-all-images.sh and the helm charts actually ship (frontend image
tag ez-platform/frontend). It is currently stock root nginx on port 80 with NO config.js
entrypoint. src/Frontend/Dockerfile is the "real" one (config.js runtime-env entrypoint, 8080,
real API-proxy nginx.conf) but it is single-stage and expects a pre-built build/ dir, so the
build cannot simply switch to it. Therefore: fix BOTH so they are consistent and compliant, and
fold the working config.js entrypoint INTO docker/Frontend.Dockerfile. Leave build-all-images.sh
and the helm charts pointing at docker/Frontend.Dockerfile (no edits to those — they keep working).

(1) src/Frontend/Dockerfile — convert from fixed-UID to GID-0 group-writable:
  - Delete the addgroup -g 1000 / adduser -u 1000 (nginx-user/nginx-group) lines and every
    chown -R nginx-user:nginx-group and every COPY --chown=nginx-user:nginx-group.
  - Keep mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp
    and rm -f /etc/nginx/conf.d/default.conf.
  - Use plain COPY (no --chown) for nginx-main.conf, build, nginx.conf, docker-entrypoint.sh.
  - After all COPYs, add ONE root RUN making every runtime-writable path group-0 owned and
    group-writable, then mark the entrypoint executable:
      chgrp -R 0 /tmp /var/cache/nginx /var/log/nginx /usr/share/nginx/html /etc/nginx && chmod -R g=u /tmp /var/cache/nginx /var/log/nginx /usr/share/nginx/html /etc/nginx && chmod +x /docker-entrypoint.sh
  - Replace USER nginx-user with numeric USER 1001.
  - Keep EXPOSE 8080 and CMD ["/docker-entrypoint.sh"] unchanged (config.js entrypoint preserved).

(2) docker/Frontend.Dockerfile — keep its multi-stage Node build stage as-is; rewrite the
    runtime (FROM nginx:alpine) stage to be compliant AND carry the config.js entrypoint:
  - Keep WORKDIR /usr/share/nginx/html, the labels, rm -rf ./*, COPY --from=build /app/build .
    and COPY --from=build /app/public/docs/USER-GUIDE-HE.md ./docs/USER-GUIDE-HE.md.
  - Add mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp.
  - Replace the nginx config copies; paths are relative to the repo-root build context:
      COPY src/Frontend/nginx-main.conf /etc/nginx/nginx.conf      (writable-PID main conf: pid /tmp/nginx.pid + temp paths)
      COPY docker/nginx.conf /etc/nginx/conf.d/default.conf         (KEEP docker/nginx.conf so the proxy upstreams that scripts/validate-nginx-ports.sh checks stay intact)
      COPY src/Frontend/docker-entrypoint.sh /docker-entrypoint.sh
  - Add the compliance RUN (as root, before USER):
      chgrp -R 0 /tmp /var/cache/nginx /var/log/nginx /usr/share/nginx/html /etc/nginx && chmod -R g=u /tmp /var/cache/nginx /var/log/nginx /usr/share/nginx/html /etc/nginx && chmod +x /docker-entrypoint.sh
  - Change EXPOSE 80 -> EXPOSE 8080.
  - Change the HEALTHCHECK URL from http://localhost/ -> http://localhost:8080/.
  - Add numeric USER 1001 before CMD.
  - Change CMD ["nginx", "-g", "daemon off;"] -> CMD ["/docker-entrypoint.sh"] (entrypoint writes config.js then execs nginx).

(3) docker/nginx.conf — change "listen 80;" -> "listen 8080;" (ONLY the listen line; leave all
    proxy_pass upstreams unchanged so the build's nginx-port validation still passes).

(4) docker/Docusaurus.Dockerfile — convert the runtime stage to GID-0 group-writable:
  - Delete the addgroup -g 1001 / adduser -u 1001 (nginx-user/nginx-group) lines and the
    chown -R nginx-user:nginx-group lines; replace each COPY --chown=nginx-user:nginx-group with plain COPY.
  - Keep mkdir -p /tmp/client_temp ..., rm -rf /usr/share/nginx/html/*, rm -f /etc/nginx/conf.d/default.conf.
  - After the COPYs add the compliance RUN:
      chgrp -R 0 /tmp /var/cache/nginx /var/log/nginx /usr/share/nginx/html /etc/nginx && chmod -R g=u /tmp /var/cache/nginx /var/log/nginx /usr/share/nginx/html /etc/nginx
  - Replace USER nginx-user with numeric USER 1001. Keep EXPOSE 8080, the existing 8080
    healthcheck, and CMD ["nginx", "-g", "daemon off;"] (docusaurus has no config.js entrypoint).

Do NOT add a user directive to any nginx.conf (the configs correctly omit it for non-root).
Do NOT edit scripts/build-all-images.sh or the helm charts in this task.
  </action>
  <verify>
    <automated>cd /c/Users/Brian/Desktop/ez-project/ez && docker build -f docker/Frontend.Dockerfile -t ocp-test/frontend:t . && docker build -f docker/Docusaurus.Dockerfile -t ocp-test/docusaurus:t . && for img in ocp-test/frontend:t ocp-test/docusaurus:t; do cid=$(docker run -d --rm --user 99999:0 -P "$img"); sleep 4; port=$(docker port "$cid" 8080/tcp | head -1 | sed 's/.*://'); if curl -fsS "http://localhost:$port/" >/dev/null; then echo "PASS $img"; else echo "FAIL $img"; docker logs "$cid"; docker stop "$cid"; exit 1; fi; docker stop "$cid"; done</automated>
  </verify>
  <done>
    Both frontend Dockerfiles and the docusaurus Dockerfile use plain COPY + the chgrp 0 / chmod g=u
    pattern (no adduser, no chown to a named user/uid), declare numeric USER 1001, expose 8080, and
    listen on 8080. docker/Frontend.Dockerfile builds and, run as --user 99999:0, the config.js
    entrypoint writes config.js and nginx serves on 8080. docker/Docusaurus.Dockerfile builds and
    serves on 8080 as --user 99999:0. No permission-denied errors in the container logs.
  </done>
</task>

<task type="auto">
  <name>Task 2: Apply the identical arbitrary-UID compliance block to all 8 .NET service Dockerfiles</name>
  <files>docker/DataSourceManagementService.Dockerfile, docker/ValidationService.Dockerfile, docker/FileProcessorService.Dockerfile, docker/FileDiscoveryService.Dockerfile, docker/OutputService.Dockerfile, docker/SchedulingService.Dockerfile, docker/MetricsConfigurationService.Dockerfile, docker/InvalidRecordsService.Dockerfile</files>
  <action>
All 8 .NET Dockerfiles share the same runtime shape: FROM mcr.microsoft.com/dotnet/aspnet:10.0,
WORKDIR /app, labels, COPY --from=build /app/publish ., EXPOSE 500x, HEALTHCHECK, ENTRYPOINT.
The bug: most have NO USER (run as root); InvalidRecordsService.Dockerfile has USER 1000:1000
(depends on a fixed UID owning /app). On OpenShift the random UID cannot write ASP.NET
DataProtection keys (under $HOME) because /app and $HOME are root-owned.

Keep the existing ports (EXPOSE 500x and ASPNETCORE_URLS as configured) — they are already >1024
and the rest of the system (nginx proxy_pass, healthchecks, port-forwards, helm) depends on them.
Do NOT switch any .NET service to 8080.

Insert the SAME compliance block into every one of the 8 Dockerfiles, placed AFTER the
"COPY --from=build /app/publish ." line and BEFORE the EXPOSE/HEALTHCHECK/ENTRYPOINT lines. Use
this exact, identical text in all 8 (so the cross-file lint in Task 3 matches byte-for-byte):

    # OCP arbitrary-UID compliance: group-0 owns a group-writable /app + HOME so a random UID can write DataProtection keys
    ENV HOME=/app
    RUN chgrp -R 0 /app && chmod -R g=u /app
    USER 1001

For InvalidRecordsService.Dockerfile: REMOVE the existing "USER 1000:1000" line and use the block
above instead. After this task, grep across the 8 files must show ZERO occurrences of "USER 1000"
and exactly 8 occurrences each of "chmod -R g=u /app" and "USER 1001".

Note: $HOME=/app + group-0-writable /app lets ASP.NET Core persist DataProtection keys to
/app/.aspnet/DataProtection-Keys under any UID in group 0. /tmp in the base image is already
world-writable (sticky 1777), so TMPDIR needs no change.
  </action>
  <verify>
    <automated>cd /c/Users/Brian/Desktop/ez-project/ez && test "$(grep -l 'chmod -R g=u /app' docker/DataSourceManagementService.Dockerfile docker/ValidationService.Dockerfile docker/FileProcessorService.Dockerfile docker/FileDiscoveryService.Dockerfile docker/OutputService.Dockerfile docker/SchedulingService.Dockerfile docker/MetricsConfigurationService.Dockerfile docker/InvalidRecordsService.Dockerfile | wc -l)" = "8" && test "$(grep -l 'USER 1000' docker/*Service.Dockerfile | wc -l)" = "0" && docker build -f docker/ValidationService.Dockerfile -t ocp-test/validation:t . && cid=$(docker run -d --rm --user 99999:0 ocp-test/validation:t); sleep 8; logs=$(docker logs "$cid" 2>&1); docker stop "$cid" >/dev/null 2>&1 || true; echo "$logs" | grep -iE "Now listening on|Application started" && ! echo "$logs" | grep -iE "Permission denied|UnauthorizedAccess|Access to the path|: denied" && echo "PASS validation starts clean as 99999:0"</automated>
  </verify>
  <done>
    All 8 .NET Dockerfiles contain the identical 4-line compliance block (ENV HOME=/app; chgrp -R 0
    /app && chmod -R g=u /app; USER 1001) immediately after the publish COPY. No file contains
    "USER 1000". The representative validation image builds and, run as --user 99999:0, reaches
    Kestrel "Now listening on" / "Application started" with no permission-denied or UnauthorizedAccess
    errors in the logs (broker connectivity failures are acceptable — only file-permission failures fail this task).
  </done>
</task>

<task type="auto">
  <name>Task 3: Cross-image compliance lint + nginx port validation</name>
  <files>docker/Frontend.Dockerfile, docker/Docusaurus.Dockerfile, src/Frontend/Dockerfile, docker/*Service.Dockerfile, scripts/validate-nginx-ports.sh</files>
  <action>
Final guardrails proving the fixes are uniform and nothing regressed. No new edits unless a check
fails (if a check fails, return to Task 1 or Task 2 and fix, then re-run).

(a) NUMERIC non-root USER everywhere: every one of the 11 application Dockerfiles
    (src/Frontend/Dockerfile, docker/Frontend.Dockerfile, docker/Docusaurus.Dockerfile, and the 8
    docker/*Service.Dockerfile) must declare USER 1001 and must NOT contain a username USER
    (USER nginx-user) nor USER root nor USER 1000.

(b) No fixed-UID ownership left in the nginx images: no adduser / addgroup / chown to a named
    user remains in the three nginx Dockerfiles; each contains "chmod -R g=u".

(c) Non-privileged ports: the three nginx images EXPOSE 8080 and never EXPOSE 80; the docker/nginx.conf
    listens on 8080.

(d) Run scripts/validate-nginx-ports.sh --ci (the same gate build-all-images.sh runs before building
    the frontend) and confirm it still passes after the listen-port change.
  </action>
  <verify>
    <automated>cd /c/Users/Brian/Desktop/ez-project/ez && NGINX="src/Frontend/Dockerfile docker/Frontend.Dockerfile docker/Docusaurus.Dockerfile" && ALL="$NGINX docker/DataSourceManagementService.Dockerfile docker/ValidationService.Dockerfile docker/FileProcessorService.Dockerfile docker/FileDiscoveryService.Dockerfile docker/OutputService.Dockerfile docker/SchedulingService.Dockerfile docker/MetricsConfigurationService.Dockerfile docker/InvalidRecordsService.Dockerfile" && test "$(grep -l 'USER 1001' $ALL | wc -l)" = "11" && test "$(grep -lE 'USER (root|nginx-user|1000)' $ALL | wc -l)" = "0" && test "$(grep -lE 'adduser|chown .*nginx-user' $NGINX | wc -l)" = "0" && test "$(grep -l 'chmod -R g=u' $NGINX | wc -l)" = "3" && test "$(grep -lE 'EXPOSE 80$' $NGINX | wc -l)" = "0" && grep -q 'listen 8080' docker/nginx.conf && bash scripts/validate-nginx-ports.sh --ci && echo "PASS all compliance + port checks"</automated>
  </verify>
  <done>
    All 11 application Dockerfiles declare numeric USER 1001 and none declare USER root / a username
    / USER 1000. The 3 nginx Dockerfiles carry the chmod -R g=u pattern with no adduser/chown-to-user
    leftovers, EXPOSE 8080 (never 80), docker/nginx.conf listens on 8080, and scripts/validate-nginx-ports.sh
    --ci passes. The image set is OpenShift restricted-v2 (arbitrary-UID) compliant.
  </done>
</task>

</tasks>

<verification>
- Tasks 1 and 2 each prove arbitrary-UID compatibility by running a freshly built image as
  docker run --user 99999:0 (a random UID owning nothing, in group 0 — the restricted-v2 proxy):
  nginx images must serve on 8080; the representative .NET image must reach Kestrel startup with
  no file-permission errors.
- Task 3 lints all 11 Dockerfiles for numeric non-root USER, the GID-0 group-writable pattern in
  the nginx images, non-privileged ports, and re-runs the nginx-port gate that build-all-images.sh
  enforces.
- Full-set build (all 10 images) is intentionally NOT required (heavy); the shared .NET pattern is
  proven by one representative build plus the byte-for-byte grep that all 8 share the same block.
</verification>

<success_criteria>
- docker run --user 99999:0 ez-platform/frontend serves the React app on 8080 (config.js written at start).
- docker run --user 99999:0 ez-platform/docusaurus serves docs on 8080.
- docker run --user 99999:0 of a .NET service reaches Kestrel startup with no permission-denied errors.
- All 11 application Dockerfiles declare a numeric non-zero USER; none run as root or a username.
- nginx images listen on 8080; .NET services keep their existing >1024 ports; nothing in the
  proxy/healthcheck/port-forward/helm wiring is broken.
- scripts/validate-nginx-ports.sh --ci still passes.
</success_criteria>

<output>
Create .planning/quick/260621-eqz-make-all-images-openshift-compliant-arbi/260621-eqz-SUMMARY.md when done.
</output>
