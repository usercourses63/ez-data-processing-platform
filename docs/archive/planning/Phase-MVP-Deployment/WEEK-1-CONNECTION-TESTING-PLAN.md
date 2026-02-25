# Week 1: Connection Testing & Backend APIs - Implementation Plan

**Week:** 1 of 5
**Duration:** 5 days
**MCP Task:** task-35
**Status:** 🔄 In Progress
**Start Date:** December 2, 2025

---

## Objectives

### Primary Goal
Implement and validate all connection testing functionality with real backend APIs.

### Success Criteria
- [ ] Kafka connection testing API functional
- [ ] Folder path validation API functional
- [ ] SFTP connection testing API functional
- [ ] Frontend Test Connection buttons use real APIs
- [ ] Real-time validation feedback working
- [ ] Error messages detailed and actionable
- [ ] All connection types tested end-to-end

---

## Day-by-Day Plan

### Day 1: Kafka Connection Testing API

**Goal:** Implement backend API to test Kafka broker connectivity

**Tasks:**
1. Create ConnectionTestController in DataSourceManagementService
2. Implement POST /api/v1/test-connection/kafka endpoint
3. Test Kafka broker connectivity, authentication, topic existence
4. Return detailed error messages

**Implementation Location:**
- `src/Services/DataSourceManagementService/Controllers/ConnectionTestController.cs`
- `src/Services/DataSourceManagementService/Services/ConnectionTestService.cs`

**Deliverables:**
- [ ] API endpoint functional
- [ ] Tests broker connectivity
- [ ] Validates topic existence
- [ ] Returns detailed error messages
- [ ] Build successful

**Testing:**
```bash
# Test with curl
curl -X POST http://localhost:5001/api/v1/test-connection/kafka \
  -H "Content-Type: application/json" \
  -d '{
    "brokerServer": "localhost:9092",
    "topic": "test-topic",
    "username": "",
    "password": ""
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Kafka connection successful",
  "details": {
    "brokerReachable": true,
    "topicExists": true,
    "authenticationSuccessful": true,
    "latencyMs": 45
  }
}
```

---

### Day 2: Folder Validation API

**Goal:** Implement backend API to validate folder paths and permissions

**Tasks:**
1. Implement POST /api/v1/test-connection/folder endpoint
2. Test folder existence, write permissions, disk space
3. Return detailed validation results

**Implementation:**
- Add method to ConnectionTestService.cs
- Test folder operations

**Deliverables:**
- [ ] API endpoint functional
- [ ] Tests folder existence
- [ ] Validates write permissions
- [ ] Checks disk space
- [ ] Returns detailed validation

**Testing:**
```bash
curl -X POST http://localhost:5001/api/v1/test-connection/folder \
  -H "Content-Type: application/json" \
  -d '{
    "path": "C:\\Data\\Output\\test",
    "checkWritePermissions": true,
    "checkDiskSpace": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Folder validation successful",
  "details": {
    "folderExists": true,
    "writable": true,
    "diskSpaceGB": 125.5,
    "testFileCreated": true
  }
}
```

---

### Day 3: SFTP Connection Testing API

**Goal:** Implement backend API to test SFTP connections

**Tasks:**
1. Implement POST /api/v1/test-connection/sftp endpoint
2. Test SFTP server connectivity, authentication
3. Test directory access and write permissions
4. Support password and SSH key authentication

**Implementation:**
- Add SFTP testing to ConnectionTestService.cs
- Use SSH.NET library (already in dependencies)

**Deliverables:**
- [ ] API endpoint functional
- [ ] Tests SFTP connectivity
- [ ] Validates authentication (password & SSH key)
- [ ] Tests directory access
- [ ] Returns detailed results

**Testing:**
```bash
curl -X POST http://localhost:5001/api/v1/test-connection/sftp \
  -H "Content-Type: application/json" \
  -d '{
    "host": "sftp.example.com",
    "port": 22,
    "username": "testuser",
    "password": "testpass",
    "remotePath": "/upload"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "SFTP connection successful",
  "details": {
    "serverReachable": true,
    "authenticationSuccessful": true,
    "directoryAccessible": true,
    "writable": true
  }
}
```

---

### Day 4: Frontend Integration

**Goal:** Connect frontend Test Connection buttons to real backend APIs

