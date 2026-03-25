# Phase 27: Import from File - Research

**Researched:** 2026-03-25
**Domain:** Client-side file parsing, schema inference, archive extraction, encoding detection
**Confidence:** HIGH

## Summary

Phase 27 adds a "Create from File" capability where users upload a sample data file and the system auto-fills the entire datasource create form. The feature is primarily frontend-only (React 19 + Ant Design 5.x + TypeScript), with one backend fix to `CsvToJsonConverter` for headerless CSV handling (IMPORT-06).

The core parsing stack is well-established: PapaParse for CSV (with built-in delimiter auto-detection and dynamic typing), SheetJS/xlsx for Excel, browser DOMParser for XML, and native JSON.parse for JSON. Archive handling uses JSZip for standard .zip files, with libarchive.js (WASM-based) as the single library covering .tar.gz, .rar, and .7z. Password-protected archives are only supported for .zip format via libarchive.js (JSZip does NOT support encrypted zips). Encoding detection uses jschardet which supports Windows-1255 and ISO-8859-8 (Hebrew encodings).

**Primary recommendation:** Use PapaParse + xlsx + jschardet + JSZip + libarchive.js as the parsing stack. Build a unified `FileAnalyzer` module that delegates to format-specific parsers and returns a standardized `ImportData` structure matching `location.state.importData`. Reuse the Phase 25 `location.state` pattern and the existing `schemaAutoSuggest.ts` for constraint detection.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** "Create from File" button on datasource list page, placed next to existing "Create Datasource" button. Two buttons: `[+ Create Datasource]` `[Upload File]`
- **D-02:** Upload dialog accepts: `.csv`, `.json`, `.xml`, `.xlsx`, `.zip`, `.tar.gz`, `.rar`, `.7z`
- **D-03:** Step 1: Upload file -> client-side analysis -> preview modal showing all extracted info
- **D-04:** Step 2: User reviews -> clicks "Continue" -> navigates to `/datasources/new` with `location.state = { importData: extractedData }` -> form opens pre-filled
- **D-05:** DataSourceFormEnhanced reads `location.state.importData` same pattern as `location.state.cloneData`
- **D-06:** Extract ALL of: file type, encoding, CSV delimiter, has headers, JSON Schema with types, smart constraints via schemaAutoSuggest, file name pattern, datasource name, archive settings
- **D-07:** Completeness sidebar (Phase 26) shows auto-filled (green) vs missing (red)
- **D-08:** Preview modal is read-only except for headerless CSV field names (D-12)
- **D-09:** Show 5 rows of parsed data in preview table. Footer shows total row count.
- **D-10:** Extraction checklist shows each field with detected type AND auto-suggested constraint
- **D-11:** XML preview uses tree view (collapsible), not flat table
- **D-12:** Auto-detect whether first row is headers. Show toggle: "First row is headers: [Yes/No]"
- **D-13:** Headerless CSV: show editable field name inputs above data rows in preview
- **D-14:** User-provided field names become schema property names, synced to `hasHeaders: false`
- **D-15:** Field names from user input, NOT synthetic `field_1, field_2` (fallback to field_N if blank)
- **D-16:** Archive files: list files inside, prompt password if encrypted, let user select file if multiple
- **D-17:** Archive password auto-filled into archive settings on Connection tab
- **D-18:** Archive type, extraction pattern auto-filled from archive analysis
- **D-19:** Client-side archive extraction using JSZip for .zip, evaluate others during research
- **D-20:** ALL extracted info pushed to form fields via `location.state.importData` (full list in CONTEXT.md)
- **D-21:** Fix CsvToJsonConverter to use JSON Schema property names by position for headerless CSV

### Claude's Discretion
- File size limit for client-side parsing (recommend 10MB)
- Upload progress indicator styling
- Preview modal width and layout
- Error handling for malformed/corrupt files
- Encoding detection library choice
- Tree view component for XML preview
- File name pattern inference algorithm
- Auto-suggest confidence threshold

