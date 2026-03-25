# Phase 27: Import from File - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Add "Create Datasource from File" capability — users upload a sample data file (CSV, JSON, XML, or archive) and the system auto-fills the entire datasource create form with maximum extracted information: file type, encoding, delimiter, headers, schema with types and smart constraints, file name pattern, and archive settings. Includes a two-step wizard with preview modal before the form opens pre-filled. Also includes backend CsvToJsonConverter fix for headerless CSV. Requirements: IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06.

</domain>

<decisions>
## Implementation Decisions

### Trigger & Entry Point
- **D-01:** "Create from File" button on the datasource list page, placed **next to** the existing "Create Datasource" button. Two buttons: `[+ Create Datasource]` `[Upload File]`
- **D-02:** Clicking the button opens an upload dialog (Ant Design Upload or Dragger). Accepted formats: `.csv`, `.json`, `.xml`, `.xlsx`, `.zip`, `.tar.gz`, `.rar`, `.7z`

### Two-Step Wizard Flow
- **D-03:** Step 1: Upload file → client-side analysis → preview modal showing all extracted info
- **D-04:** Step 2: User reviews extraction results in modal → clicks "Continue" → navigates to `/datasources/new` with `location.state = { importData: extractedData }` → form opens pre-filled
- **D-05:** The existing `DataSourceFormEnhanced` reads `location.state.importData` the same way it reads `location.state.cloneData` (Phase 25 pattern)

### Maximize Extraction (from file analysis)
- **D-06:** Extract and auto-fill ALL of the following from the uploaded file:
  - **File type** — detected from extension and content (CSV, JSON, XML, Excel)
  - **Encoding** — detected from BOM or content analysis (UTF-8, Windows-1255, ISO-8859-8, UTF-16)
  - **CSV delimiter** — auto-detected from content (comma, semicolon, tab, pipe)
  - **Has headers** — auto-detected (first row vs data rows type comparison)
  - **JSON Schema** — inferred from data with full type detection (string, integer, number, boolean, date)
  - **Smart constraints** — via `schemaAutoSuggest.ts` (email, phone, date, age, price patterns)
  - **File name pattern** — derived from filename (e.g., `sales_2026.csv` -> `sales_*.csv`)
  - **Datasource name** — suggested from filename (e.g., `sales_2026.csv` -> "sales_2026")
  - **Archive settings** — type, password (if encrypted), extraction pattern
- **D-07:** The completeness sidebar (Phase 26) shows real-time what was auto-filled (green) vs what's still missing (red). This is the user's guide for what to complete manually.

### Preview Modal (Step 1 Result)
- **D-08:** Preview modal is **read-only** — shows extraction results as a checklist with types + auto-suggest constraints visible. No editing in the modal except for headerless CSV field names (D-12).
- **D-09:** Show **5 rows** of parsed data in a preview table. Footer shows total row count.
- **D-10:** Extraction checklist shows each field with detected type AND auto-suggested constraint:
  ```
  name    : string (minLength: 2)
  age     : integer (0-120 range)
  email   : string (email format)
  phone   : string (Israeli phone pattern)
  price   : number (min: 0)
  active  : boolean
  ```
- **D-11:** XML preview uses a **tree view** (collapsible), not a flat table. XML preserves its natural nested structure in the preview.

### Headerless CSV Special Case
- **D-12:** Auto-detect whether first row is headers (compare first row types vs subsequent rows). Show a toggle: "First row is headers: [Yes/No]" that user can override.
- **D-13:** When headerless CSV detected (or user toggles to No): show **editable field name inputs** above the data rows in the preview. User types column names (e.g., "name", "age", "email") with 1-2 data rows visible below for reference.
- **D-14:** User-provided field names become the schema property names and are synced to `hasHeaders: false` in the File Settings tab.
- **D-15:** CSV without headers produces field names from user input in preview, NOT synthetic `field_1, field_2` (unless user leaves them blank, in which case fallback to `field_1, field_2`).

