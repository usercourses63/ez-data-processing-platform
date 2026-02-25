---
last-verified: 2026-02-02
status: current
---
# Documentation Generator - Complete Specification

**Feature:** Schema Documentation Auto-Generation  
**Status:** Not Yet Implemented (0% complete)  
**Priority:** MEDIUM - Phase 2  
**Effort:** 2 weeks (1 developer)  
**Target Release:** Post-Launch Enhancement

---

## Overview

The **Documentation Generator** is a feature that automatically creates professional, human-readable documentation from JSON Schemas. It transforms technical JSON Schema syntax into formatted documentation in multiple formats (Markdown, HTML, PDF) with full bilingual support (Hebrew/English).

**Think of it as:** "Auto-generating a user manual for your data schema"

---

## What Problem Does It Solve?

### Current State (Without Documentation Generator)
Users need to:
- Understand raw JSON Schema syntax
- Extract field information manually
- Create their own documentation
- Maintain documentation separately from schema
- Translations are manual and inconsistent

### Future State (With Documentation Generator)
- ✅ Documentation auto-generates from schema
- ✅ Multiple export formats (MD, HTML, PDF)
- ✅ Dual language support built-in
- ✅ Always up-to-date (generated from live schema)
- ✅ Professional appearance for stakeholders
- ✅ Shareable documentation with non-technical users

---

## Core Features Included

### 1. Automatic Schema Documentation

Generates comprehensive documentation that includes:

**Section 1: Metadata**
- Schema name and display name (both languages)
- Description and purpose
- Version number
- Status (Draft/Active/Inactive/Archived)
- Creation date and last updated date
- Associated data source name
- Creator/Owner information

**Section 2: Field Catalog**
For each field in the schema:
- Field name and display name
- Data type (with simple explanations)
- Required vs. optional indicator
- Description with examples
- All validation rules explained in plain language
- Valid value examples
- Invalid value examples (what NOT to do)
- Default values
- Any special notes or warnings

**Section 3: Validation Rules Explained**

Instead of cryptic JSON Schema syntax:
```json
{
  "pattern": "^05[0-9]{8}$",
  "minLength": 10,
  "maxLength": 10
}
```

Documentation explains:
```markdown
### Pattern: Israeli Mobile Phone Number
This field must contain exactly 10 digits starting with 05.
Examples:
✓ 0501234567
✓ 0521234567
✗ 0501234 (too short)
✗ 0341234567 (invalid prefix)
```

**Section 4: Complete Example Data**

Includes a full, valid example of JSON that passes the schema validation:
```json
{
  "customer_id": "CUST12345678",
  "name": "יוסי כהן",
  "phone": "0501234567",
  "email": "yossi@example.co.il",
  "created_at": "2025-10-01T10:30:00Z"
}
```

**Section 5: Validation Statistics**
- How many data sources use this schema
- Total records processed
- Validation success rate (%)
- Most common validation errors with explanations
- Average validation time

**Section 6: Version History**
- Complete change log
- What changed in each version
- Migration notes for data upgrades
- Breaking vs. non-breaking changes

**Section 7: Common Issues**
- Frequently encountered validation errors
- Troubleshooting tips
- How to fix invalid data
- Best practices for data entry

---

### 2. Export Formats

#### **Markdown (.md)**
**Best for:** Developers, Git repositories, technical documentation

**Features:**
- Clean text-based format
- Easy version control in Git
- Searchable
- Can be converted to other formats
- Code block support for examples
- Table support for field specifications

**Output example:**
```markdown
# Schema: sales_transaction

## Overview
This schema validates...

## Fields

### field_name
- **Type:** string
- **Required:** Yes
- **Description:** ...

## Validation Rules
...

## Examples
```json
{...}
```
```

---

#### **HTML (.html)**
**Best for:** Web portals, sharing with non-technical users, interactive viewing

**Features:**
- Professional styling with CSS
- Interactive navigation (table of contents with links)
- Search functionality (if hosted)
- Responsive design (mobile-friendly)
- Customizable branding (company logo, colors)
- Print-friendly layout
- Collapsible sections for complex details

**Visual elements:**
- Color-coded field types
- Status badges (required/optional, Draft/Active)
- Icons for different validation types
- Highlighted examples with syntax coloring
- Side-by-side comparison of valid vs. invalid data

---

#### **PDF (.pdf)**
**Best for:** Sharing with stakeholders, archiving, printing, formal documentation

**Features:**
- Professional print layout
- Table of contents with page numbers
- Page breaks between major sections
- Headers and footers with schema name/version
- Embedded fonts for Hebrew support
- High-resolution rendering
- Can be password-protected (optional)
- Optimized file size

**Generated using:** PuppeteerSharp or iText7

---

#### **JSON (.json)**
**Best for:** System integration, documentation portals, API specs

**Structured data format containing:**
```json
{
  "schema": {
    "id": "...",
    "name": "...",
    "displayName": "...",
    "description": "...",
    "version": "...",
    "fields": [
      {
        "name": "...",
        "type": "...",
        "required": true,
        "description": "...",
        "validationRules": [...],
        "examples": {...}
      }
    ],
    "statistics": {...},
    "versionHistory": [...]
  }
}
```