### Deferred Ideas (OUT OF SCOPE)
- Import from URL (fetch a remote file and analyze it)
- Batch import (upload multiple files, create multiple datasources)
- Re-import (update existing datasource schema from a new file version)
- Server-side file analysis (for files too large for client-side parsing)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPORT-01 | User can upload a sample data file (CSV, JSON, XML) to auto-fill datasource form | Ant Design Upload/Dragger component, FileAnalyzer module pattern |
| IMPORT-02 | System infers JSON Schema 2020-12 from file content with type detection | Type inference algorithm (integer/number/boolean/date/string), PapaParse dynamicTyping, schema generation pattern |
| IMPORT-03 | CSV without headers generates synthetic field names (field_1, field_2, ... field_N) | PapaParse header:false mode, headerless detection algorithm |
| IMPORT-04 | System applies smart constraints via schemaAutoSuggest | Existing `suggestConstraintsForField()` + `applySuggestionsToSchema()` ready to use |
| IMPORT-05 | User can preview parsed data and review/edit inferred schema before applying | Ant Design Table for data preview, Modal for wizard, Tree for XML |
| IMPORT-06 | CsvToJsonConverter uses schema field names by position for headerless CSV | CsvHelper metadata parameter, CsvConfiguration.HasHeaderRecord, manual column-to-property mapping |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Ant Design App.useApp():** NEVER use static Modal.confirm/message.success -- use App.useApp() hook
- **Lazy tab + Form.setFieldsValue bug:** Must use savedFieldValues prop pattern for lazy-loaded tabs
- **PascalCase API payloads:** Backend expects PascalCase; frontend types use camelCase -- map in API calls
- **SignalR CRUD requirement:** Not applicable to this phase (no backend CRUD operations)
- **Testing:** Every UI phase MUST run both Playwright and webapp-testing tools before complete
- **Central Package Management:** Repo uses `Directory.Packages.props` -- never put versions in csproj PackageReference
- **Frontend image tagging:** Must use new tag (current: v0.3.0) when rebuilding

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| papaparse | 5.5.3 | CSV parsing | De facto standard; auto-detect delimiter, header support, dynamic typing, streaming, browser-native |
| @types/papaparse | 5.5.2 | TypeScript types | Official type definitions for PapaParse |
| xlsx (SheetJS CE) | 0.18.5 | Excel .xlsx parsing | Apache 2.0 license, battle-tested, browser-native ArrayBuffer parsing, cell type metadata |
| jschardet | 3.1.4 | Encoding detection | Port of Python chardet; supports Windows-1255, ISO-8859-8 (Hebrew), UTF-8, UTF-16 |
| jszip | 3.10.1 | .zip extraction | Standard zip library, well-maintained, but NO password support |
| libarchive.js | 2.0.2 | .tar.gz/.rar/.7z/.zip(encrypted) extraction | WASM port of libarchive; supports encrypted .zip, .rar v4/v5, .7z, .tar.gz via WebWorker |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| antd Upload/Dragger | 5.x (existing) | File upload UI | Already in project; use `beforeUpload` to intercept and parse client-side |
| antd Tree | 5.x (existing) | XML preview | Already in project; use for collapsible XML structure display (D-11) |
| antd Modal | 5.x (existing) | Preview wizard | Already in project; use for the two-step preview modal |
| antd Table | 5.x (existing) | Data preview | Already in project; use for 5-row parsed data preview (D-09) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| xlsx (SheetJS) | exceljs 4.4.0 | ExcelJS is heavier (~800KB vs ~300KB), more write-focused; SheetJS is better for read-only parsing |
| jschardet | chardet (npm) | chardet is Node-only, not browser-compatible; jschardet works in browser |
| libarchive.js | 7z-wasm 1.2.0 | 7z-wasm is full 7zip CLI compiled to WASM (~2MB), overkill for extraction-only use case |
| JSZip + libarchive.js | libarchive.js only | Could use libarchive.js for all archives including .zip, but JSZip is simpler/faster for unencrypted .zip |

**Installation:**
```bash
cd src/Frontend
npm install papaparse @types/papaparse xlsx jschardet jszip libarchive.js
```

## Architecture Patterns

### Recommended Project Structure
```
src/Frontend/src/
├── utils/
│   ├── fileAnalyzer/
│   │   ├── index.ts              # Main FileAnalyzer orchestrator
│   │   ├── types.ts              # ImportData, AnalysisResult interfaces
│   │   ├── csvAnalyzer.ts        # PapaParse-based CSV analysis
│   │   ├── jsonAnalyzer.ts       # JSON.parse-based analysis
│   │   ├── xmlAnalyzer.ts        # DOMParser-based XML analysis
│   │   ├── excelAnalyzer.ts      # SheetJS-based Excel analysis
│   │   ├── archiveHandler.ts     # JSZip + libarchive.js extraction
│   │   ├── encodingDetector.ts   # jschardet wrapper
│   │   ├── schemaInferrer.ts     # Type inference + JSON Schema generation
│   │   └── patternInferrer.ts    # File name pattern inference
│   ├── schemaAutoSuggest.ts      # (existing) Smart constraint detection
│   └── schemaValidator.ts        # (existing) Schema validation
├── components/
│   └── datasource/
│       └── import/
│           ├── ImportFromFileButton.tsx    # Upload trigger button
│           ├── ImportPreviewModal.tsx      # Two-step preview modal
│           ├── DataPreviewTable.tsx        # 5-row data preview table
│           ├── XmlTreePreview.tsx          # XML tree view (D-11)
│           ├── HeaderlessFieldEditor.tsx   # Editable field names (D-13)
│           ├── ExtractionChecklist.tsx     # Field type + constraint list (D-10)
│           └── ArchiveFileSelector.tsx     # File selection from archive (D-16)
└── pages/
    └── datasources/
        ├── DataSourceList.tsx             # (modify) Add "Upload File" button
        └── DataSourceFormEnhanced.tsx     # (modify) Read location.state.importData
```

