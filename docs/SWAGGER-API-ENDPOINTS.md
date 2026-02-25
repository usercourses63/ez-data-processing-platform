---
last-verified: 2026-02-02
status: current
---
# EZ Platform - Swagger API Documentation Endpoints

**Last Updated:** December 30, 2025
**Status:** ✅ All Services Configured with Swagger
**Coverage:** 9/9 Backend Services (100%)

---

## 📋 **Swagger API Endpoints**

### Deployed Services (8/9)

| Service | Port | Swagger UI | API JSON | Status |
|---------|------|------------|----------|--------|
| **DataSourceManagement** | 5001 | http://localhost:5001/swagger | http://localhost:5001/swagger/v1/swagger.json | ✅ Enabled |
| **MetricsConfiguration** | 5002 | http://localhost:5002/swagger | http://localhost:5002/swagger/v1/swagger.json | ✅ Verified |
| **Validation** | 5003 | http://localhost:5003/swagger | http://localhost:5003/swagger/v1/swagger.json | ✅ Enabled |
| **Scheduling** | 5004 | http://localhost:5004/swagger | http://localhost:5004/swagger/v1/swagger.json | ✅ Enabled |
| **InvalidRecords** | 5006 | http://localhost:5006/swagger | http://localhost:5006/swagger/v1/swagger.json | ✅ Enabled |
| **FileDiscovery** | 5007 | http://localhost:5007/swagger | http://localhost:5007/swagger/v1/swagger.json | ✅ Enabled |
| **FileProcessor** | 5008 | http://localhost:5008/swagger | http://localhost:5008/swagger/v1/swagger.json | ✅ Enabled |
| **Output** | 5009 | http://localhost:5009/swagger | http://localhost:5009/swagger/v1/swagger.json | ✅ Enabled |

### Not Deployed (1/9)

| Service | Port | Status | Notes |
|---------|------|--------|-------|
| **DataSourceChat** | N/A | ✅ Configured | Optional AI Assistant service |

---

## 🔧 **Configuration**

### Swagger Package
- **Package:** Swashbuckle.AspNetCore
- **Version:** 10.0.1 (managed via Directory.Packages.props)
- **Configuration:** All services

### Code Pattern

**Service Configuration (Program.cs):**
```csharp
// Add Swagger generation
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Service Name API", Version = "v1" });
});
```

**Middleware (Development Only):**
```csharp
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Service Name API v1");
    });
}
```

---

## 🚀 **Access Instructions**

### Prerequisites
```bash
# Ensure port forwards are running
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"

# Verify ports listening
netstat -ano | findstr "5001 5002 5003 5004 5006 5007 5008 5009"
```

### Open Swagger UIs

**All Services:**
```bash
# DataSource Management (Primary API - 16 endpoints)
start http://localhost:5001/swagger

# Metrics Configuration
start http://localhost:5002/swagger

# Validation Service
start http://localhost:5003/swagger

# Scheduling Service
start http://localhost:5004/swagger

# Invalid Records Service
start http://localhost:5006/swagger

# File Discovery Service
start http://localhost:5007/swagger

# File Processor Service
start http://localhost:5008/swagger

# Output Service
start http://localhost:5009/swagger
```

---

## 📊 **API Overview by Service**

### DataSourceManagement API (Port 5001)
**Endpoints:** 16 REST APIs
- Data Source CRUD (Create, Read, Update, Delete)
- Connection testing (SFTP, FTP, Local, HTTP, Kafka)
- Schema management (upload, validate, list)
- Category management (CRUD, reorder)
- System settings management

**Swagger:** ✅ Enabled

### MetricsConfiguration API (Port 5002)
**Endpoints:** Metrics and alerts management
- Global metrics configuration
- Data source-specific metrics
- Alert rules (create, update, delete)
- PromQL query execution

**Swagger:** ✅ Enabled (Verified Working)

### Validation API (Port 5003)
**Endpoints:** Schema validation
- Validate records against JSON Schema
- Schema caching
- Validation error reporting

**Swagger:** ✅ Enabled

### Scheduling API (Port 5004)
**Endpoints:** Job scheduling with Quartz.NET
- Create scheduled jobs
- Pause/resume jobs
- Job status and history

**Swagger:** ✅ Enabled

### InvalidRecords API (Port 5006)
**Endpoints:** Invalid record management
- List invalid records
- Get validation details
- Reprocess records
- Export invalid data

**Swagger:** ✅ Enabled

### FileDiscovery API (Port 5007)
**Endpoints:** File discovery and polling
- Manual file discovery trigger
- Poll status
- File hash management (deduplication)

**Swagger:** ✅ Enabled

### FileProcessor API (Port 5008)
**Endpoints:** Format conversion
- Process files (CSV, JSON, XML, Excel)
- Format conversion status
- Processing statistics

**Swagger:** ✅ Enabled

### Output API (Port 5009)
**Endpoints:** Multi-destination output
- Output handlers (Folder, Kafka)
- Format reconstruction (CSV, XML, Excel)
- Output status and logs

**Swagger:** ✅ Enabled

---

## ✅ **Verification**

### Quick Test
```bash
# Test all Swagger JSON endpoints
curl http://localhost:5001/swagger/v1/swagger.json | head -5
curl http://localhost:5002/swagger/v1/swagger.json | head -5
curl http://localhost:5003/swagger/v1/swagger.json | head -5
curl http://localhost:5004/swagger/v1/swagger.json | head -5
curl http://localhost:5006/swagger/v1/swagger.json | head -5
curl http://localhost:5007/swagger/v1/swagger.json | head -5
curl http://localhost:5008/swagger/v1/swagger.json | head -5
curl http://localhost:5009/swagger/v1/swagger.json | head -5
```

### Environment Check
All services must be in **Development** mode for Swagger to be enabled:
```bash
kubectl get pods -n ez-platform -o json | jq '.items[] | select(.metadata.labels.app != null) | {name: .metadata.name, env: .spec.containers[0].env[] | select(.name=="ASPNETCORE_ENVIRONMENT").value}'
```

---

## 🔧 **Troubleshooting**

### Swagger UI Not Showing

**Check 1: Environment Mode**
```bash
kubectl get deployment datasource-management -n ez-platform -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="ASPNETCORE_ENVIRONMENT")].value}'
# Should return: Development
```

**Check 2: Pod Logs**
```bash
kubectl logs deployment/datasource-management -n ez-platform | grep -i swagger
```

**Check 3: Port Forward**
```bash
netstat -ano | findstr ":5001"
# Should show LISTENING
```

### Fixing Environment Mode

If service is in Production mode, change to Development:
```bash
kubectl set env deployment/service-name ASPNETCORE_ENVIRONMENT=Development -n ez-platform
kubectl rollout restart deployment/service-name -n ez-platform
```

---

## 📚 **Documentation**

- **OpenAPI Spec:** Each service exposes OpenAPI 3.0 specification
- **Interactive Testing:** All Swagger UIs support "Try it out" functionality
- **Schema Definitions:** Complete request/response models documented
- **Authentication:** No authentication required for development environment

---

**Status:** ✅ Complete - All 9 services have Swagger API documentation
**Access:** Requires port-forwarding script running
**Mode:** Development environment only

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>