---

### 3. Bilingual Support

All documentation generated in **both Hebrew and English** simultaneously:

**Template approach:**
```markdown
# Schema: sales_transaction / עסקאות מכירה

## Description / תיאור
English description / תיאור בעברית

## Fields / שדות

### field_name / שם_שדה
- **Type / סוג:** string / מחרוזת
- **Required / חובה:** Yes / כן
- **Description / תיאור:** English text / טקסט בעברית
```

**Language selection:**
- Generate both languages (bilingual document)
- Generate Hebrew only
- Generate English only

**Hebrew-specific considerations:**
- RTL text alignment in HTML/PDF
- Hebrew error messages
- Israeli phone/ID format examples
- Local currency and units
- Date format preferences (HE vs. US)

---

### 4. Advanced Features

#### **Field Type Explanations**
For non-technical users, explains complex types:

Instead of: `"type": "object"`  
Explanation:
```
Object: A container that holds related data items (like a record in a database).
Example: An address object contains street, city, postal_code fields.
```

#### **Enum Value Explanations**
```json
"enum": ["active", "inactive", "archived"]
```

Becomes:
```
**Status Options:**
- active / פעיל: The schema is currently in use
- inactive / לא פעיל: The schema is temporarily disabled
- archived / בארכיון: The schema is no longer used
```

#### **Format Descriptions**
Explains special formats in plain language:
```
date-time: ISO 8601 format (Example: 2025-10-16T13:00:00Z)
email: Valid email address (Example: user@example.com)
uri: Web address/URL (Example: https://example.com)
```

#### **Custom Notes**
Optional notes added by schema creator:
```
⚠️ Warning: This field requires special handling in legacy systems
ℹ️ Note: Values are case-sensitive
💡 Tip: Use lowercase for consistency
```

---

### 5. Visual Elements

**In HTML/PDF:**
- Color-coded badges:
  - 🟢 Green for Required fields
  - 🟡 Yellow for Optional fields
  - 🔵 Blue for Draft schemas
  - 🟢 Green for Active schemas

- Icons:
  - `✓` for valid examples
  - `✗` for invalid examples
  - ⚠️ for warnings
  - ℹ️ for information

- Tables:
  - Field specification table (name, type, required, description)
  - Validation rules table
  - Version history table

- Code blocks:
  - JSON examples with syntax highlighting
  - Regex patterns with explanations

---

## Technical Implementation

### Backend Service

**New service:** `SchemaDocumentationService`

```csharp
public interface ISchemaDocumentationService
{
    Task<DocumentationGenerationResult> GenerateMarkdownAsync(string schemaId);
    Task<DocumentationGenerationResult> GenerateHtmlAsync(string schemaId);
    Task<DocumentationGenerationResult> GeneratePdfAsync(string schemaId);
    Task<DocumentationGenerationResult> GenerateJsonAsync(string schemaId);
    Task<DocumentationGenerationResult> GenerateBilingualAsync(
        string schemaId, 
        DocumentationFormat format,
        Language[] languages);
}

public class DocumentationGenerationResult
{
    public bool IsSuccess { get; set; }
    public byte[] FileContent { get; set; }
    public string FileName { get; set; }
    public string ContentType { get; set; }
    public DateTime GeneratedAt { get; set; }
    public string Error { get; set; }
}
```

### API Endpoints

```
POST /api/v1/schema/{id}/generate-documentation
POST /api/v1/schema/{id}/generate-documentation/markdown
POST /api/v1/schema/{id}/generate-documentation/html
POST /api/v1/schema/{id}/generate-documentation/pdf
POST /api/v1/schema/{id}/generate-documentation/preview
```

### Request Format

```json
{
  "format": "markdown|html|pdf|json",
  "language": "hebrew|english|both",
  "includeExamples": true,
  "includeStatistics": true,
  "includeVersionHistory": true,
  "includeCommonIssues": true,
  "customBranding": {
    "companyName": "EZ Data Processing",
    "logoUrl": "...",
    "primaryColor": "#1890ff"
  }
}
```

### Response Format

```json
{
  "isSuccess": true,
  "data": {
    "downloadUrl": "/api/v1/schema/123/documentation/download",
    "fileName": "sales_transaction_documentation_2025-10-16.pdf",
    "contentType": "application/pdf",
    "fileSize": 245632,
    "generatedAt": "2025-10-16T13:00:00Z",
    "generationTimeMs": 1250
  }
}
```

### Frontend UI

**Component: SchemaDocumentationGenerator**

```tsx
interface DocumentationGeneratorProps {
  schemaId: string;
  schemaName: string;
}

// Features:
// - Format selector (Markdown, HTML, PDF, JSON)
// - Language selector (Hebrew, English, Both)
// - Options checkboxes (examples, statistics, etc.)
// - Preview pane
// - Download button
// - Generate button with progress indicator
```

**Location:** Schema detail page → "Generate Documentation" button