### Pattern 1: FileAnalyzer Orchestrator
**What:** Central module that accepts a File object, detects format, delegates to the correct analyzer, and returns a unified `ImportData` structure.
**When to use:** Called from the import button click handler after file upload.
**Example:**
```typescript
// src/utils/fileAnalyzer/index.ts
export interface ImportData {
  // Basic Info tab
  name: string;                    // Suggested from filename
  // File Settings tab
  fileType: 'CSV' | 'JSON' | 'XML' | 'Excel';
  encoding: string;
  csvDelimiter?: string;
  hasHeaders?: boolean;
  // Schema tab
  jsonSchema: object;              // JSON Schema 2020-12
  // Connection tab
  filePattern: string;             // e.g., "sales_*.csv"
  isArchiveSource?: boolean;
  archiveType?: string;
  archivePassword?: string;
  extractionPattern?: string;
  // Preview data
  previewRows: Record<string, any>[];  // First 5 rows
  totalRowCount: number;
  fieldNames: string[];
  fieldTypes: Record<string, string>;  // field -> detected type
  fieldConstraints: Record<string, any>; // field -> suggested constraints
}

export async function analyzeFile(file: File): Promise<ImportData> {
  const extension = getExtension(file.name);

  // Step 1: Handle archives
  if (isArchiveExtension(extension)) {
    return await handleArchive(file);
  }

  // Step 2: Detect encoding
  const buffer = await file.arrayBuffer();
  const encoding = detectEncoding(new Uint8Array(buffer));

  // Step 3: Decode content
  const decoder = new TextDecoder(encoding);
  const text = decoder.decode(buffer);

  // Step 4: Delegate to format-specific analyzer
  switch (extension) {
    case '.csv': return analyzeCsv(text, file.name, encoding);
    case '.json': return analyzeJson(text, file.name, encoding);
    case '.xml': return analyzeXml(text, file.name, encoding);
    case '.xlsx': return analyzeExcel(buffer, file.name);
    default: throw new Error(`Unsupported format: ${extension}`);
  }
}
```

### Pattern 2: Type Inference Algorithm
**What:** Sample-based type detection from parsed values. Check N rows, use majority type.
**When to use:** After parsing data rows, before generating JSON Schema.
**Example:**
```typescript
// src/utils/fileAnalyzer/schemaInferrer.ts
type InferredType = 'string' | 'integer' | 'number' | 'boolean';

function inferTypeFromValue(value: string): InferredType {
  if (value === '') return 'string';

  // Boolean check
  if (['true', 'false', 'yes', 'no', '0', '1'].includes(value.toLowerCase())) {
    return 'boolean';
  }

  // Integer check (no decimal point)
  if (/^-?\d+$/.test(value)) {
    return 'integer';
  }

  // Number check (with decimal)
  if (/^-?\d+\.\d+$/.test(value)) {
    return 'number';
  }

  return 'string';
}

function inferColumnType(values: string[]): InferredType {
  const nonEmpty = values.filter(v => v !== '');
  if (nonEmpty.length === 0) return 'string';

  const types = nonEmpty.map(inferTypeFromValue);
  const counts: Record<string, number> = {};
  types.forEach(t => { counts[t] = (counts[t] || 0) + 1; });

  // Majority rules, with type hierarchy: integer < number < string
  // If mix of integer and number -> number
  // If any string mixed with numbers -> string
  if (counts['string'] && counts['string'] > 0) return 'string';
  if (counts['number'] && counts['number'] > 0) return 'number';
  if (counts['boolean'] === nonEmpty.length) return 'boolean';
  if (counts['integer'] === nonEmpty.length) return 'integer';

  return 'string';
}

function generateJsonSchema(
  fieldNames: string[],
  rows: Record<string, string>[],
  applySuggestions: boolean
): object {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const field of fieldNames) {
    const values = rows.map(r => r[field] || '');
    const type = inferColumnType(values);

    let propSchema: any = { type };

    // Apply auto-suggest constraints (IMPORT-04)
    if (applySuggestions) {
      const suggestions = suggestConstraintsForField(field);
      propSchema = applySuggestionsToSchema(propSchema, suggestions);
    }

    properties[field] = propSchema;

    // If no empty values in sample, mark as required
    if (values.every(v => v !== '')) {
      required.push(field);
    }
  }

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties,
    required,
    additionalProperties: false
  };
}
```

