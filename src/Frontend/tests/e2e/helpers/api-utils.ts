/**
 * Shared API response helpers for E2E test suites.
 *
 * Centralises envelope extraction so datasource-api, scheduling-api,
 * and any future API spec files stay in sync with backend changes.
 */

/** Extract items from the paginated wrapper returned by backend APIs. */
export function extractItems(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const b = body as Record<string, unknown>;
  const data = (b?.Data ?? b?.data) as Record<string, unknown> | undefined;
  if (data) {
    const items = data?.Items ?? data?.items;
    if (Array.isArray(items)) return items;
  }
  return [];
}

/** Extract the ID field tolerating ID / id / Id conventions. */
export function extractId(item: unknown): string | undefined {
  const obj = item as Record<string, unknown>;
  return (obj?.ID ?? obj?.id ?? obj?.Id) as string | undefined;
}

/** Extract the supplier name tolerating multiple casing conventions. */
export function extractSupplier(item: unknown): string | undefined {
  const obj = item as Record<string, unknown>;
  return (obj?.SupplierName ?? obj?.supplierName ?? obj?.Supplier ?? obj?.supplier) as string | undefined;
}
