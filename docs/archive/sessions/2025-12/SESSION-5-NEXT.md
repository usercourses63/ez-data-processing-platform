# Session 5 - E2E Testing & Production Readiness

**For next session after December 8, 2025**
**Status:** 100% Platform Operational - Ready for E2E Testing
**Goal:** Test complete data processing pipeline and prepare for production

---

## 🎯 Current Status (100% Operational!)

### ✅ Fully Working:
- **All Infrastructure (12/12):** MongoDB, Kafka, Zookeeper, Hazelcast, Elasticsearch, OTEL Collector, Jaeger, Prometheus (System & Business), Grafana
- **All Services (9/9):** All 1/1 Running in Development mode with CORS enabled
- **MongoDB Data:** 20 datasources, 20 schemas, 73 metrics, 24 alerts
- **Frontend:** Accessible at http://localhost:8080, displaying all data
- **Backend APIs:** Working with proper CORS configuration

### 🔧 Current Configuration:
- **ASPNETCORE_ENVIRONMENT:** Development (for datasource-management, metrics-configuration)
- **CORS:** Enabled for browser access
- **Message Bus:** InMemory (Kafka infrastructure ready but not used)
- **Port Forwards:** Frontend (8080), APIs (5001, 5002), MongoDB (27017)

---

## 📋 Recommended Testing Plan

### Phase 1: Connection Testing (30 min)

**Test each datasource connection type:**

```bash
# 1. Local File System
curl -X POST http://localhost:5001/api/v1/test-connection/folder \
  -H "Content-Type: application/json" \
  -d '{"folderPath": "/data/test"}'

# 2. SFTP Connection
curl -X POST http://localhost:5001/api/v1/test-connection/sftp \
  -H "Content-Type: application/json" \
  -d '{"host": "secure.example.com", "port": 22, "username": "test"}'

# 3. Kafka Connection
curl -X POST http://localhost:5001/api/v1/test-connection/kafka \
  -H "Content-Type: application/json" \
  -d '{"bootstrapServers": "kafka-0.kafka.ez-platform.svc.cluster.local:9092"}'
```

**Expected:** Green checkmarks in UI for successful connections

---

### Phase 2: File Discovery & Processing (45 min)

**Objective:** Test full pipeline from file discovery to output

**Steps:**

1. **Create Test Files in MongoDB:**
   ```bash
   # Create a simple test datasource with Local connection
   # Use frontend UI to create new datasource
   # Or use API directly
   ```

2. **Trigger File Discovery:**
   ```bash
   # Check FileDiscoveryService logs
   kubectl logs -f -l app=filediscovery -n ez-platform

   # Should see: "Polling datasource: [name]"
   # Should publish FileDiscoveredEvent
   ```

3. **Monitor File Processing:**
   ```bash
   # Watch FileProcessorService
   kubectl logs -f -l app=fileprocessor -n ez-platform

   # Should consume FileDiscoveredEvent
   # Should parse file and publish ValidationRequestEvent
   ```

4. **Verify Validation:**
   ```bash
   # Watch ValidationService
   kubectl logs -f -l app=validation -n ez-platform

   # Should validate records against schema
   # Should calculate metrics
   # Should publish ValidationCompletedEvent
   ```

5. **Check Output Generation:**
   ```bash
   # Watch OutputService
   kubectl logs -f -l app=output -n ez-platform

   # Should write validated records to Kafka
   # Should write to configured folder destinations
   ```

6. **Verify Invalid Records:**
   ```bash
   # Check InvalidRecordsService
   kubectl logs -f -l app=invalidrecords -n ez-platform

   # Should store invalid records for review
   ```

---

### Phase 3: Observability Stack (30 min)

**1. Jaeger - Distributed Tracing:**
```bash
kubectl port-forward svc/jaeger 16686:16686 -n ez-platform &
# Open: http://localhost:16686
# Select service: DataProcessing.*
# View traces for file processing pipeline
```

**2. Prometheus - Metrics:**
```bash
kubectl port-forward svc/prometheus-system 9090:9090 -n ez-platform &
# Open: http://localhost:9090
# Query: up{namespace="ez-platform"}
# Verify all services reporting metrics
```

**3. Grafana - Dashboards:**
```bash
kubectl port-forward svc/ezplatform-grafana 3000:3000 -n ez-platform &
# Open: http://localhost:3000
# Default credentials: admin/admin
# Import dashboards for:
#   - Service health metrics
#   - Business KPIs
#   - Data processing pipeline metrics
```

**4. OpenTelemetry Collector:**
```bash
kubectl logs -f -l app=otel-collector -n ez-platform
# Verify receiving:
# - Metrics from services (port 4317)
# - Traces from services
# - Logs being forwarded
```

---

### Phase 4: Message Bus Migration (Kafka) (60 min)

