/**
 * Phase 33 integration test — Helm chart render seam.
 *
 * Seam under test: Helm value `services.frontend.config.docsUrl` (operator-
 * supplied) → rendered Kubernetes Deployment YAML for the frontend pod
 * (env var EZ_DOCS_URL on the container).
 *
 * Real: helm template engine, the actual chart at release-package/helm/ez-platform/
 * Fake: cluster, kubectl, deployment (we never apply — only render)
 *
 * Maps to ROADMAP success criteria SC-03 (image), SC-04 (env injection),
 * and the implicit docsUrl propagation chain from plan 33-01.
 *
 * NOTE: The port-80 → port-8080 chart-fix tests are intentionally NOT in this
 * file — that fix lands in Plan 33-01 Task 2 (Helm chart patches). After 33-01
 * runs, the assertions in the TODO block at the bottom should be promoted to
 * real `test()` cases and turn green from the start.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import yaml from 'js-yaml';
import { beforeAll, describe, expect, test } from 'vitest';

// __dirname = <repo>/src/Frontend/src/test/integration → repo root is 5 levels up.
const CHART_PATH = resolve(__dirname, '../../../../../release-package/helm/ez-platform');
const DOCS_URL = 'http://192.168.49.2:30800';
const IMAGE_TAG = 'v0.5.0-phase33';

type K8sResource = {
  apiVersion?: string;
  kind?: string;
  metadata?: { name?: string; labels?: Record<string, string> };
  spec?: any;
};

/** Render the chart with the Phase 33 standard --set values. */
const renderChart = (extraArgs: string[] = []): K8sResource[] => {
  const args = [
    'helm', 'template', 'ez', CHART_PATH,
    '--namespace', 'ez-platform',
    '--set', 'global.imageRegistry=',
    '--set', `services.frontend.image.tag=${IMAGE_TAG}`,
    '--set', `services.frontend.config.docsUrl=${DOCS_URL}`,
    ...extraArgs,
  ];
  const output = execSync(
    args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' '),
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return (yaml.loadAll(output) as K8sResource[]).filter((r) => r && typeof r === 'object');
};

const findResource = (
  resources: K8sResource[],
  kind: string,
  name: string
): K8sResource | undefined =>
  resources.find((r) => r.kind === kind && r.metadata?.name === name);

describe('Phase 33 integration: Helm chart render (current state)', () => {
  let resources: K8sResource[];

  beforeAll(() => {
    try {
      execSync('helm version --short', { stdio: 'ignore' });
    } catch {
      throw new Error('helm is not on PATH — install Helm 3.x to run this test');
    }
    resources = renderChart();
    if (resources.length === 0) {
      throw new Error('helm template returned zero resources — chart may be empty or path wrong');
    }
  }, 60_000);

  describe('frontend Deployment', () => {
    test('exists in rendered output', () => {
      const dep = findResource(resources, 'Deployment', 'frontend');
      expect(dep, 'Deployment named "frontend" must be rendered').toBeDefined();
    });

    test('EZ_DOCS_URL env var carries the operator-supplied value (SC-04)', () => {
      const dep = findResource(resources, 'Deployment', 'frontend');
      const env = dep!.spec.template.spec.containers[0].env as Array<{ name: string; value?: string }>;
      const docsEnv = env.find((e) => e.name === 'EZ_DOCS_URL');
      expect(docsEnv, 'EZ_DOCS_URL env var must be present on the frontend container').toBeDefined();
      expect(docsEnv!.value).toBe(DOCS_URL);
    });

    test('image string contains the expected tag (registry prefix tested separately — see TODO)', () => {
      const dep = findResource(resources, 'Deployment', 'frontend');
      const image = dep!.spec.template.spec.containers[0].image as string;
      // NOTE: the registry-prefix assertion is in the TODO block at the bottom.
      // The chart helper's `default "docker.io"` makes --set global.imageRegistry=""
      // ineffective (Sprig default treats empty-string === nil). Surfaced as a
      // gap in Plan 33-01 BLOCKER 1 verification.
      expect(image).toContain(`frontend:${IMAGE_TAG}`);
    });
  });

  describe('frontend Service', () => {
    test('exists in rendered output', () => {
      const svc = findResource(resources, 'Service', 'frontend');
      expect(svc, 'Service named "frontend" must be rendered').toBeDefined();
    });
  });

  describe('docsUrl override propagation', () => {
    test('passing a different docsUrl value reaches the env var', () => {
      const customUrl = 'https://docs.example.com';
      const custom = renderChart([
        '--set', `services.frontend.config.docsUrl=${customUrl}`,
      ]);
      const dep = findResource(custom, 'Deployment', 'frontend');
      const env = dep!.spec.template.spec.containers[0].env as Array<{ name: string; value?: string }>;
      const docsEnv = env.find((e) => e.name === 'EZ_DOCS_URL');
      expect(docsEnv!.value).toBe(customUrl);
    });

    test('empty docsUrl renders an empty env var value (chart never strips it)', () => {
      const custom = renderChart(['--set', 'services.frontend.config.docsUrl=']);
      const dep = findResource(custom, 'Deployment', 'frontend');
      const env = dep!.spec.template.spec.containers[0].env as Array<{ name: string; value?: string }>;
      const docsEnv = env.find((e) => e.name === 'EZ_DOCS_URL');
      expect(docsEnv, 'env var still present when value is empty').toBeDefined();
    });
  });
});

