# 33-01 Summary — Build + chart fix + deploy + HTTP verification

**Approach:** SURGICAL (no `helm upgrade --install ez`). The live release is
`ez-platform` (chart 1.0.0) with an out-of-band RabbitMQ the 5 .NET backends need;
re-rendering would have re-broken them. The `frontend:v0.5.0-phase33` artifact was
already deployed (correct image, env, ports) from a prior in-session deploy and was
validated in place against the running pod + HTTP port-forward.

## Evidence
- **Chart-fix commit:** `4417474` — "fix(helm): frontend port 80 → 8080 + empty imageRegistry produces bare image string" (templates/deployments/frontend-deployment.yaml + templates/services/services.yaml). Already in tree.
- **Image:** `minikube image ls` → `docker.io/library/frontend:v0.5.0-phase33`. Deployment image string `frontend:v0.5.0-phase33` (no docker.io prefix in Deployment spec).
- **WOFF2 (SC-01):** 30 `*.woff2` files in pod `/usr/share/nginx/html/assets/`.
- **EZ_DOCS_URL env (SC-04):** Deployment env `EZ_DOCS_URL=http://192.168.49.2:30800`.
- **/config.js (SC-05), pod + HTTP verbatim:**
  ```
  // Generated at container start by docker-entrypoint.sh — do not commit edits.
  window.EZ_CONFIG = {
    docsUrl: "http://192.168.49.2:30800"
  };
  ```
- **Font-CDN sweep (SC-06):** `curl http://localhost:7000/` | grep -c googleapis|gstatic = **0**; pod index.html = 0.
- **Ports:** containerPort 8080; svc/frontend port 8080 targetPort 8080; pod 1/1 Running.
- **IP anomaly:** none — `minikube ip` = 192.168.49.2 (matches D-03).

SC-01..SC-06 all PASS. See 33-VALIDATION-REPORT.md for the cross-reference table.