### Pattern 3: Headerless CSV Detection
**What:** Compare first row types vs remaining rows to detect if first row is headers.
**When to use:** During CSV analysis, before schema generation.
**Example:**
```typescript
// Heuristic: if first row has different type distribution than subsequent rows, it's headers
function detectHasHeaders(rows: string[][]): boolean {
  if (rows.length < 2) return true; // Can't tell with 1 row, assume headers

  const firstRow = rows[0];
  const dataRows = rows.slice(1, Math.min(6, rows.length));

  // Count how many first-row values look like data (numeric, boolean)
  let firstRowDataLike = 0;
  for (const val of firstRow) {
    if (/^-?\d+(\.\d+)?$/.test(val) || ['true','false'].includes(val.toLowerCase())) {
      firstRowDataLike++;
    }
  }

  // Count average data-like values in subsequent rows
  let avgDataLike = 0;
  for (const row of dataRows) {
    let count = 0;
    for (const val of row) {
      if (/^-?\d+(\.\d+)?$/.test(val) || ['true','false'].includes(val.toLowerCase())) {
        count++;
      }
    }
    avgDataLike += count;
  }
  avgDataLike /= dataRows.length;

  // If first row has significantly fewer numeric/boolean values than data rows -> headers
  // If first row looks just like data rows -> no headers
  return firstRowDataLike < avgDataLike * 0.5;
}
```

### Pattern 4: File Name Pattern Inference
**What:** Derive a glob pattern from the uploaded filename by wildcarding variable parts.
**When to use:** To suggest `filePattern` in the Connection tab.
**Example:**
```typescript
function inferFilePattern(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.'));
  const base = filename.substring(0, filename.lastIndexOf('.'));

  // Replace date-like patterns: 2026, 20260325, 2026-03-25
  let pattern = base
    .replace(/\d{4}[-_]?\d{2}[-_]?\d{2}/g, '*')  // YYYY-MM-DD or YYYYMMDD
    .replace(/\d{4}/g, '*')                         // Standalone year
    .replace(/\d{2,}/g, '*');                        // Any remaining number sequences

  // Collapse multiple wildcards
  pattern = pattern.replace(/\*+/g, '*');

  return `${pattern}${ext}`;
}
```

### Pattern 5: location.state.importData Integration
**What:** Same pattern as Phase 25 cloneData but for import. DataSourceFormEnhanced reads importData on mount.
**When to use:** When navigating from preview modal to form.
**Example:**
```typescript
// In DataSourceFormEnhanced.tsx (additions alongside existing cloneData)
const importData = (location.state as { importData?: ImportData } | null)?.importData;

// In useEffect, alongside cloneData handling:
React.useEffect(() => {
  if (!importData) return;

  const formValues: Record<string, any> = {
    name: importData.name,
    fileType: importData.fileType,
    encoding: importData.encoding,
    hasHeaders: importData.hasHeaders ?? true,
    csvDelimiter: importData.csvDelimiter || ',',
    filePattern: importData.filePattern,
    isArchiveSource: importData.isArchiveSource || false,
    archiveType: importData.archiveType,
    archivePassword: importData.archivePassword,
    extractionPattern: importData.extractionPattern,
  };

  form.setFieldsValue(formValues);

  if (importData.jsonSchema) {
    setJsonSchema(importData.jsonSchema);
  }
}, [importData]);
```

### Anti-Patterns to Avoid
- **Reading entire large file into memory at once:** Use PapaParse `preview` option to limit rows parsed. Set file size limit at 10MB.
- **Synchronous parsing blocking UI:** Use PapaParse `worker: true` for large CSVs to keep UI responsive.
- **Assuming headers without detection:** Always run header detection algorithm; don't assume CSV has headers.
- **Generating schema from only 1 row:** Sample at least 20 rows (or all if less) for reliable type inference.
- **Using static Modal.confirm:** Must use App.useApp() hook per CLAUDE.md.
- **Putting versions in .csproj:** Backend uses Central Package Management (Directory.Packages.props).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom CSV parser | PapaParse | Handles quoting, escaping, multi-line values, BOM, streaming; 5.5.3 is battle-tested |
| Excel parsing | Custom xlsx reader | SheetJS xlsx | Binary format with complex internals (shared strings, styles, formulas) |
| Encoding detection | Byte-level heuristics | jschardet | Ported from Python chardet, handles Hebrew encodings (Windows-1255, ISO-8859-8) |
| Zip extraction | Custom zip decompressor | JSZip / libarchive.js | Deflate, ZIP64, file metadata, encryption all handled |
| Type inference | Regex-only approach | PapaParse dynamicTyping + custom inferrer | PapaParse handles edge cases (scientific notation, locale numbers) |
| XML to tree structure | Manual recursive parsing | Browser DOMParser + recursive walk | Native API, handles namespaces, entities, CDATA |

**Key insight:** File format parsing has edge cases that take months to discover. Every library above handles hundreds of real-world quirks that a hand-rolled solution would miss.

## Common Pitfalls

### Pitfall 1: PapaParse encoding parameter is for File objects only
**What goes wrong:** Setting `encoding` in PapaParse config has no effect when parsing a string. It only applies when PapaParse opens a File object directly.
**Why it happens:** PapaParse uses FileReader.readAsText() which accepts encoding. But if you pre-decode to string, encoding is already applied.
**How to avoid:** Either pass the File object to PapaParse and let it handle encoding, OR use jschardet + TextDecoder to decode first, then pass the string to PapaParse.
**Warning signs:** Hebrew text appears as garbled characters in preview.

