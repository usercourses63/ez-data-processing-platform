---
last-verified: 2026-02-02
status: current
---
# Schema-DataSource Relationship Analysis

## Context
Currently, the schema assignment is managed from the Schema Management page where you assign a **DataSource TO a Schema** (not the other way around). This means the relationship is stored in the Schema entity.

The issue: When we need to create datasource-specific metrics, we query datasources but can't easily find which schema they use.

---

## Option 1: Query Schemas to Find Relationship

### How It Works
When we need to find a datasource's schema:
1. Fetch all schemas
2. Filter schemas by `dataSourceIds` containing the target datasource ID
3. Use the first matching schema

### Pros
✅ **Single Source of Truth** - Relationship stored in one place (Schema)
✅ **No Data Duplication** - Avoids redundant storage
✅ **No Sync Issues** - Can't get out of sync since there's only one copy
✅ **Simple to Maintain** - One place to update relationships
✅ **Follows Current Architecture** - Matches existing design pattern

### Cons
❌ **Performance** - Requires querying all schemas for each datasource lookup
❌ **N+1 Query Problem** - If fetching multiple datasources, need schema query for each
❌ **More Complex Code** - Requires additional lookup logic
❌ **API Calls** - Metrics script needs extra API call per datasource

### Implementation
```python
# In create-datasource-specific-metrics.py
def find_schema_for_datasource(datasource_id):
    response = requests.get(f"{SCHEMA_API_URL}")
    schemas = response.json().get('Data', {}).get('Items', [])
    for schema in schemas:
        datasource_ids = schema.get('DataSourceIds', [])
        if datasource_id in datasource_ids:
            return schema['ID']
    return None
```

### Complexity: Medium
- Requires modifying Python script
- Simple logic but additional API call
- Performance impact if many datasources

---

## Option 2: Add Cross-Reference to DataSource

### How It Works
Add a `SchemaId` property to the DataSource entity that gets automatically updated when:
- A datasource is assigned to a schema
- A datasource is unassigned from a schema
- Schema is deleted

### Pros
✅ **Performance** - No additional queries needed
✅ **Simpler Lookups** - Direct property access
✅ **Better API** - Cleaner response with schemaId included
✅ **Easier for Metrics** - Script gets schemaId directly
✅ **Consistent with Frontend** - UI already expects this field

### Cons
❌ **Data Duplication** - Same relationship stored in two places
❌ **Sync Risk** - Schema and DataSource could get out of sync
❌ **More Complex Updates** - Need to update both entities
❌ **Migration Needed** - Existing data needs backfill
❌ **Additional Code** - Need event handlers or service coordination

### Implementation Requirements

**1. Add Property to DataSource Model**
```csharp
public class DataSource : Entity
{
    // ... existing properties ...
    public string? SchemaId { get; set; }
    // ...
}
```

**2. Update When Schema Assignment Changes**

In SchemaService or SchemaRepository:
```csharp
public async Task AssignDataSourcesAsync(string schemaId, List<string> dataSourceIds)
{
    // Existing: Update schema with datasource IDs
    await _schemaRepository.UpdateDataSourcesAsync(schemaId, dataSourceIds);
    
    // NEW: Update each datasource with schemaId
    foreach (var dsId in dataSourceIds)
    {
        await _dataSourceRepository.UpdateSchemaIdAsync(dsId, schemaId);
    }
    
    // NEW: Clear schemaId from previously assigned datasources
    var removedIds = /* calculate removed datasources */;
    foreach (var dsId in removedIds)
    {
        await _dataSourceRepository.UpdateSchemaIdAsync(dsId, null);
    }
}
```

**3. Backfill Existing Data**
```csharp
// Migration script to populate SchemaId in existing datasources
var schemas = await _schemaRepository.GetAllAsync();
foreach (var schema in schemas)
{
    foreach (var dsId in schema.DataSourceIds)
    {
        await _dataSourceRepository.UpdateSchemaIdAsync(dsId, schema.ID);
    }
}
```

