---
last-verified: 2026-02-02
status: current
---
# Schema-DataSource Architecture Recommendation

## Conceptual Truth

**You are 100% correct:** A schema is not a separate standalone entity - it is an **intrinsic part** of a data source that defines its structure and fields.

**Current Problem:** The UI and architecture treat Schema as a separate entity that gets "assigned" to datasources, which is conceptually backwards.

---

## Analysis of Current Architecture

### Current State (Incorrect Conceptual Model)
```
Schema (Independent Entity)
  ├─ ID, Name, Description
  ├─ SchemaDefinition (JSON)
  └─ DataSourceIds[] (Many schemas can reference many datasources)

DataSource (Independent Entity)
  ├─ ID, Name, Description
  ├─ FilePath, PollingRate
  └─ (No direct schema reference)
```

**Problems:**
1. ❌ Schema exists independently - makes no sense
2. ❌ Many-to-many relationship - why would one schema apply to multiple datasources?
3. ❌ Schema management is separate from datasource management
4. ❌ Can create schemas without datasources
5. ❌ Can create datasources without schemas
6. ❌ Backwards ownership (schema "owns" datasource references)

---

## Recommended Architecture

### Option A: Schema as Embedded Property (STRONGLY RECOMMENDED)

```
DataSource (Aggregate Root)
  ├─ ID, Name, Description
  ├─ FilePath, PollingRate, Category
  └─ Schema (Embedded/Owned)
      ├─ SchemaDefinition (JSON)
      ├─ SchemaVersion
      └─ ValidatedAt
```

**Benefits:**
✅ **Conceptually Correct** - Schema is part of datasource
✅ **Simpler Model** - One entity instead of two
✅ **No Sync Issues** - Can't get out of sync
✅ **Clearer Ownership** - DataSource owns its schema
✅ **Simpler CRUD** - Create/update/delete datasource includes schema
✅ **Better Performance** - No joins or lookups needed
✅ **Cleaner API** - GET /datasource returns complete object
✅ **Easier Metrics** - Schema always available with datasource

### Option B: Schema as Required One-to-One Relationship

```
DataSource
  ├─ ID, Name, Description  
  ├─ FilePath, PollingRate
  └─ SchemaId (Required, Foreign Key)

Schema  
  ├─ ID
  ├─ SchemaDefinition
  └─ DataSourceId (Required, Foreign Key)
```

**Benefits:**
✅ **Separate but Connected** - Can manage schemas separately if needed
✅ **Reusable Schemas** - Could reuse schema definition if desired
✅ **Versioning** - Easier to version schemas separately

**Drawbacks:**
❌ Still has two entities
❌ More complex than Option A
❌ Can still get out of sync
❌ Requires enforcing constraints

---

## UI/UX Changes Recommendation

### Current UI Flow (Backwards)
1. User creates DataSource (without schema) ❌
2. User goes to separate Schema Management page ❌
3. User creates Schema ❌
4. User assigns DataSources to Schema ❌
5. Confusing and indirect ❌

### Recommended UI Flow (Correct)
1. User goes to Data Sources page ✅
2. User clicks "Create Data Source" ✅
3. **Schema builder is embedded in the datasource form** ✅
4. User defines:
   - Basic info (name, path, polling)
   - **Schema (inline schema builder)** ← KEY CHANGE
   - Configuration settings
5. Save creates datasource WITH its schema ✅
6. Edit datasource allows editing its schema inline ✅

### UI Changes Required

**1. Remove Separate Schema Management Page**
- No more standalone schema CRUD
- Schema is managed only through datasource pages

**2. Embed Schema Builder in DataSource Form**
```
Data Source Create/Edit Form
┌────────────────────────────────────┐
│ Basic Information                  │
│  - Name                           │
│  - Supplier                       │
│  - File Path                      │
│  - Polling Rate                   │
├────────────────────────────────────┤
│ Schema Definition (Required) ★     │
│  [Inline JSON Schema Builder]     │
│  - Add Field                      │
│  - Field Type                     │
│  - Validations                    │
│  - Descriptions                   │
├────────────────────────────────────┤
│ Configuration                      │
│  - Category                       │
│  - Active/Inactive                │
│  - Retention                      │
└────────────────────────────────────┘
     [Cancel] [Save Data Source]
```

**3. Show Schema Info in DataSource List**
```
Data Sources List
┌────────────────────────────────────────────────┐
│ Name          | Schema Fields | Status | ...  │
├────────────────────────────────────────────────┤
│ Financial     | 12 fields     | Active |      │
│ Sales         | 8 fields      | Active |      │
│ HR            | 15 fields     | Active |      │
└────────────────────────────────────────────────┘
```

---

## Backend Changes Required

### For Option A (Embedded Schema)

**1. Modify DataSource Model**
```csharp
public class DataSource : Entity
{
    public string Name { get; set; }
    public string SupplierName { get; set; }
    public string FilePath { get; set; }
    
    // Schema is part of DataSource - NOT a separate entity
    public SchemaDefinition Schema { get; set; }
    
    // ... other properties
}

public class SchemaDefinition
{
    public string Definition { get; set; } // JSON schema
    public int Version { get; set; }
    public DateTime? ValidatedAt { get; set; }
    public List<FieldInfo> Fields { get; set; } // Extracted for easy access
}
```