### Pitfall 2: JSZip does NOT support password-protected archives
**What goes wrong:** `loadAsync()` throws an error when encountering encrypted ZIP entries.
**Why it happens:** JSZip has never implemented encryption support (open issue since 2014).
**How to avoid:** Use libarchive.js for encrypted .zip files. Detect encryption by trying JSZip first; on failure, fall back to libarchive.js. Or use libarchive.js exclusively for all archive types.
**Warning signs:** "Encrypted zip not supported" error from JSZip.

### Pitfall 3: libarchive.js requires WebWorker setup
**What goes wrong:** libarchive.js fails with "Worker not found" or similar errors.
**Why it happens:** The library uses WebAssembly via a WebWorker. The WASM file and worker script must be accessible at the correct path.
**How to avoid:** Copy the WASM file to the public directory or configure Vite to handle it. Use `Archive.init({ workerUrl: '/path/to/worker-bundle.js' })`.
**Warning signs:** Console errors about missing worker or WASM file.

### Pitfall 4: Ant Design lazy tab + Form.setFieldsValue silently drops values
**What goes wrong:** `form.setFieldsValue()` discards values for Form.Item fields not yet mounted (lazy-loaded tabs).
**Why it happens:** Ant Design Form only tracks fields that have been rendered at least once.
**How to avoid:** Use the `savedFieldValues` prop pattern (documented in MEMORY.md). Pass import data as a prop to tab components and re-apply via `useEffect` on mount.
**Warning signs:** Switching to Connection tab or File Settings tab shows empty fields despite import data.

### Pitfall 5: SheetJS reads cell types but dynamicTyping not automatic
**What goes wrong:** All Excel cell values come back as strings despite cells being formatted as numbers.
**Why it happens:** SheetJS default `raw: false` returns formatted strings. Need `raw: true` or use cell type metadata.
**How to avoid:** Use `XLSX.utils.sheet_to_json(sheet, { raw: true })` to get typed values. Or inspect cell `.t` property for type ('n' = number, 'b' = boolean, 's' = string, 'd' = date).
**Warning signs:** Schema inference marks all Excel fields as "string".

### Pitfall 6: XML nested structure requires recursive schema
**What goes wrong:** Flat schema inference fails for XML with nested elements.
**Why it happens:** XML is inherently hierarchical; a single-level object schema doesn't capture nesting.
**How to avoid:** Walk the DOM tree recursively. For the schema, generate nested `object` types with `properties`. For preview, use Ant Design Tree component (D-11).
**Warning signs:** XML fields appear as "[object Object]" in preview or schema has only top-level fields.

### Pitfall 7: CsvToJsonConverter always assumes HasHeaderRecord = true
**What goes wrong:** Headerless CSV processed by backend generates Column1, Column2 keys instead of schema field names.
**Why it happens:** `CsvConfiguration.HasHeaderRecord` is hardcoded to `true`. The `metadata` parameter is accepted by the interface but never read by the converter.
**How to avoid:** Fix CsvToJsonConverter to: (1) read `HasHeader` from metadata dict, (2) when false, read schema property names from metadata and assign by position.
**Warning signs:** Validation fails because record keys (Column1) don't match schema property names (name, age, email).

## Code Examples

### CSV Analysis with PapaParse
```typescript
// Source: https://www.papaparse.com/docs
import Papa from 'papaparse';

function analyzeCsv(text: string, filename: string, encoding: string): ImportData {
  // Parse with header detection disabled first to check
  const rawResult = Papa.parse(text, {
    header: false,
    preview: 21,  // 1 potential header + 20 data rows
    dynamicTyping: false,  // Keep as strings for type inference
    skipEmptyLines: true,
  });

  const rawRows = rawResult.data as string[][];
  const detectedDelimiter = rawResult.meta.delimiter;

  // Detect if first row is headers
  const hasHeaders = detectHasHeaders(rawRows);

  let fieldNames: string[];
  let dataRows: string[][];

  if (hasHeaders) {
    fieldNames = rawRows[0];
    dataRows = rawRows.slice(1);
  } else {
    fieldNames = rawRows[0].map((_, i) => `field_${i + 1}`);
    dataRows = rawRows;
  }

  // Re-parse full file for row count (using step for efficiency)
  let totalRowCount = 0;
  Papa.parse(text, {
    header: false,
    skipEmptyLines: true,
    step: () => { totalRowCount++; },
  });
  if (hasHeaders) totalRowCount--;

  // Build preview rows as objects
  const previewRows = dataRows.slice(0, 5).map(row => {
    const obj: Record<string, any> = {};
    fieldNames.forEach((name, i) => { obj[name] = row[i] || ''; });
    return obj;
  });

  // Infer schema
  const schema = generateJsonSchema(fieldNames, dataRows, true);

  return {
    name: filename.replace(/\.[^.]+$/, ''),
    fileType: 'CSV',
    encoding,
    csvDelimiter: detectedDelimiter,
    hasHeaders,
    jsonSchema: schema,
    filePattern: inferFilePattern(filename),
    previewRows,
    totalRowCount,
    fieldNames,
    fieldTypes: /* from inference */,
    fieldConstraints: /* from schemaAutoSuggest */,
  };
}
```