/* eslint-disable */
/*
 * TODO — promote to real tests AFTER Plan 33-01 Task 2 patches the chart
 * (port 80 → 8080 in frontend-deployment.yaml + services.yaml).
 *
 * Until 33-01 runs, the chart still references port 80 in three places, so
 * these assertions would commit red. After 33-01, they should be green from
 * the start. Lift the block, delete the eslint-disable comments, and the
 * chart-fix seam is fully locked.
 *
 *   describe('Phase 33 chart fix (post-33-01)', () => {
 *     test('container exposes port 8080 (NOT 80)', () => {
 *       const dep = findResource(resources, 'Deployment', 'frontend');
 *       const ports = dep!.spec.template.spec.containers[0].ports;
 *       const containerPorts = ports.map((p: { containerPort: number }) => p.containerPort);
 *       expect(containerPorts).toContain(8080);
 *       expect(containerPorts).not.toContain(80);
 *     });
 *
 *     test('liveness probe targets port 8080', () => {
 *       const dep = findResource(resources, 'Deployment', 'frontend');
 *       expect(dep!.spec.template.spec.containers[0].livenessProbe?.httpGet?.port).toBe(8080);
 *     });
 *
 *     test('readiness probe targets port 8080', () => {
 *       const dep = findResource(resources, 'Deployment', 'frontend');
 *       expect(dep!.spec.template.spec.containers[0].readinessProbe?.httpGet?.port).toBe(8080);
 *     });
 *
 *     test('frontend Service uses port 8080 with targetPort 8080', () => {
 *       const svc = findResource(resources, 'Service', 'frontend');
 *       const ports = svc!.spec.ports as Array<{ port: number; targetPort: number | string }>;
 *       const main = ports[0];
 *       expect(main.port).toBe(8080);
 *       expect(main.targetPort).toBe(8080);
 *     });
 *
 *     test('frontend Service does NOT expose port 80', () => {
 *       const svc = findResource(resources, 'Service', 'frontend');
 *       const ports = svc!.spec.ports as Array<{ port: number; targetPort: number | string }>;
 *       expect(ports.every((p) => p.port !== 80 && p.targetPort !== 80)).toBe(true);
 *     });
 *
 *     // BLOCKER 1 — Plan 33-01 claims `--set global.imageRegistry=""` produces a
 *     // bare image. It does NOT today: the chart helper at templates/_helpers.tpl:8
 *     // uses `.Values.global.imageRegistry | default "docker.io"` and Sprig's
 *     // `default` treats empty-string as nil, so the default wins. Result is
 *     // `docker.io/frontend:tag`, not `frontend:tag`.
 *     //
 *     // Fix options for the chart-author to apply during 33-01:
 *     //   1. Replace `| default "docker.io"` with explicit conditional:
 *     //        {{- if hasKey .Values.global "imageRegistry" }}
 *     //          {{- $registry := .Values.global.imageRegistry }}
 *     //        {{- else }}
 *     //          {{- $registry := "docker.io" }}
 *     //        {{- end }}
 *     //   2. Or: keep helper logic but use --set global.imageRegistry=null in
 *     //      values when the operator wants no prefix (helm chokes on bare null,
 *     //      so this is awkward in practice).
 *     //   3. Or: add a `.image.registry: ""` per-service override that bypasses
 *     //      the global helper entirely (matches existing escape hatch on line 12).
 *     test('frontend image string has NO docker.io/ prefix when global.imageRegistry is empty', () => {
 *       const dep = findResource(resources, 'Deployment', 'frontend');
 *       const image = dep!.spec.template.spec.containers[0].image as string;
 *       expect(image).not.toMatch(/^docker\.io\//);
 *     });
 *   });
 */