### Complexity: High
- Requires model changes
- Requires service coordination
- Needs data migration
- Must maintain sync in multiple operations

---

## Recommendation: **Option 1** (Query Schemas)

### Why Option 1 is Better

**1. Architectural Consistency**
- Follows the existing design where Schema owns the relationship
- No changes to data model
- No migration needed

**2. Lower Risk**
- No risk of data getting out of sync
- No complex update coordination needed
- Existing data works as-is

**3. Simpler Implementation**
- Only requires updating the Python script
- No backend code changes
- No deployment/migration needed

**4. Performance is Acceptable**
- Schema query is a one-time operation per script run
- Schemas are typically small in number
- Can be cached if needed

**5. Cleaner Separation of Concerns**
- Schema manages its own relationships
- DataSource doesn't need to know about Schema
- Reduces coupling between entities

### Implementation Plan for Option 1

**Step 1:** Update `create-datasource-specific-metrics.py`
```python
def fetch_all_schemas():
    """Fetch all schemas to build datasource→schema map"""
    response = requests.get(SCHEMA_API_URL)
    result = response.json()
    return result.get('Data', {}).get('Items', [])

def build_datasource_schema_map(schemas):
    """Build map of datasourceId → schemaId"""
    ds_schema_map = {}
    for schema in schemas:
        datasource_ids = schema.get('DataSourceIds', [])
        for ds_id in datasource_ids:
            ds_schema_map[ds_id] = schema['ID']
    return ds_schema_map

def main():
    # Fetch schemas first
    schemas = fetch_all_schemas()
    ds_schema_map = build_datasource_schema_map(schemas)
    
    # Then process datasources using the map
    for ds in datasources:
        schema_id = ds_schema_map.get(ds['ID'])
        if schema_id:
            schema = fetch_schema(schema_id)
            # ... create metrics ...
```

**Estimated Time:** 15 minutes
**Risk:** Low
**Complexity:** Low

---

## Why NOT Option 2

While Option 2 provides better performance, the downsides outweigh the benefits:

**1. Data Integrity Risk**
- Two copies of the same relationship
- Schema could be updated without updating DataSource
- DataSource could show wrong schema if sync fails

**2. Implementation Complexity**
- Need to modify DataSource entity
- Need to update SchemaService
- Need to coordinate updates in multiple places
- Need event handlers or listeners
- Need migration script

**3. Testing Burden**
- Must test all update scenarios
- Must test rollback scenarios  
- Must verify sync stays consistent
- More potential for bugs

**4. Maintenance Cost**
- Every schema assignment change needs two updates
- Future developers must remember to update both
- Increases cognitive load

### When Option 2 Would Be Better
Option 2 only makes sense if:
- We have thousands of schemas (performance critical)
- Schema lookups happen very frequently  
- We're willing to accept the complexity and risks

Currently, we likely have <100 schemas, so performance isn't a concern.

---

## Final Recommendation

### ✅ Implement Option 1: Query Schemas

**Reasoning:**
1. **Simple** - Just update the Python script
2. **Safe** - No data model changes
3. **Fast to implement** - Can be done in minutes  
4. **No deployment** - Works with current backend
5. **Maintainable** - Single source of truth
6. **Testable** - Easy to verify correctness

**Implementation:**
```python
# Pseudo-code
schemas = fetch_all_schemas()
for each schema:
    for each datasource_id in schema.DataSourceIds:
        map[datasource_id] = schema.ID

for each datasource:
    schema_id = map[datasource.ID]
    if schema_id:
        create metrics from schema fields
```

**Time to Complete:** ~15 minutes
**Risk Level:** Low
**Testing Required:** Run script, verify metrics created

---

## Decision Point

**My Strong Recommendation: Option 1**

Unless you have specific performance requirements or architectural reasons for Option 2, I recommend proceeding with Option 1.

**Your Decision:**
- [ ] Option 1 - Query schemas (Recommended)
- [ ] Option 2 - Add cross-reference to DataSource
- [ ] Other approach

Once you decide, I can immediately implement the solution.