### Encoding Detection with jschardet
```typescript
// Source: https://github.com/aadsm/jschardet
import jschardet from 'jschardet';

function detectEncoding(buffer: Uint8Array): string {
  // Check BOM first
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) return 'UTF-8';
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) return 'UTF-16LE';
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) return 'UTF-16BE';

  // Use jschardet for content-based detection
  // Convert Uint8Array to binary string for jschardet
  const binaryStr = Array.from(buffer.slice(0, 4096))
    .map(b => String.fromCharCode(b))
    .join('');

  const result = jschardet.detect(binaryStr);

  // Map to our encoding names
  const encodingMap: Record<string, string> = {
    'UTF-8': 'UTF-8',
    'windows-1255': 'Windows-1255',
    'ISO-8859-8': 'ISO-8859-8',
    'UTF-16LE': 'UTF-16',
    'UTF-16BE': 'UTF-16',
    'ascii': 'UTF-8',  // ASCII is subset of UTF-8
  };

  return encodingMap[result.encoding] || 'UTF-8';
}
```

### Archive Handling with JSZip + libarchive.js
```typescript
// Source: https://stuk.github.io/jszip/ and https://github.com/nicka-begiashvili/libarchivejs
import JSZip from 'jszip';
import { Archive } from 'libarchive.js';

async function handleArchive(file: File): Promise<{
  files: string[];
  isEncrypted: boolean;
  extractFile: (filename: string, password?: string) => Promise<ArrayBuffer>;
}> {
  const extension = getExtension(file.name);

  if (extension === '.zip') {
    try {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const files = Object.keys(zip.files).filter(f => !zip.files[f].dir);
      return {
        files,
        isEncrypted: false,
        extractFile: async (filename: string) => {
          const entry = zip.files[filename];
          return await entry.async('arraybuffer');
        }
      };
    } catch (e) {
      // Likely encrypted -- fall through to libarchive.js
    }
  }

  // Use libarchive.js for .tar.gz, .rar, .7z, and encrypted .zip
  const archive = await Archive.open(file);
  const entries = await archive.getFilesObject();
  const fileNames = Object.keys(entries);

  return {
    files: fileNames,
    isEncrypted: /* determined by attempting extraction */,
    extractFile: async (filename: string, password?: string) => {
      // libarchive.js handles password internally during extraction
      const extracted = await archive.extractFiles();
      const targetFile = extracted[filename];
      return await targetFile.arrayBuffer();
    }
  };
}
```

### Excel Analysis with SheetJS
```typescript
// Source: https://docs.sheetjs.com/
import * as XLSX from 'xlsx';

function analyzeExcel(buffer: ArrayBuffer, filename: string): ImportData {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get typed values
  const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: true });
  const fieldNames = Object.keys(jsonData[0] || {});

  // Preview rows
  const previewRows = jsonData.slice(0, 5) as Record<string, any>[];

  // Infer schema from typed values (Excel gives us real types)
  const schema = generateJsonSchemaFromTyped(fieldNames, jsonData);

  return {
    name: filename.replace(/\.[^.]+$/, ''),
    fileType: 'Excel',
    encoding: 'UTF-8',  // Excel is always binary, encoding not applicable
    hasHeaders: true,  // SheetJS assumes first row is headers by default
    jsonSchema: schema,
    filePattern: inferFilePattern(filename),
    previewRows,
    totalRowCount: jsonData.length,
    fieldNames,
    fieldTypes: {},
    fieldConstraints: {},
  };
}
```

### XML Analysis with DOMParser + Ant Design Tree
```typescript
// Browser DOMParser API
function analyzeXml(text: string, filename: string, encoding: string): ImportData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('Invalid XML: ' + parseError.textContent);

  const root = doc.documentElement;
  const records = Array.from(root.children);

  // For flat record-based XML, infer from first record's children
  const sampleRecord = records[0];
  const fieldNames = Array.from(sampleRecord?.children || []).map(el => el.tagName);

  // Build preview data
  const previewRows = records.slice(0, 5).map(record => {
    const obj: Record<string, any> = {};
    Array.from(record.children).forEach(el => {
      obj[el.tagName] = el.textContent || '';
    });
    return obj;
  });

  // Build Ant Design Tree data for XML preview (D-11)
  // This is separate from the flat schema -- it shows the XML structure
  const treeData = buildXmlTreeData(root);

  return { /* ... */ };
}

// Convert XML DOM to Ant Design TreeDataNode format
function buildXmlTreeData(element: Element): any {
  const node: any = {
    title: element.tagName,
    key: element.tagName + '_' + Math.random(),
    children: [],
  };

  if (element.children.length === 0) {
    node.title = `${element.tagName}: ${element.textContent}`;
    node.isLeaf = true;
  } else {
    node.children = Array.from(element.children).map(buildXmlTreeData);
  }

  return node;
}
```

