---
last-verified: 2026-02-02
status: current
---
# Vanilla JSONEditor Implementation Plan

## Overview
Replace Monaco editor with vanilla-jsoneditor in SchemaBuilder.tsx while preserving the existing Schema Management structure and workflow.

## ✅ What Will Be Preserved
1. **Schema Management Grid** - No changes to SchemaManagementEnhanced.tsx
2. **Data Source Integration** - Status dropdowns, assignments (already fixed)
3. **Navigation** - Back button, templates, create schema flow
4. **Schema Basic Info Card** - Name, display name, version, description inputs
5. **Tabs Structure** - Visual Editor, JSON Editor, Validation tabs
6. **Visual Editor Tab** - Field list, add/edit/delete fields, statistics
7. **Field Configuration Modal** - All field validation rules UI
8. **Regex Helper** - Existing component
9. **Save/Load Logic** - API integration, data persistence

## 🔄 What Will Change

### 1. JSON Editor Tab (Main Change)
**BEFORE:** Monaco Editor with blank screen issues
```typescript
<Editor
  height="500px"
  defaultLanguage="json"
  defaultValue={jsonSchema}
  onChange={(value) => setJsonSchema(value || '')}
  options={...}
/>
```

**AFTER:** vanilla-jsoneditor with tree + text modes
```typescript
<div ref={jsonEditorRef} style={{ height: '500px' }} />
```

### 2. JSON Preview Pane (Side Panel)
**BEFORE:** Monaco read-only
**AFTER:** vanilla-jsoneditor in text mode (read-only)

### 3. Validation Tab Test Data Editor
**BEFORE:** Monaco for test data
**AFTER:** vanilla-jsoneditor for test data

## 📦 Installation

### Step 1: Install Package
```bash
cd src/Frontend
npm install vanilla-jsoneditor
```

### Step 2: Import Styles
Add to SchemaBuilder.tsx or global CSS:
```typescript
import 'vanilla-jsoneditor/themes/jse-theme-dark.css'
```

## 🔧 Implementation Details

### Component Structure

```typescript
// State additions
const [jsonEditorInstance, setJsonEditorInstance] = useState<any>(null);
const jsonEditorRef = useRef<HTMLDivElement>(null);

// Initialize on mount
useEffect(() => {
  if (!jsonEditorRef.current) return;
  
  const editor = createJSONEditor({
    target: jsonEditorRef.current,
    props: {
      content: { json: jsonSchema ? JSON.parse(jsonSchema) : {} },
      mode: 'tree', // or 'text'
      onChange: (updatedContent) => {
        const jsonString = updatedContent.text || JSON.stringify(updatedContent.json, null, 2);
        setJsonSchema(jsonString);
      },
      readOnly: false,
      mainMenuBar: true,
      navigationBar: true,
      statusBar: true
    }
  });
  
  setJsonEditorInstance(editor);
  
  return () => editor.destroy();
}, []);

// Update content when jsonSchema changes
useEffect(() => {
  if (jsonEditorInstance && jsonSchema) {
    try {
      jsonEditorInstance.set({ json: JSON.parse(jsonSchema) });
    } catch (e) {
      jsonEditorInstance.set({ text: jsonSchema });
    }
  }
}, [jsonSchema, jsonEditorInstance]);
```

### JSON Editor Tab Layout
```typescript
<Tabs.TabPane tab={<span><CodeOutlined /> עורך JSON</span>} key="json">
  <Alert message="JSON Schema 2020-12 - עורך מקצועי" type="info" />
  
  {/* Mode Switcher */}
  <div style={{ marginBottom: 16 }}>
    <Button.Group>
      <Button onClick={() => switchMode('tree')}>עץ (Tree)</Button>
      <Button onClick={() => switchMode('text')}>קוד (Text)</Button>
      <Button onClick={() => switchMode('table')}>טבלה (Table)</Button>
    </Button.Group>
  </div>
  
  {/* vanilla-jsoneditor Container */}
  <div 
    ref={jsonEditorRef} 
    style={{ 
      height: '500px',
      border: '1px solid #d9d9d9',
      borderRadius: '6px'
    }} 
  />
  
  {/* Toolbar (copy, format, validate) */}
  <div style={{ marginTop: 8 }}>
    <Space>
      <Button size="small" onClick={handleCopy}>העתק</Button>
      <Button size="small" onClick={handleFormat}>עצב JSON</Button>
      <Button size="small" onClick={handleValidate}>אמת</Button>
    </Space>
  </div>
</Tabs.TabPane>
```

## 🎨 Styling Integration

### Theme Customization
```scss
.jse-theme-custom {
  --jse-theme-color: #1890ff; // Ant Design primary blue
  --jse-background-color: #ffffff;
  --jse-text-color: #262626;
  /* Match Ant Design colors */
}
```