### Archive File Handling
- **D-16:** If user uploads an archive file (.zip, .tar.gz, .rar, .7z):
  - System lists the files inside the archive
  - If archive is encrypted: prompt user for password, test it works, then proceed
  - If multiple data files inside: let user select which file to analyze (don't auto-pick first)
  - If single data file: auto-select it
  - Extract the selected file and continue analysis as if it were uploaded directly
- **D-17:** Archive password (if provided) is auto-filled into the archive settings section of the Connection tab
- **D-18:** Archive type, extraction pattern auto-filled from the archive analysis
- **D-19:** Client-side archive extraction using JSZip (for .zip) or similar libraries. For .tar.gz/.rar/.7z — evaluate available browser-side libraries during research.

### Sync All Extracted Info to Form
- **D-20:** ALL extracted information is pushed to the relevant form fields via `location.state.importData`:
  - `fileType` -> File Settings tab
  - `encoding` -> File Settings tab
  - `csvDelimiter` -> File Settings tab
  - `hasHeaders` -> File Settings tab
  - `jsonSchema` -> Schema tab (via `setJsonSchema`)
  - `filePattern` -> Connection tab (suggested, user can change)
  - `name` -> Basic Info tab (suggested from filename)
  - `isArchiveSource` -> Connection tab
  - `archiveType` -> Connection tab
  - `archivePassword` -> Connection tab
  - `extractionPattern` -> Connection tab

### Backend Fix (IMPORT-06)
- **D-21:** Fix `CsvToJsonConverter` in `src/Services/FileProcessorService/` to use JSON Schema property names (by position order) instead of generic `Column1, Column2...` when processing headerless CSV files. The schema's property order defines the mapping: 1st property = 1st column, 2nd = 2nd, etc.

### Claude's Discretion
- File size limit for client-side parsing (recommend 10MB)
- Upload progress indicator styling
- Preview modal width and layout
- Error handling for malformed/corrupt files
- Encoding detection library choice
- Tree view component for XML preview
- File name pattern inference algorithm
- Auto-suggest confidence threshold

</decisions>

<specifics>
## Specific Ideas

- The "Create from File" flow should feel like magic — upload a file and the form is almost done
- The preview modal should give confidence that the system "understood" the file correctly
- Headerless CSV is the tricky case — the editable field names with data rows below makes it intuitive
- Archive handling with password testing gives a complete end-to-end story
- The completeness sidebar from Phase 26 naturally complements this feature — user sees instantly what was auto-filled and what's left

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Codebase References
- `src/Frontend/src/pages/datasources/DataSourceList.tsx` — "Create from File" button placement
- `src/Frontend/src/pages/datasources/DataSourceFormEnhanced.tsx` — `location.state.importData` handling (same pattern as cloneData)
- `src/Frontend/src/components/datasource/tabs/SchemaTab.tsx` — Schema editor integration
- `src/Frontend/src/utils/schemaAutoSuggest.ts` — Smart constraint detection (IMPORT-04)
- `src/Frontend/src/utils/schemaValidator.ts` — Schema validation
- `src/Frontend/src/utils/schemaExampleGenerator.ts` — Example data generation
- `src/Frontend/src/components/datasource/completeness/` — Completeness sidebar (Phase 26)
- `src/Services/FileProcessorService/Converters/CsvToJsonConverter.cs` — Backend headerless CSV fix (IMPORT-06)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `schemaAutoSuggest.ts`: `suggestConstraintsForField()`, `applySuggestionsToSchema()` — ready for IMPORT-04
- `schemaValidator.ts`: AJV instance for validating inferred schema before applying
- `schemaExampleGenerator.ts`: Can validate inferred schema produces realistic examples
- Phase 25 `location.state` pattern: Clone uses `location.state.cloneData` — import uses `location.state.importData`
- Phase 26 completeness sidebar: Shows auto-filled fields (green) vs missing (red) immediately

### New Dependencies Needed
- **PapaParse** — CSV parsing with delimiter detection, header detection, encoding support
- **JSZip** — .zip archive extraction in browser
- Additional archive libraries TBD during research (.tar.gz, .rar, .7z browser support)
- Encoding detection library (e.g., `jschardet` or `chardet`)

### Established Patterns
- `form.setFieldsValue()` with `savedFieldValues` prop for lazy-loaded tab values
- `setJsonSchema()` callback for schema injection
- `navigate('/datasources/new', { state: { importData } })` for form pre-fill
- Ant Design `Upload`/`Dragger` component (not yet used in project — first usage)
- Ant Design `Modal` for preview step
- Ant Design `Tree` component for XML preview

### Integration Points
- List page: add "Create from File" button next to existing "Create Datasource"
- DataSourceFormEnhanced: read `location.state.importData` on mount (alongside cloneData)
- SchemaTab: no changes needed — schema is set via parent's `setJsonSchema()`
- File Settings tab: auto-filled from import data
- Connection tab: archive settings auto-filled

</code_context>

<deferred>
## Deferred Ideas

- Import from URL (fetch a remote file and analyze it) — future capability
- Batch import (upload multiple files, create multiple datasources) — future capability
- Re-import (update existing datasource schema from a new file version) — future capability
- Server-side file analysis (for files too large for client-side parsing) — future capability

</deferred>

---

*Phase: 27-import-from-file*
*Context gathered: 2026-03-25*