### Backend CsvToJsonConverter Fix (IMPORT-06)
```csharp
// src/Services/Shared/Converters/CsvToJsonConverter.cs
// Fix: read HasHeader and SchemaPropertyNames from metadata
public Task<string> ConvertToJsonAsync(
    Stream sourceStream,
    Dictionary<string, object>? metadata = null,
    CancellationToken cancellationToken = default)
{
    try
    {
        // Read header config from metadata (IMPORT-06)
        var hasHeader = true;
        if (metadata?.TryGetValue("HasHeader", out var hasHeaderObj) == true)
        {
            hasHeader = Convert.ToBoolean(hasHeaderObj);
        }

        // Read schema property names for headerless CSV
        string[]? schemaPropertyNames = null;
        if (!hasHeader && metadata?.TryGetValue("SchemaPropertyNames", out var namesObj) == true)
        {
            schemaPropertyNames = namesObj as string[]
                ?? (namesObj as System.Text.Json.JsonElement?)?.EnumerateArray()
                    .Select(e => e.GetString() ?? "")
                    .ToArray();
        }

        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = hasHeader,
            MissingFieldFound = null,
            BadDataFound = null
        };

        using var reader = new StreamReader(sourceStream);
        using var csv = new CsvReader(reader, config);

        if (hasHeader)
        {
            // Existing behavior: use header row as field names
            var records = csv.GetRecords<dynamic>().ToList();
            var converted = records.Select(r => ConvertTypes((IDictionary<string, object>)r)).ToList();
            return Task.FromResult(JsonSerializer.Serialize(converted));
        }
        else
        {
            // IMPORT-06: headerless CSV -- use schema property names by position
            var records = new List<Dictionary<string, object>>();
            csv.Read(); // Read first record
            while (csv.Read() || records.Count == 0)
            {
                var record = new Dictionary<string, object>();
                for (var i = 0; i < csv.Parser.Count; i++)
                {
                    var fieldName = (schemaPropertyNames != null && i < schemaPropertyNames.Length)
                        ? schemaPropertyNames[i]
                        : $"Column{i + 1}";
                    record[fieldName] = csv.GetField(i) ?? "";
                }
                records.Add(ConvertTypes(record));

                if (records.Count == 0) break; // First Read() was the data
            }

            // Re-read to capture all records properly
            // (simplified; actual impl needs stream reset and proper loop)
            return Task.FromResult(JsonSerializer.Serialize(records));
        }
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error converting CSV to JSON");
        throw;
    }
}
```

**Note on IMPORT-06 implementation:** The actual fix needs careful handling of CsvHelper's reader state. The key changes are:
1. Read `HasHeader` from `metadata` parameter (currently ignored)
2. Set `CsvConfiguration.HasHeaderRecord` based on metadata
3. When headerless, read `SchemaPropertyNames` from metadata and map columns by position
4. The caller (FileDiscoveredEventConsumer) needs to pass datasource config (HasHeaders, JsonSchema property names) as metadata

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side file parsing | Client-side with PapaParse/SheetJS | Ongoing | Privacy, no upload needed, instant preview |
| Character encoding guessing | jschardet with BOM detection | Stable | Reliable for Hebrew (Windows-1255, ISO-8859-8) |
| zip-only archive support | libarchive.js WASM multi-format | 2023+ | Single library handles .zip, .tar.gz, .rar, .7z |
| Manual schema definition | Auto-inference from sample data | This phase | Reduces form fill time from minutes to seconds |

**Deprecated/outdated:**
- `react-papaparse`: Wrapper adding unnecessary React abstractions over PapaParse. Use PapaParse directly.
- `encoding.js`: Large polyfill; jschardet is smaller and detection-focused.
- Node.js `archiver`/`unzipper`: Server-side only, not browser-compatible.

## Open Questions

1. **libarchive.js WASM file hosting in Vite**
   - What we know: libarchive.js needs its WASM file and worker script accessible at runtime
   - What's unclear: Exact Vite configuration to copy WASM to public directory or bundle correctly
   - Recommendation: Test during implementation; may need `vite.config.ts` adjustment to copy assets

2. **Encrypted archive format support beyond .zip**
   - What we know: libarchive.js documentation says "Only encrypted zip is supported"
   - What's unclear: Whether encrypted .7z or .rar work in practice (documentation is vague)
   - Recommendation: Support encrypted .zip as primary. For encrypted .rar/.7z, show error message asking user to extract manually.

3. **Date format detection in type inference**
   - What we know: Common formats include ISO 8601, DD/MM/YYYY, MM/DD/YYYY
   - What's unclear: How to reliably distinguish DD/MM/YYYY from MM/DD/YYYY
   - Recommendation: Detect ISO 8601 (`YYYY-MM-DD`) with HIGH confidence. For ambiguous formats, default to `string` type with `format: "date"` suggestion at MEDIUM confidence. Don't try to distinguish DD/MM vs MM/DD.

