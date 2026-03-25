/**
 * Pattern Inferrer
 * Infers file name patterns and datasource names from uploaded filenames.
 */

/**
 * Infer a file name pattern from the uploaded filename.
 *
 * Replaces date-like patterns and digit sequences with wildcards to create
 * a glob pattern that would match similar files.
 *
 * Examples:
 *   sales_2026-03-25.csv  -> sales_*.csv
 *   report_20260325.csv   -> report_*.csv
 *   data_2026.json        -> data_*.json
 *   invoices_123_v2.xml   -> invoices_*_v*.xml
 */
export function inferFilePattern(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return replacePatterns(filename);
  }

  const name = filename.substring(0, lastDot);
  const ext = filename.substring(lastDot);

  const pattern = replacePatterns(name);
  return pattern + ext;
}

/**
 * Replace date-like patterns and digit sequences with wildcards.
 */
function replacePatterns(name: string): string {
  let result = name;

  // Replace ISO date patterns: YYYY-MM-DD, YYYY/MM/DD
  result = result.replace(/\d{4}[-/]\d{2}[-/]\d{2}/g, '*');

  // Replace compact date patterns: YYYYMMDD
  result = result.replace(/\d{8}/g, '*');

  // Replace year patterns: YYYY (4 digits that look like years 1900-2099)
  result = result.replace(/(?:19|20)\d{2}/g, '*');

  // Replace remaining sequences of 2+ digits with wildcard
  result = result.replace(/\d{2,}/g, '*');

  // Collapse multiple consecutive wildcards (with optional separators between them)
  result = result.replace(/\*([_\-./]*\*)+/g, '*');

  return result;
}

/**
 * Infer a suggested datasource name from the uploaded filename.
 * Strips the extension from the filename.
 *
 * Examples:
 *   sales_2026.csv -> sales_2026
 *   report.json    -> report
 *   data.tar.gz    -> data
 */
export function inferDatasourceName(filename: string): string {
  // Handle .tar.gz special case
  if (filename.endsWith('.tar.gz')) {
    return filename.slice(0, -7);
  }

  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return filename;
  }

  return filename.substring(0, lastDot);
}