**2. Update DataSource CRUD**
- Create: Includes schema definition
- Update: Can update schema (increments version)
- Delete: Deletes datasource and its schema together
- Get: Returns datasource with schema embedded

**3. Migration Strategy**
```csharp
// Migrate existing data
var datasources = await _dataSourceRepository.GetAllAsync();
var schemas = await _schemaRepository.GetAllAsync();

foreach (var ds in datasources)
{
    // Find schema that has this datasource assigned
    var schema = schemas.FirstOrDefault(s => s.DataSourceIds.Contains(ds.ID));
    if (schema != null)
    {
        ds.Schema = new SchemaDefinition
        {
            Definition = schema.SchemaDefinition,
            Version = schema.SchemaVersion,
            Fields = ExtractFields(schema.SchemaDefinition)
        };
        await _dataSourceRepository.UpdateAsync(ds);
    }
}

// After migration, can delete Schema collection
```

---

## My Strong Recommendation

### ✅ YES - Change the UI and Architecture

**Why:**
1. **Conceptually Correct** - Schema IS the datasource's structure
2. **Simpler User Experience** - One workflow instead of two
3. **Fewer Errors** - Can't create datasource without schema
4. **Better Data Integrity** - Can't orphan schemas or datasources
5. **Cleaner API** - One endpoint returns everything
6. **Easier Development** - Less code, simpler logic
7. **Better Performance** - No relationship lookups needed

### Implementation Approach: **Option A (Embedded Schema)**

**Reasoning:**
- Most natural model
- Simplest implementation
- Best user experience
- Fewest edge cases
- Easiest to understand

---

## Simplified Architecture Proposal

### New Model
```
DataSource (Single Aggregate Root)
{
    "id": "ds001",
    "name": "Financial Reports",
    "supplierName": "Accounting System",
    "filePath": "/data/uploads",
    "pollingRate": "00:30:00",
    "schema": {
        "version": 1,
        "definition": {
            "type": "object",
            "properties": {
                "amount": { "type": "number" },
                "date": { "type": "string" }
            }
        },
        "fields": [
            { "name": "amount", "type": "number", "path": "$.amount" },
            { "name": "date", "type": "string", "path": "$.date" }
        ]
    },
    "isActive": true,
    "category": "financial"
}
```

### New UI Flow
1. **Create DataSource**
   - Enter basic info
   - **Build schema inline** (same page)
   - Configure settings
   - Save (creates datasource + schema together)

2. **Edit DataSource**
   - Edit basic info
   - **Edit schema inline** (same page)
   - Update settings
   - Save (updates datasource + schema together)

3. **Delete DataSource**
   - Deletes datasource and its schema together
   - Simple, no orphaned schemas

### Removed Complexity
- ❌ Separate Schema Management page
- ❌ Schema-DataSource assignment workflow
- ❌ DataSourceIds array in Schema
- ❌ Cross-referencing logic
- ❌ Sync maintenance code

---

## Migration Path

### Phase 1: Backend Changes (2-3 hours)
1. Add `Schema` property to DataSource model
2. Update DataSourceRepository CRUD operations
3. Create migration script to embed existing schemas
4. Test API returns schema with datasource

### Phase 2: Frontend Changes (3-4 hours)
1. Integrate schema builder into DataSource form
2. Remove Schema Management navigation/pages
3. Update datasource list to show schema info
4. Test create/edit/delete workflows

### Phase 3: Cleanup (1 hour)
1. Remove old Schema entity and repository
2. Remove schema-specific API endpoints
3. Update documentation
4. Final testing

**Total Estimated Time:** 6-8 hours
**Risk:** Medium (requires migration)
**Benefit:** Huge simplification long-term

---

## Alternative: Quick Fix for Now

If you want to proceed with metrics immediately without the refactor:

**Temporary Solution:** Use Option 1 from previous analysis (query schemas)
- Modify Python script to fetch schemas and build map
- Takes 15 minutes
- Works with current architecture
- Can refactor architecture later

**Then Later:** Refactor to embedded schema when time permits

---

## My Recommendation

### Immediate Action
✅ **Use Option 1 (Query Schemas)** for metrics script
- Gets you unblocked immediately
- 15 minutes to implement
- Creates the datasource-specific metrics you need

### Strategic Action  
✅ **Refactor to Embedded Schema** (Option A above)
- Plan for next sprint/iteration
- Significant improvement to architecture
- Much cleaner long-term
- Better UX

### Reasoning
1. **Unblock metrics work** - Don't let perfect be enemy of good
2. **Get value now** - Metrics are important
3. **Plan proper refactor** - Do it right when you have time
4. **Avoid rushed changes** - Architecture changes need careful planning

---

## Decision Points

**For Immediate Metrics Work:**
- [ ] Use Option 1 (query schemas) - 15 min fix ← I recommend this NOW
- [ ] Wait for full refactor before creating metrics

**For Long-Term Architecture:**
- [ ] Refactor to embedded schema (Option A) ← I recommend this LATER
- [ ] Keep separate entities with cross-reference (Option B)
- [ ] Keep current architecture

**My Advice:** Do Option 1 now for metrics, plan Option A refactor for next iteration.

Let me know your decision and I'll implement immediately!
