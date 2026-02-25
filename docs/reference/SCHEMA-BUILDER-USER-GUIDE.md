---
last-verified: 2026-02-02
status: current
---
# Schema Builder User Guide

## Overview
The Schema Builder provides two ways to create and edit JSON Schema 2020-12 documents:
1. **Visual Editor** - Form-based field definitions (no hierarchy)
2. **JSON Editor** - Direct JSON editing with tree and text modes

---

## 1. How Visual Editing Works

### Flat Field Structure
The Visual Editor is designed for **flat schema definitions** - it manages only top-level fields without nested hierarchies. Each field you add becomes a property in the schema's `properties` object.

### Workflow:
1. **Add Field** → Click "הוסף שדה חדש" button
2. **Configure Field** → Fill in the modal form:
   - Field name (English): `transaction_id`
   - Display name (Hebrew): `מזהה עסקה`
   - Field type: string, number, integer, boolean, array, object, null
   - Required: Yes/No toggle
   - Validation rules (based on type):
     - **String**: minLength, maxLength, pattern (regex), format, enum
     - **Number/Integer**: minimum, maximum, multipleOf, exclusive ranges
     - **Array**: minItems, maxItems, uniqueItems
   - Additional: defaultValue, examples
3. **Save** → Field is added to the fields list
4. **Auto-sync** → JSON Schema is automatically generated

### Example:
When you add a string field named `email` with:
- Type: string
- Format: email
- Required: true

The Visual Editor generates:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "email": {
      "type": "string",
      "format": "email"
    }
  },
  "required": ["email"]
}
```

---

## 2. JSON Editor Features

### Two Editing Modes:

#### Tree Mode (עץ)
- Hierarchical view of JSON structure
- Click to expand/collapse nodes
- Visual representation of objects and arrays
- Good for understanding structure

#### Text Mode (קוד)
- Raw JSON text editor
- **Syntax highlighting** ✅ Built-in by vanilla-jsoneditor
- Line numbers
- Code folding
- Better for bulk editing

### Helper Buttons:

#### העתק (Copy)
- Copies entire JSON Schema to clipboard
- Works with current editor content

#### עצב (Format)
- **How it works**: 
  1. Gets current content from editor instance (`jsonEditorInstance.get()`)
  2. Parses and re-formats with proper indentation (2 spaces)
  3. Updates both state and editor display
  4. Shows success message
- **When to use**: After manual edits to clean up formatting

#### אמת (Validate)
- **How it works**:
  1. Gets current content from editor instance
  2. Attempts to parse as JSON
  3. Shows success if valid, error message with details if invalid
- **When to use**: To check JSON syntax before saving

---

## 3. Left-Justified JSON Display

### Implementation
Custom CSS (`SchemaBuilder.css`) forces left-to-right (LTR) direction for JSON content:

```css
.json-editor-container {
  direction: ltr !important;
  text-align: left !important;
}

.jse-text-mode,
.jse-tree-mode {
  direction: ltr !important;
  text-align: left !important;
}
```

This ensures JSON code is always displayed left-aligned, regardless of the page's RTL (right-to-left) Hebrew setting.

---

## 4. Synchronization Between Tabs

### Visual Editor → JSON Editor

When you work in the Visual Editor:

1. **Add/Edit/Delete Field** → `setFields(newFieldsArray)`
2. **useEffect Hook Triggers** → Watches `fields` state
3. **Generate JSON** → `generateJsonSchema()` function runs
4. **Update State** → `setJsonSchema(generatedJson)`
5. **JSON Editor Updates** → If active, editor content refreshes automatically

**Code Flow:**
```typescript
// Visual Editor changes fields
setFields([...fields, newField]);

// useEffect watches fields and regenerates JSON
useEffect(() => {
  const json = generateJsonSchema();
  setJsonSchema(json);  // Updates shared state
}, [fields, schemaName, schemaDisplayName, schemaDescription]);

