/**
 * Bad data fixture loader for negative E2E tests.
 * Loads static test fixtures from test-data/e2e-validation/ by category.
 *
 * Categories:
 * - schema-violations: CSV with wrong types, missing required, extra fields
 * - malformed: Corrupted CSV, invalid JSON, truncated files
 * - mixed: Files with both valid and invalid records
 * - wrong-format: Valid files in wrong format for DataSource config
 */
import * as fs from 'fs';
import * as path from 'path';

export const BAD_DATA_DIR = path.resolve(
  process.env.PROJECT_ROOT || 'C:\\Users\\UserC\\source\\repos\\EZ',
  'test-data', 'e2e-validation'
);

export type BadDataCategory = 'schema-violations' | 'malformed' | 'mixed' | 'wrong-format';

/**
 * Load a bad data fixture file by category and filename.
 * Returns the file contents as a Buffer suitable for writeFile().
 */
export function loadBadDataFixture(category: BadDataCategory, filename: string): Buffer {
  const filePath = path.join(BAD_DATA_DIR, category, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Bad data fixture not found: ${filePath}`);
  }
  return fs.readFileSync(filePath);
}

/**
 * List all fixture files in a given category directory.
 */
export function listBadDataFixtures(category: BadDataCategory): string[] {
  const dir = path.join(BAD_DATA_DIR, category);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => !f.startsWith('.'));
}