### RTL Support
```css
.jse-main[dir="rtl"] {
  direction: rtl;
  text-align: right;
}
```

## 🔄 Data Flow

### Visual Editor → JSON Editor
1. User adds/edits fields in Visual Editor
2. generateJsonSchema() creates JSON string
3. setJsonSchema() updates state
4. useEffect triggers jsonEditorInstance.set()
5. vanilla-jsoneditor displays in tree/text mode

### JSON Editor → Visual Editor
1. User edits in vanilla-jsoneditor (tree or text mode)
2. onChange callback receives updated content
3. setJsonSchema() updates state
4. Parse JSON to extract fields
5. Visual editor displays parsed fields

## ✨ Additional Benefits

### Built-in Features You Get Free
1. **Auto-repair** - Invalid JSON gets fixed automatically
2. **Transform** - JMESPath/JSONPath queries
3. **Sort** - Sort object keys
4. **Compact/Format** - One-click beautify
5. **Search & Replace** - Find and replace in large JSONs
6. **Color Picker** - For color values
7. **Timestamp Display** - Human-readable dates

### Mode-Specific Features
- **Tree Mode:** Drag-and-drop, expand/collapse all, context menu
- **Text Mode:** Syntax highlighting, bracket matching, code folding
- **Table Mode:** Edit arrays as spreadsheet (bonus feature)

## 📋 Implementation Checklist

### Phase 1: Setup (15 minutes)
- [ ] Install vanilla-jsoneditor package
- [ ] Import styles and create wrapper component
- [ ] Test basic rendering

### Phase 2: JSON Editor Tab (30 minutes)
- [ ] Replace Monaco with vanilla-jsoneditor
- [ ] Implement mode switcher (tree/text/table)
- [ ] Wire up onChange to update jsonSchema state
- [ ] Add toolbar buttons (copy, format, validate)
- [ ] Test bidirectional sync with Visual Editor

### Phase 3: JSON Preview Pane (15 minutes)
- [ ] Replace Monaco with vanilla-jsoneditor (read-only, text mode)
- [ ] Wire up to jsonSchema state
- [ ] Test real-time updates

### Phase 4: Validation Tab (15 minutes)
- [ ] Replace Monaco with vanilla-jsoneditor for test data
- [ ] Keep as text mode, editable
- [ ] Test with sample data

### Phase 5: Testing (30 minutes)
- [ ] Test loading schema from API (8 fields display)
- [ ] Test tree mode editing
- [ ] Test text mode editing
- [ ] Test mode switching preserves data
- [ ] Test Visual Editor ↔ JSON Editor sync
- [ ] Test save functionality
- [ ] Test with complex nested schemas

## 🎯 Expected Outcome

**User Experience:**
1. Opens Schema Builder
2. Visual Editor shows 8 fields in list
3. Clicks "JSON Editor" tab
4. Sees **tree view** with expandable nodes (default)
5. Can switch to **text mode** for code editing
6. Can switch to **table mode** for array editing
7. All modes stay perfectly synced
8. Changes propagate to Visual Editor
9. Save persists to backend

**Technical Benefits:**
- No more blank screen issues
- Professional JSON editing experience
- Built-in validation and repair
- Better performance with large schemas
- Modern, maintained codebase
- Easier to debug and extend

## ⚠️ Potential Considerations

1. **Package Size:** vanilla-jsoneditor (~400KB gzipped) vs Monaco (~1.5MB)
   - **Result:** Actually smaller and better performance

2. **Learning Curve:** New API
   - **Mitigation:** Excellent documentation, React examples available

3. **Breaking Changes:** Different editor instance API
   - **Mitigation:** Well-contained in SchemaBuilder.tsx only

## 🚀 Rollout Strategy

1. **Install and test** in development
2. **Implement JSON Editor tab** first (main editor)
3. **Verify bidirectional sync** works
4. **Update preview pane** and validation tab
5. **Test with real schemas** (all 6 test schemas)
6. **User acceptance testing**
7. **Deploy to production**

## 📄 Files to Modify

1. `src/Frontend/package.json` - Add dependency
2. `src/Frontend/src/pages/schema/SchemaBuilder.tsx` - Main implementation
3. Possibly create: `src/Frontend/src/components/schema/VanillaJSONEditor.tsx` - Wrapper component
4. Update: Any CSS/style files for theme customization

## 🎯 Success Criteria

- [ ] JSON editor displays content (no blank screens)
- [ ] Tree mode shows expandable JSON structure
- [ ] Text mode shows code with syntax highlighting
- [ ] Mode switching preserves data
- [ ] Visual Editor ↔ JSON Editor stay synced
- [ ] Save/load works correctly
- [ ] All 6 existing schemas can be edited
- [ ] Better UX than Monaco (tree view)

---

**Estimated Total Implementation Time:** 2-3 hours

**Ready to proceed with implementation upon approval.**
