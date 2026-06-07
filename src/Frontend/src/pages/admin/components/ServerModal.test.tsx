/**
 * ServerModal — S3/MinIO branch unit coverage (Vitest + @testing-library/react)
 *
 * Phase 34 plan 05 (SC-02). Proves the S3 branch authored in 34-03:
 *  - Selecting ServerType "s3" renders Access Key, a MASKED Secret Key
 *    (Input.Password → input[type=password]), Bucket, and the
 *    path-style / http switches — technical inputs carry className "ltr-field".
 *  - handleSubmit packs requestData.TypeSpecificConfig with exact PascalCase
 *    keys { AccessKey, SecretKey, Bucket, ForcePathStyle, UseHttp }
 *    (the 34-01 contract — casing drift = "IAM credentials is missing").
 *  - In edit mode the Secret Key shows the masked sentinel "********" and is
 *    NOT pre-filled with any real value; leaving it unchanged posts the
 *    sentinel back verbatim (backend keep-existing logic, 34-02).
 *
 * The createServer / updateServer API functions are mocked and the mutation
 * argument is captured to assert on the packed TypeSpecificConfig.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ServerModal from './ServerModal';
import type { AdminServer } from '../../../services/servers-api-client';

// ── Mock the servers API client ───────────────────────────────────────────────
// createServer/updateServer are spied so we can assert on the request payload;
// getServerTypes returns an s3 type so the <Select> exposes the s3 option.
const createServerMock = vi.fn(async (req: any) => ({ ID: 'new-id', ...req }));
const updateServerMock = vi.fn(async (_id: string, req: any) => ({ ID: _id, ...req }));

vi.mock('../../../services/servers-api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/servers-api-client')>();
  return {
    ...actual,
    createServer: (req: any) => createServerMock(req),
    updateServer: (id: string, req: any) => updateServerMock(id, req),
    getServerTypes: vi.fn(async () => [
      {
        Type: 's3',
        DisplayName: 'S3 / MinIO',
        SupportsInput: true,
        SupportsOutput: true,
        DefaultPort: 9000,
        RequiredFields: [],
      },
    ]),
  };
});

// react-i18next: render the fallback (the `|| 'עברית'` literal in the component)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string) => undefined, i18n: { language: 'he' } }),
}));

function renderModal(props: Partial<React.ComponentProps<typeof ServerModal>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ServerModal
        visible
        server={null}
        onClose={onClose}
        onSuccess={onSuccess}
        {...props}
      />
    </QueryClientProvider>
  );
  return { ...utils, onClose, onSuccess };
}

// Open the ServerType <Select> and pick the S3 option.
async function selectS3Type() {
  // The type Select is the first combobox in the modal.
  const typeSelect = document.querySelector('#ServerType') as HTMLElement;
  expect(typeSelect, 'ServerType select input should exist').toBeTruthy();
  fireEvent.mouseDown(typeSelect);
  // The s3 option appears in the dropdown.
  const option = await screen.findByText('S3 / MinIO');
  fireEvent.click(option);
}

describe('ServerModal — S3/MinIO branch', () => {
  beforeEach(() => {
    createServerMock.mockClear();
    updateServerMock.mockClear();
  });

  it('renders the masked Secret Key plus Access Key / Bucket / switches when type=s3', async () => {
    renderModal();
    await selectS3Type();

    // Wait for the S3 branch to mount (Access Key input keyed by form name "AccessKey").
    const accessKey = await waitFor(() => {
      const el = document.querySelector('#AccessKey') as HTMLInputElement;
      expect(el).toBeTruthy();
      return el;
    });

    const secretKey = document.querySelector('#SecretKey') as HTMLInputElement;
    const bucket = document.querySelector('#Bucket') as HTMLInputElement;
    const usePathStyle = document.querySelector('#UsePathStyle') as HTMLInputElement;
    const useHttp = document.querySelector('#UseHttp') as HTMLInputElement;

    expect(accessKey, 'Access Key input').toBeTruthy();
    expect(secretKey, 'Secret Key input').toBeTruthy();
    expect(bucket, 'Bucket input').toBeTruthy();
    expect(usePathStyle, 'UsePathStyle switch').toBeTruthy();
    expect(useHttp, 'UseHttp switch').toBeTruthy();

    // Region field was intentionally removed from the S3 form — backend defaults it to us-east-1.
    expect(document.querySelector('#Region'), 'Region input should be gone').toBeNull();

    // Secret Key is masked (Ant Input.Password → input[type=password]).
    expect(secretKey.getAttribute('type')).toBe('password');

    // Technical inputs carry the ltr-field class (CLAUDE.md RTL rule).
    // Plain Inputs apply it on the <input> element; Input.Password applies it on
    // the affix wrapper span, so we check the secret field's closest ltr-field host.
    expect(accessKey.className).toContain('ltr-field');
    expect(bucket.className).toContain('ltr-field');
    expect(
      secretKey.closest('.ltr-field'),
      'Secret Key affix wrapper should carry ltr-field'
    ).toBeTruthy();
  });

  it('packs PascalCase TypeSpecificConfig on submit (AccessKey/SecretKey/Bucket/ForcePathStyle/UseHttp)', async () => {
    renderModal();
    await selectS3Type();

    await waitFor(() => expect(document.querySelector('#AccessKey')).toBeTruthy());

    // Fill the required fields.
    fireEvent.change(document.querySelector('#Name') as HTMLElement, {
      target: { value: 'minio-test' },
    });
    fireEvent.change(document.querySelector('#Host') as HTMLElement, {
      target: { value: '172.24.80.23' },
    });
    fireEvent.change(document.querySelector('#AccessKey') as HTMLElement, {
      target: { value: 'minioadmin' },
    });
    fireEvent.change(document.querySelector('#SecretKey') as HTMLElement, {
      target: { value: 'minioadmin123' },
    });
    fireEvent.change(document.querySelector('#Bucket') as HTMLElement, {
      target: { value: 'test-bucket' },
    });

    // Click the modal OK button ("צור" / create fallback).
    const okButton = document.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLElement;
    expect(okButton).toBeTruthy();
    fireEvent.click(okButton);

    await waitFor(() => expect(createServerMock).toHaveBeenCalledTimes(1));

    const requestData = createServerMock.mock.calls[0][0];
    expect(requestData.ServerType).toBe('s3');
    expect(requestData.TypeSpecificConfig).toBeTruthy();

    // Exact PascalCase key set — no camelCase drift.
    const cfg = requestData.TypeSpecificConfig;
    expect(Object.keys(cfg).sort()).toEqual(
      ['AccessKey', 'Bucket', 'ForcePathStyle', 'SecretKey', 'UseHttp'].sort()
    );
    expect(cfg.AccessKey).toBe('minioadmin');
    expect(cfg.SecretKey).toBe('minioadmin123');
    expect(cfg.Bucket).toBe('test-bucket');
    expect(cfg.Region).toBeUndefined();
    // Switches default to true → ForcePathStyle/UseHttp true.
    expect(cfg.ForcePathStyle).toBe(true);
    expect(cfg.UseHttp).toBe(true);
  });

  it('edit mode: Secret Key shows the masked sentinel "********" and never a real value', async () => {
    const existing: AdminServer = {
      ID: 'srv-1',
      Name: 'existing-minio',
      ServerType: 's3',
      Direction: 'Both',
      IsActive: true,
      Host: '172.24.80.23',
      Port: 9000,
      ConnectionTimeoutSeconds: 30,
      RetryCount: 3,
      CreatedAt: '2026-06-02T00:00:00Z',
      UpdatedAt: '2026-06-02T00:00:00Z',
      TypeSpecificConfig: {
        AccessKey: 'minioadmin',
        // API never returns a real SecretKey — write-only (34-02).
        Bucket: 'existing-bucket',
        Region: 'eu-west-1',
        ForcePathStyle: true,
        UseHttp: true,
      },
    };

    renderModal({ server: existing });

    const secretKey = await waitFor(() => {
      const el = document.querySelector('#SecretKey') as HTMLInputElement;
      expect(el).toBeTruthy();
      return el;
    });

    // Masked sentinel pre-filled; NOT any real secret.
    expect(secretKey.value).toBe('********');

    // Access Key / Bucket are flattened back from TypeSpecificConfig.
    expect((document.querySelector('#AccessKey') as HTMLInputElement).value).toBe('minioadmin');
    expect((document.querySelector('#Bucket') as HTMLInputElement).value).toBe('existing-bucket');
    // Region was removed from the form; a legacy stored Region is simply ignored (no input rendered).
    expect(document.querySelector('#Region')).toBeNull();
  });

  it('edit mode: leaving the sentinel unchanged posts it back verbatim (keep-existing secret)', async () => {
    const existing: AdminServer = {
      ID: 'srv-2',
      Name: 'keep-secret-minio',
      ServerType: 's3',
      Direction: 'Both',
      IsActive: true,
      Host: '172.24.80.23',
      Port: 9000,
      ConnectionTimeoutSeconds: 30,
      RetryCount: 3,
      CreatedAt: '2026-06-02T00:00:00Z',
      UpdatedAt: '2026-06-02T00:00:00Z',
      TypeSpecificConfig: {
        AccessKey: 'minioadmin',
        Bucket: 'keep-bucket',
        Region: 'us-east-1',
        ForcePathStyle: true,
        UseHttp: true,
      },
    };

    renderModal({ server: existing });

    await waitFor(() => expect(document.querySelector('#SecretKey')).toBeTruthy());

    // Save without touching the Secret Key field (sentinel stays).
    const okButton = document.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLElement;
    fireEvent.click(okButton);

    await waitFor(() => expect(updateServerMock).toHaveBeenCalledTimes(1));

    const [, requestData] = updateServerMock.mock.calls[0];
    // Sentinel posted back verbatim → backend retains the stored secret.
    expect(requestData.TypeSpecificConfig.SecretKey).toBe('********');
  });
});