**Tasks:**
1. Update DestinationEditorModal.tsx
2. Replace simulated testing with real API calls
3. Handle loading states and error messages
4. Add timeout handling (30 seconds)
5. Display detailed validation results

**Implementation:**
- `src/Frontend/src/components/datasource/modals/DestinationEditorModal.tsx`
- Create API client: `src/Frontend/src/api/connection-test-api-client.ts`

**Deliverables:**
- [ ] API client created
- [ ] Frontend calls real APIs
- [ ] Loading states work correctly
- [ ] Success/failure tags display
- [ ] Error messages shown to user
- [ ] Timeout handling implemented

**Testing:**
1. Click Test Connection for Kafka destination
2. Verify loading spinner appears
3. Verify success/failure tag displays
4. Verify error message shows if failed
5. Test all 3 connection types

---

### Day 5: End-to-End Testing & Documentation

**Goal:** Test all connection types and document results

**Tasks:**
1. Test Kafka connection validation (valid and invalid configs)
2. Test Folder validation (valid path, invalid path, no permissions)
3. Test SFTP connection (valid and invalid credentials)
4. Test timeout scenarios
5. Test error handling
6. Document all results
7. Update Week 1 completion status

**Test Scenarios:**
- Kafka valid broker → Should succeed
- Kafka invalid broker → Should fail with detailed error
- Folder valid path → Should succeed
- Folder no permissions → Should fail with permission error
- SFTP valid credentials → Should succeed
- SFTP invalid credentials → Should fail with auth error
- Connection timeout → Should fail gracefully

**Deliverables:**
- [ ] All connection types tested
- [ ] Success and failure scenarios validated
- [ ] Error messages verified
- [ ] Week 1 results documented
- [ ] Task-35 marked complete in task manager

---

## Implementation Details

### Backend API Structure

**Create New Controller:**

`src/Services/DataSourceManagementService/Controllers/ConnectionTestController.cs`

```csharp
[ApiController]
[Route("api/v1/test-connection")]
public class ConnectionTestController : ControllerBase
{
    private readonly IConnectionTestService _connectionTestService;

    [HttpPost("kafka")]
    public async Task<ActionResult<ConnectionTestResult>> TestKafkaConnection(
        [FromBody] KafkaConnectionTestRequest request)
    {
        var result = await _connectionTestService.TestKafkaConnectionAsync(request);
        return Ok(result);
    }

    [HttpPost("folder")]
    public async Task<ActionResult<ConnectionTestResult>> TestFolderConnection(
        [FromBody] FolderConnectionTestRequest request)
    {
        var result = await _connectionTestService.TestFolderConnectionAsync(request);
        return Ok(result);
    }

    [HttpPost("sftp")]
    public async Task<ActionResult<ConnectionTestResult>> TestSftpConnection(
        [FromBody] SftpConnectionTestRequest request)
    {
        var result = await _connectionTestService.TestSftpConnectionAsync(request);
        return Ok(result);
    }
}
```

---

**Create Service Interface:**

`src/Services/DataSourceManagementService/Services/IConnectionTestService.cs`

```csharp
public interface IConnectionTestService
{
    Task<ConnectionTestResult> TestKafkaConnectionAsync(KafkaConnectionTestRequest request);
    Task<ConnectionTestResult> TestFolderConnectionAsync(FolderConnectionTestRequest request);
    Task<ConnectionTestResult> TestSftpConnectionAsync(SftpConnectionTestRequest request);
}
```

---

### Frontend API Client

**Create:**

`src/Frontend/src/api/connection-test-api-client.ts`

```typescript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api/v1/test-connection';

export interface KafkaTestRequest {
  brokerServer: string;
  topic: string;
  username?: string;
  password?: string;
}

export interface FolderTestRequest {
  path: string;
  checkWritePermissions: boolean;
  checkDiskSpace: boolean;
}

export interface SftpTestRequest {
  host: string;
  port: number;
  username: string;
  password?: string;
  sshKey?: string;
  remotePath: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details: any;
  errorDetails?: string;
}

export const testKafkaConnection = async (
  request: KafkaTestRequest
): Promise<ConnectionTestResult> => {
  const response = await axios.post(`${API_BASE_URL}/kafka`, request, {
    timeout: 30000
  });
  return response.data;
};

export const testFolderConnection = async (
  request: FolderTestRequest
): Promise<ConnectionTestResult> => {
  const response = await axios.post(`${API_BASE_URL}/folder`, request, {
    timeout: 30000
  });
  return response.data;
};

export const testSftpConnection = async (
  request: SftpTestRequest
): Promise<ConnectionTestResult> => {
  const response = await axios.post(`${API_BASE_URL}/sftp`, request, {
    timeout: 30000
  });
  return response.data;
};
```

