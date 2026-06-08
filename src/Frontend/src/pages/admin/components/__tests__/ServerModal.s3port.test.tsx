/**
 * ServerModal — MinIO console-port (30901) guard unit coverage (Vitest + RTL)
 *
 * Phase 35 plan 01 (SC-2 / bug G4). The MinIO input/output server form historically
 * accepted the MinIO **Console port 30901**, after which Test Connection fails with the
 * cryptic MinIO error "S3 API Requests must be made to API port". These tests prove the
 * S3-only Port validator that steers the admin to the **S3 API port (default 30900)**:
 *
 *  - S3 + Port 30901  → form validation BLOCKS submit; createServer is never called and
 *    a console-port error message naming the API port (30900) is surfaced.
 *  - S3 + Port 30900  → validation passes; createServer is called (no console-port error).
 *  - ftp + Port 30901 → the guard is S3-only, so submit is NOT blocked by this rule.
 *
 * createServer / updateServer are mocked so we can assert whether submit reached the API.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ServerModal from '../ServerModal';

// ── Mock the servers API client ───────────────────────────────────────────────
const createServerMock = vi.fn(async (req: any) => ({ ID: 'new-id', ...req }));
const updateServerMock = vi.fn(async (_id: string, req: any) => ({ ID: _id, ...req }));

vi.mock('../../../../services/servers-api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../services/servers-api-client')>();
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
        DefaultPort: 30900,
        RequiredFields: [],
      },
      {
        Type: 'ftp',
        DisplayName: 'FTP',
        SupportsInput: true,
        SupportsOutput: true,
        DefaultPort: 21,
        RequiredFields: [],
      },
    ]),
  };
});

// react-i18next: render the `|| '<fallback>'` literals in the component.
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

async function selectType(displayName: string) {
  const typeSelect = document.querySelector('#ServerType') as HTMLElement;
  expect(typeSelect, 'ServerType select input should exist').toBeTruthy();
  fireEvent.mouseDown(typeSelect);
  const option = await screen.findByText(displayName);
  fireEvent.click(option);
}

function setPort(port: number) {
  const portInput = document.querySelector('#Port') as HTMLInputElement;
  expect(portInput, 'Port input should exist').toBeTruthy();
  fireEvent.change(portInput, { target: { value: String(port) } });
}

function clickOk() {
  const okButton = document.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLElement;
  expect(okButton).toBeTruthy();
  fireEvent.click(okButton);
}

describe('ServerModal — MinIO console-port (30901) guard (G4)', () => {
  beforeEach(() => {
    createServerMock.mockClear();
    updateServerMock.mockClear();
  });

  it('blocks submit when ServerType=s3 and Port=30901 (console port) and names the API port', async () => {
    renderModal();
    await selectType('S3 / MinIO');
    await waitFor(() => expect(document.querySelector('#AccessKey')).toBeTruthy());

    // Fill the rest of the required S3 fields so ONLY the port rule can fail.
    fireEvent.change(document.querySelector('#Name') as HTMLElement, { target: { value: 'minio' } });
    fireEvent.change(document.querySelector('#Host') as HTMLElement, { target: { value: '172.24.80.23' } });
    fireEvent.change(document.querySelector('#AccessKey') as HTMLElement, { target: { value: 'appuser' } });
    fireEvent.change(document.querySelector('#SecretKey') as HTMLElement, { target: { value: 'Appsecret123' } });
    fireEvent.change(document.querySelector('#Bucket') as HTMLElement, { target: { value: 'ez-input' } });

    setPort(30901);
    clickOk();

    // Validation must reject — the API is never called.
    await waitFor(() => {
      expect(document.body.textContent).toContain('30900');
    });
    expect(createServerMock).not.toHaveBeenCalled();
    // The error references the console port too.
    expect(document.body.textContent).toContain('30901');
  });

  it('allows submit when ServerType=s3 and Port=30900 (API port)', async () => {
    renderModal();
    await selectType('S3 / MinIO');
    await waitFor(() => expect(document.querySelector('#AccessKey')).toBeTruthy());

    fireEvent.change(document.querySelector('#Name') as HTMLElement, { target: { value: 'minio' } });
    fireEvent.change(document.querySelector('#Host') as HTMLElement, { target: { value: '172.24.80.23' } });
    fireEvent.change(document.querySelector('#AccessKey') as HTMLElement, { target: { value: 'appuser' } });
    fireEvent.change(document.querySelector('#SecretKey') as HTMLElement, { target: { value: 'Appsecret123' } });
    fireEvent.change(document.querySelector('#Bucket') as HTMLElement, { target: { value: 'ez-input' } });

    setPort(30900);
    clickOk();

    // No console-port error → submit reaches the API.
    await waitFor(() => expect(createServerMock).toHaveBeenCalledTimes(1));
    const requestData = createServerMock.mock.calls[0][0];
    expect(requestData.ServerType).toBe('s3');
    expect(requestData.Port).toBe(30900);
  });

  it('does NOT block a non-S3 server (ftp) using port 30901 — the guard is S3-only', async () => {
    renderModal();
    await selectType('FTP');
    await waitFor(() => expect(document.querySelector('#Host')).toBeTruthy());

    fireEvent.change(document.querySelector('#Name') as HTMLElement, { target: { value: 'ftp-srv' } });
    fireEvent.change(document.querySelector('#Host') as HTMLElement, { target: { value: 'ftp.example.com' } });

    setPort(30901);
    clickOk();

    // The S3-only console-port rule must not fire for ftp → submit reaches the API.
    await waitFor(() => expect(createServerMock).toHaveBeenCalledTimes(1));
    const requestData = createServerMock.mock.calls[0][0];
    expect(requestData.ServerType).toBe('ftp');
    expect(requestData.Port).toBe(30901);
  });
});