**Workflow:**
1. User clicks "Generate Documentation"
2. Modal opens with options
3. User selects format, language, options
4. Preview generates and displays
5. User downloads generated file
6. Backend generates and serves file

---

## Dependencies Required

**NuGet Packages:**
```xml
<!-- PDF Generation -->
<PackageReference Include="PuppeteerSharp" Version="12.0.0" />
<!-- Or alternative: -->
<PackageReference Include="iTextSharp" Version="5.5.13.3" />

<!-- HTML rendering -->
<PackageReference Include="HtmlRenderer.Core" Version="1.3.0" />

<!-- Markdown generation -->
<PackageReference Include="Markdig" Version="0.32.0" />

<!-- Template rendering -->
<PackageReference Include="Scriban" Version="5.4.0" />
```

---

## Implementation Timeline

### Week 1: Core Infrastructure
**Days 1-2: Backend service setup**
- Create SchemaDocumentationService
- Implement template engine
- Create documentation model classes

**Days 3-4: Markdown generation**
- Parse schema structure
- Generate Markdown templates
- Implement bilingual support

**Days 5: HTML generation**
- Create HTML template with CSS
- Implement responsive design
- Add interactive elements

### Week 2: Export & Frontend
**Days 1-2: PDF generation**
- Integrate PuppeteerSharp
- Generate PDF from HTML
- Test encoding (Hebrew support)

**Days 3-4: Frontend UI**
- Create DocumentationGenerator component
- Add preview functionality
- Implement download button

**Days 5: Testing & refinement**
- End-to-end testing
- Performance optimization
- Hebrew text validation

---

## Success Criteria

- ✅ Markdown generation complete and tested
- ✅ HTML generation with professional styling
- ✅ PDF generation with proper encoding
- ✅ Bilingual support (Hebrew/English) working
- ✅ All schema metadata included
- ✅ Field validation rules properly explained
- ✅ Example data included and valid
- ✅ File download working in UI
- ✅ Large schemas handled efficiently
- ✅ Performance: < 5 seconds for typical schema

---

## Use Cases

### Use Case 1: Onboarding New Developer
**Scenario:** New developer joins team and needs to understand data structure

**Process:**
1. Go to schema detail page
2. Click "Generate Documentation"
3. Download HTML version
4. Share HTML file in team chat
5. New developer has complete reference

**Result:** Faster onboarding, reduced questions

### Use Case 2: Data Governance Compliance
**Scenario:** Need to document all schemas for audit

**Process:**
1. Generate PDF for each schema
2. Include version history and statistics
3. Archive in compliance system
4. Prove data validation rules exist

**Result:** Audit-ready documentation

### Use Case 3: Stakeholder Communication
**Scenario:** Data analyst needs to explain field requirements to business

**Process:**
1. Generate bilingual Markdown documentation
2. Email to stakeholder
3. Non-technical explanation of rules
4. Examples included

**Result:** Stakeholder understands data requirements

### Use Case 4: Integration with External Systems
**Scenario:** API documentation needs schema specifications

**Process:**
1. Generate JSON documentation format
2. Feed into API documentation system
3. Auto-generate API specification
4. Keep in sync with schema changes

**Result:** Automated documentation generation

---

## Benefits

| Benefit | Impact | Users |
|---------|--------|-------|
| **Time Savings** | 2-3 hours per schema (manual to auto) | Developers, Data Team |
| **Consistency** | Same format for all schemas | Org-wide |
| **Up-to-date** | Always reflects current schema | Everyone |
| **Accessibility** | Non-technical users understand rules | Business, Stakeholders |
| **Compliance** | Audit trail of schema specifications | Auditors, Managers |
| **Efficiency** | Reduces documentation backlog | Project Managers |

---

## Estimated Effort Summary

| Task | Days | Total |
|------|------|-------|
| Backend service | 2 | 2 |
| Markdown generation | 2 | 4 |
| HTML generation | 1.5 | 5.5 |
| PDF generation | 2 | 7.5 |
| Frontend UI | 1.5 | 9 |
| Testing & refinement | 1 | 10 |
| **TOTAL** | | **10 days / 2 weeks** |

---

## Post-Launch Enhancements

**Version 1.1 (Future):**
- Custom CSS themes
- Organization logo branding
- Scheduled documentation exports
- Email delivery of documentation
- Change notification emails
- Multi-schema documentation bundles

**Version 1.2 (Future):**
- AI-generated field descriptions
- Automatic example data generation
- Markdown to Confluence sync
- Documentation versioning and archival
- Full-text search in documentation

---

## Summary

The **Documentation Generator** is a valuable enhancement that:
1. Automates documentation creation (saves 2-3 hours per schema)
2. Supports multiple formats (Markdown, HTML, PDF, JSON)
3. Includes bilingual support (Hebrew + English)
4. Explains technical concepts in plain language
5. Keeps documentation always current with schema changes
6. Enables compliance and audit requirements
7. Improves cross-team communication

**Priority:** Medium (Phase 2 enhancement)  
**Timeline:** 2 weeks  
**Value:** High - improves usability and compliance  
**Complexity:** Medium - requires template engines and PDF generation