**Current State:** Using InMemory transport (fast but not persistent)
**Target:** Enable Kafka for cross-service messaging

**Services to Update:**
1. FileDiscoveryService (currently InMemory)
2. FileProcessorService (currently InMemory)
3. ValidationService (has Kafka config, disabled)
4. OutputService (has Kafka config, disabled)

**Steps:**

```bash
# 1. Update FileDiscoveryService to use Kafka
kubectl set env deployment/filediscovery MassTransit__UseKafka=true -n ez-platform

# 2. Update FileProcessorService to use Kafka
kubectl set env deployment/fileprocessor MassTransit__UseKafka=true -n ez-platform

# 3. Monitor for issues
kubectl get pods -n ez-platform -w

# 4. Check Kafka topics created
kubectl exec kafka-0 -n ez-platform -- kafka-topics.sh \
  --bootstrap-server localhost:9092 --list
```

**Expected Topics:**
- `file-discovered-events`
- `validation-request-events`
- `validation-completed-events`
- `invalid-record-events`

---

### Phase 5: Production Hardening (45 min)

**1. CORS Policies:**
```csharp
// Update all services to use specific origins instead of AllowAll
policy.WithOrigins(
    "http://localhost:8080",  // Development
    "https://ezplatform.yourdomain.com"  // Production
)
.AllowAnyMethod()
.AllowAnyHeader()
.AllowCredentials();
```

**2. Health Check Optimization:**
- Review probe timeouts (currently 15s for some services)
- Fine-tune based on actual startup times
- Remove unnecessary health checks

**3. Resource Limits:**
```bash
# Review and optimize resource requests/limits
kubectl top pods -n ez-platform
kubectl top nodes

# Adjust based on actual usage
```

**4. Persistent Volume Configuration:**
- Verify MongoDB PV retention policy
- Configure Kafka PV backup strategy
- Set up Elasticsearch data retention

**5. Security:**
- Enable MongoDB authentication
- Configure Kafka SASL/SSL
- Add API authentication/authorization
- Set up network policies

---

## 🎯 Session 5 Success Criteria

### Must Have:
1. ✅ Platform 100% operational (ACHIEVED!)
2. ⏳ Successfully test connection to at least 2 datasource types
3. ⏳ Process at least 1 file through complete pipeline
4. ⏳ Verify metrics calculated and stored
5. ⏳ View traces in Jaeger for end-to-end flow

### Nice to Have:
- Access Grafana dashboards
- Enable Kafka message bus
- Configure production CORS policies
- Performance baseline measurements
- Create operational runbook

---

## 🚀 Quick Start Commands for Session 5

```bash
# 1. Start Minikube (if not running)
minikube start --driver=docker

# 2. Verify all services
kubectl get pods -n ez-platform
# All should be 1/1 Running

# 3. Start all port-forwards
kubectl port-forward svc/frontend 8080:80 -n ez-platform &
kubectl port-forward svc/datasource-management 5001:5001 -n ez-platform &
kubectl port-forward svc/metrics-configuration 5002:5002 -n ez-platform &
kubectl port-forward svc/jaeger 16686:16686 -n ez-platform &
kubectl port-forward svc/prometheus-system 9090:9090 -n ez-platform &
kubectl port-forward svc/ezplatform-grafana 3000:3000 -n ez-platform &

# 4. Access UIs
# Frontend: http://localhost:8080
# Jaeger: http://localhost:16686
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000
```

---

## 📁 Current Environment State

**Services in Development Mode (CORS enabled):**
- datasource-management
- metrics-configuration

**Services in Production Mode:**
- filediscovery
- fileprocessor
- validation
- output
- invalidrecords
- scheduling

**Message Bus:**
- Current: InMemory (all services)
- Available: Kafka cluster ready at `kafka-0.kafka.ez-platform.svc.cluster.local:9092`

**Databases:**
- MongoDB: `ezplatform` database with demo data
- Elasticsearch: Available for log storage (optional)

---

## 🎊 Platform Achievement Summary

```
✅ Infrastructure Deployment:        100%
✅ Service Deployment:                100%
✅ Database Population:               100%
✅ Frontend Integration:              100%
✅ Backend API Integration:           100%
✅ CORS Configuration:                100%
⏳ E2E Testing:                        0%
⏳ Observability Verification:        0%
⏳ Kafka Message Bus:                 0%
⏳ Production Hardening:               0%

Overall Progress: ~75% to Production-Ready
```

---

## 🏆 Next Milestone

**From 100% Operational to Production-Ready:**
- Complete E2E testing of all data processing flows
- Verify observability stack (Jaeger, Prometheus, Grafana)
- Enable Kafka message bus for inter-service communication
- Harden security and configuration
- Create operational documentation

**Target:** Production deployment with full observability and testing coverage!