---

## Models & DTOs

### Request Models

```csharp
public class KafkaConnectionTestRequest
{
    public string BrokerServer { get; set; } = "";
    public string Topic { get; set; } = "";
    public string? Username { get; set; }
    public string? Password { get; set; }
}

public class FolderConnectionTestRequest
{
    public string Path { get; set; } = "";
    public bool CheckWritePermissions { get; set; } = true;
    public bool CheckDiskSpace { get; set; } = true;
}

public class SftpConnectionTestRequest
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 22;
    public string Username { get; set; } = "";
    public string? Password { get; set; }
    public string? SshKey { get; set; }
    public string RemotePath { get; set; } = "/";
}
```

### Response Model

```csharp
public class ConnectionTestResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public Dictionary<string, object> Details { get; set; } = new();
    public string? ErrorDetails { get; set; }
}
```

---

## Testing Checklist

### Backend API Testing

**Kafka Testing:**
- [ ] Valid broker → Success
- [ ] Invalid broker → Detailed error
- [ ] Topic exists → Success
- [ ] Topic doesn't exist → Topic not found error
- [ ] Authentication required → Auth error

**Folder Testing:**
- [ ] Valid path → Success
- [ ] Path doesn't exist → Folder not found
- [ ] No write permissions → Permission denied
- [ ] Low disk space → Warning message
- [ ] Network path → Test network connectivity

**SFTP Testing:**
- [ ] Valid credentials → Success
- [ ] Invalid host → Host unreachable
- [ ] Invalid credentials → Auth failed
- [ ] Directory not accessible → Path error
- [ ] SSH key auth → Success/Fail

---

### Frontend Testing

- [ ] Kafka Test Connection shows loading spinner
- [ ] Kafka success shows green tag
- [ ] Kafka failure shows red tag with error
- [ ] Folder Test Connection works
- [ ] SFTP Test Connection works
- [ ] Timeout shows appropriate error
- [ ] Error messages are user-friendly (Hebrew)

---

## Daily Progress Tracking

### Day 1 Status
**Date:** _______
**Tasks Completed:**
- [ ] ConnectionTestController created
- [ ] IConnectionTestService interface created
- [ ] Kafka testing implemented
- [ ] API tested with curl

**Blockers:** _______
**Notes:** _______

---

### Day 2 Status
**Date:** _______
**Tasks Completed:**
- [ ] Folder validation implemented
- [ ] API tested

**Blockers:** _______
**Notes:** _______

---

### Day 3 Status
**Date:** _______
**Tasks Completed:**
- [ ] SFTP connection testing implemented
- [ ] SSH.NET integration working
- [ ] API tested

**Blockers:** _______
**Notes:** _______

---

### Day 4 Status
**Date:** _______
**Tasks Completed:**
- [ ] API client created
- [ ] Frontend integration complete
- [ ] All connection types tested in UI

**Blockers:** _______
**Notes:** _______

---

### Day 5 Status
**Date:** _______
**Tasks Completed:**
- [ ] E2E testing complete
- [ ] All scenarios validated
- [ ] Documentation updated
- [ ] Week 1 sign-off

**Blockers:** _______
**Notes:** _______

---

## Week 1 Sign-off

**Technical Criteria:**
- [ ] All 3 connection testing APIs implemented
- [ ] All APIs build without errors
- [ ] Frontend integration complete
- [ ] All connection types tested
- [ ] Error handling working correctly

**Quality Criteria:**
- [ ] Success scenarios work
- [ ] Failure scenarios show detailed errors
- [ ] Timeout handling works
- [ ] User experience is smooth

**Sign-off:**
- Developer: _____________ Date: _______
- QA: _____________ Date: _______
- Lead: _____________ Date: _______

**Status:** [ ] COMPLETE - Ready for Week 2

---

**Document Created:** December 2, 2025
**Last Updated:** December 2, 2025