// JSON Editor listens to jsonSchema state
useEffect(() => {
  if (jsonEditorInstance && jsonSchema) {
    jsonEditorInstance.set({ json: JSON.parse(jsonSchema) });
  }
}, [jsonSchema]);
```

### JSON Editor → Visual Editor

**Important**: Synchronization is **ONE-WAY** only.

- Changes in JSON Editor do **NOT** update the Visual Editor
- The Visual Editor is for **flat fields only** (no nested objects)
- If you edit JSON directly and add nested structures, the Visual Editor cannot represent them
- The `fields` array is only updated when:
  1. You manually add/edit fields in Visual Editor
  2. Loading an existing schema from backend (initial load only)

### Why One-Way Sync?

The Visual Editor is designed for simple, flat schema definitions. Complex JSON with:
- Nested objects
- Conditional schemas (`anyOf`, `oneOf`)
- Referenced definitions (`$ref`)
- Custom keywords

...cannot be represented in the simple form-based Visual Editor.

**Recommendation**: 
- Use Visual Editor for initial flat schema design
- Switch to JSON Editor for advanced features
- Once you manually edit JSON, continue in JSON Editor

---

## 5. Syntax Highlighting

### Built-In Feature ✅

vanilla-jsoneditor provides **automatic syntax highlighting** in both modes:

#### Text Mode:
- Keywords: blue (`"type"`, `"properties"`, etc.)
- Strings: green
- Numbers: orange
- Booleans: purple
- Brackets/Braces: gray

#### Tree Mode:
- Different colors for keys vs values
- Icons for data types (object, array, string, etc.)
- Visual indentation

**No additional configuration needed** - it works out of the box!

---

## 6. Three Editor Instances

The SchemaBuilder uses **three separate vanilla-jsoneditor instances**:

### 1. Main JSON Editor (Tab: עורך JSON)
- **Purpose**: Editable JSON Schema editor
- **Modes**: Tree, Text
- **Features**: Full menu bar, navigation, status bar
- **onChange**: Updates `jsonSchema` state in real-time

### 2. Preview Pane (Side panel)
- **Purpose**: Read-only preview of generated schema
- **Visibility**: Toggle with "הצג JSON" / "הסתר JSON" button (on Visual Editor tab)
- **Mode**: Text only
- **Real-time**: Updates when fields change in Visual Editor

### 3. Validation Tab Editor (Tab: אימות)
- **Purpose**: Enter test data to validate against schema
- **Status**: Container ready (initialization pending)
- **Future**: Will validate test JSON against your schema

---

## Summary Table

| Feature | Status | Notes |
|---------|--------|-------|
| Table Mode | ❌ Removed | Only Tree and Text modes |
| Format Button | ✅ Working | Gets content from editor, reformats, updates display |
| Validate Button | ✅ Working | Parses JSON, shows errors if invalid |
| Syntax Highlighting | ✅ Built-in | Works automatically in both modes |
| Left-Justified JSON | ✅ Working | Custom CSS forces LTR |
| Visual → JSON Sync | ✅ One-way | Fields changes update JSON |
| JSON → Visual Sync | ❌ Not supported | Visual Editor is flat-only |

---

## Best Practices

1. **Start with Visual Editor** for simple, flat schemas
2. **Switch to JSON Editor** when you need:
   - Nested objects
   - Advanced validation rules
   - Conditional schemas
   - Referenced definitions
3. **Use Tree Mode** to understand structure
4. **Use Text Mode** for bulk editing
5. **Click עצב** after manual edits to clean formatting
6. **Click אמת** before saving to catch syntax errors
7. **Enable Preview Pane** (הצג JSON) while working in Visual Editor to see real-time JSON

---

## Technical Details

### State Management
- `fields`: Array of field definitions (Visual Editor)
- `jsonSchema`: String containing JSON Schema (shared state)
- `jsonEditorInstance`: Reference to main editor
- `previewEditorInstance`: Reference to preview pane
- `activeTab`: Current tab ('visual' | 'json' | 'validation')

### Key Functions
- `generateJsonSchema()`: Converts fields array to JSON Schema
- `handleModeChange()`: Switches between tree/text modes
- `formatJsonSchema()`: Pretty-prints JSON with indentation
- `validateJsonSyntax()`: Checks JSON validity

### Lifecycle
Each editor instance is created in a useEffect hook and destroyed on unmount to prevent memory leaks.