4. **File size limit enforcement**
   - What we know: Client-side parsing is practical up to ~50MB but slows down
   - What's unclear: What's the right UX for oversized files
   - Recommendation: Set 10MB soft limit with warning. Set 50MB hard limit with error. Use `beforeUpload` callback on Ant Design Upload to enforce.

## Environment Availability

> No external dependencies needed beyond npm packages (all browser-side libraries).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js/npm | Package installation | Yes | (existing) | -- |
| Vite | Build pipeline | Yes | 5.4.21 | -- |
| CsvHelper (.NET) | IMPORT-06 backend fix | Yes | (existing in project) | -- |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None -- all new libraries are npm packages installed client-side.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.49.0 |
| Config file | `src/Frontend/playwright.config.ts` |
| Quick run command | `cd src/Frontend && npx playwright test --grep "import" --headed` |
| Full suite command | `cd src/Frontend && npx playwright test --headed` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMPORT-01 | Upload CSV/JSON/XML triggers client-side parse | E2E | `npx playwright test tests/e2e/import-from-file.spec.ts -x --headed` | Wave 0 |
| IMPORT-02 | Schema inference produces correct types | unit | `npx playwright test tests/e2e/import-schema-inference.spec.ts -x --headed` | Wave 0 |
| IMPORT-03 | Headerless CSV produces field_1, field_2 names | E2E | `npx playwright test tests/e2e/import-from-file.spec.ts --grep "headerless" -x --headed` | Wave 0 |
| IMPORT-04 | Smart constraints applied via schemaAutoSuggest | unit | Test within schema inference spec | Wave 0 |
| IMPORT-05 | Preview table shows 5 rows, schema editable | E2E | `npx playwright test tests/e2e/import-from-file.spec.ts --grep "preview" -x --headed` | Wave 0 |
| IMPORT-06 | CsvToJsonConverter headerless fix | integration | `cd src/Services/Shared.Tests && dotnet test --filter "CsvToJsonConverter"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test tests/e2e/import-from-file.spec.ts --headed`
- **Per wave merge:** `npx playwright test --headed`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/Frontend/tests/e2e/import-from-file.spec.ts` -- covers IMPORT-01, IMPORT-03, IMPORT-05
- [ ] `src/Frontend/tests/e2e/import-schema-inference.spec.ts` -- covers IMPORT-02, IMPORT-04
- [ ] Backend test for CsvToJsonConverter headerless fix -- covers IMPORT-06
- [ ] webapp-testing comprehensive script for import flow

## Sources

### Primary (HIGH confidence)
- [PapaParse docs](https://www.papaparse.com/docs) - Config options: delimiter auto-detect, header, preview, dynamicTyping, encoding
- [SheetJS docs](https://docs.sheetjs.com/) - Browser parsing, sheet_to_json, cell types, raw mode
- [JSZip API docs](https://stuk.github.io/jszip/documentation/api_jszip/load_async.html) - loadAsync, encrypted zip NOT supported
- [JSZip limitations](https://stuk.github.io/jszip/documentation/limitations.html) - Confirmed no password support
- [libarchive.js GitHub](https://github.com/nika-begiashvili/libarchivejs) - WASM archive extraction, format support, WebWorker usage
- [jschardet GitHub](https://github.com/aadsm/jschardet) - Hebrew encoding support (Windows-1255, ISO-8859-8)
- Codebase: `src/Services/Shared/Converters/CsvToJsonConverter.cs` - HasHeaderRecord hardcoded true, metadata ignored
- Codebase: `src/Frontend/src/utils/schemaAutoSuggest.ts` - suggestConstraintsForField(), applySuggestionsToSchema() ready
- Codebase: `src/Frontend/src/pages/datasources/DataSourceFormEnhanced.tsx` - cloneData pattern at line 31, useEffect at line 130

### Secondary (MEDIUM confidence)
- [JSZip issue #115](https://github.com/Stuk/jszip/issues/115) - Password support never implemented (2014-present)
- npm registry version checks: papaparse 5.5.3, xlsx 0.18.5, jschardet 3.1.4, jszip 3.10.1, libarchive.js 2.0.2

### Tertiary (LOW confidence)
- libarchive.js encrypted format support beyond .zip - documentation states "only encrypted zip supported" but practical testing may differ for .7z/.rar

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are well-established, verified on npm, API documented
- Architecture: HIGH - Follows existing project patterns (location.state, lazy tabs, schemaAutoSuggest)
- Pitfalls: HIGH - Based on documented limitations (JSZip encryption, Ant Design lazy tabs) and codebase analysis (CsvToJsonConverter hardcoded header)
- Backend fix (IMPORT-06): HIGH - Direct codebase inspection confirms bug and fix approach

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable libraries, 30-day window)
