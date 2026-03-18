---
sidebar_position: 1
---

# EZ Platform - System Architecture

> **Executive Architecture Overview**
> Data Processing & Validation Platform
> Status: Production Release (v0.2.0)

---

## System Overview

EZ Platform is a microservices-based data processing platform that provides:
- **File Discovery** - Automated polling and deduplication
- **Format Conversion** - CSV, XML, Excel, JSON support
- **Schema Validation** - JSON Schema 2020-12 compliance
- **Multi-Destination Output** - Local, SFTP, HTTP, Message Queues
- **Full Observability** - Metrics, Logs, Traces, Dashboards

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    EZ PLATFORM ARCHITECTURE                                  │
│                              Data Processing & Validation Platform                           │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

                                         ┌──────────────┐
                                         │    USERS     │
                                         │  (Browser)   │
                                         └──────┬───────┘
                                                │
                                    ════════════╪════════════
                                         HTTP/HTTPS
                                    ════════════╪════════════
                                                │
┌───────────────────────────────────────────────▼───────────────────────────────────────────────┐
│                                     PRESENTATION LAYER                                         │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│    ┌────────────────────────────────┐          ┌─────────────────────────────────────────┐   │
│    │      REACT 19 FRONTEND         │          │         NGINX INGRESS                   │   │
│    │  ├─ TypeScript + Ant Design   │◄─────────►│  ├─ Path-based routing                 │   │
│    │  ├─ RTL/Hebrew Support        │          │  ├─ CORS enabled                        │   │
│    │  ├─ React Query (TanStack)    │          │  └─ ezplatform.local                    │   │
│    │  └─ i18next Internationalization        └─────────────────────────────────────────┘   │
│    │                                │                                                        │
│    │  PAGES:                        │                                                        │
│    │  • Dashboard        • Metrics  │                                                        │
│    │  • Data Sources     • Alerts   │                                                        │
│    │  • Invalid Records  • Schemas  │                                                        │
│    └────────────────────────────────┘                                                        │
│                                                                                                │
└────────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                                 │ REST APIs
┌────────────────────────────────────────────────▼──────────────────────────────────────────────┐
│                                     API / MANAGEMENT LAYER                                     │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│   ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐               │
│   │  DATASOURCE MGMT     │  │  METRICS CONFIG      │  │  INVALID RECORDS     │               │
│   │  Service (5001)      │  │  Service (5002)      │  │  Service (5006)      │               │
│   │                      │  │                      │  │                      │               │
│   │ • CRUD Datasources   │  │ • Metric Definitions │  │ • Error Tracking     │               │
│   │ • Schema Management  │  │ • Alert Rules        │  │ • Record Correction  │               │
│   │ • Connection Testing │  │ • PromQL Queries     │  │ • Reprocessing       │               │
│   └──────────┬───────────┘  └──────────────────────┘  └──────────────────────┘               │
│              │                                                                                │
│   ┌──────────▼───────────┐                                                                   │
│   │  SCHEDULING          │  ← Quartz.NET Scheduler                                           │
│   │  Service (5004)      │  ← Cron-based Polling                                             │
│   │  • Job Orchestration │  ← MongoDB Job Store                                              │
│   └──────────┬───────────┘                                                                   │
│              │                                                                                │
└──────────────┼────────────────────────────────────────────────────────────────────────────────┘
               │ MassTransit on RabbitMQ
┌──────────────▼────────────────────────────────────────────────────────────────────────────────┐
│                              DATA PROCESSING PIPELINE                                          │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│   ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐      ┌─────────────┐ │
│   │ FILE DISCOVERY  │      │ FILE PROCESSOR  │      │   VALIDATION    │      │   OUTPUT    │ │
│   │ Service (5007)  │─────►│ Service (5008)  │─────►│  Service (5003) │─────►│   Service   │ │
│   │                 │      │                 │      │                 │      │   (5009)    │ │
│   │ • Poll folders  │      │ • Format detect │      │ • JSON Schema   │      │             │ │
│   │ • Deduplication │      │ • CSV/XML/Excel │      │   validation    │      │ • Local     │ │
│   │   (file hashes) │      │ • JSON convert  │      │ • Business rules│      │ • SFTP      │ │
│   │ • 2 replicas    │      │ • 2 replicas    │      │ • Metrics calc  │      │ • HTTP API  │ │
│   └────────┬────────┘      └────────┬────────┘      └────────┬────────┘      │ • 3 replicas│ │
│            │                        │                        │               └──────┬──────┘ │
│            │                        │                        │                      │        │
│   ═════════╪════════════════════════╪════════════════════════╪══════════════════════╪═════   │
│            │   RABBITMQ MESSAGE BUS  │   (Event-Driven)       │                      │        │
│   ═════════╪════════════════════════╪════════════════════════╪══════════════════════╪═════   │
│            │                        │                        │                      │        │
│    Topics: │                        │                        │                      │        │
│    ├─ filepolling ──────────────────┘                        │                      │        │
│    ├─ filesreceiver.validationrequest ───────────────────────┘                      │        │
│    ├─ validation.completed ─────────────────────────────────────────────────────────┘        │
│    └─ global.processingfailed (error handling)                                               │
│                                                                                                │
└───────────────────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                              DISTRIBUTED INFRASTRUCTURE                                        │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│   ┌────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                             MESSAGE & CACHE LAYER                                       │  │
│   ├────────────────────────────────────────────────────────────────────────────────────────┤  │
│   │                                                                                         │  │
│   │   ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐           │  │
│   │   │    RABBITMQ     │        │    HAZELCAST    │        │                 │           │  │
│   │   │   (2 brokers)   │        │  (Distributed   │        │  (Alternative   │           │  │
│   │   │                 │        │     Cache)      │        │   Messaging)    │           │  │
│   │   │ • 9092 internal │        │                 │        │                 │           │  │
│   │   │ • 9094 external │        │ • file-content  │        │ • 5672 AMQP     │           │  │
│   │   │ + ZooKeeper     │        │ • valid-records │        │ • 15672 UI      │           │  │
│   │   │                 │        │ • file-hashes   │        │                 │           │  │
│   │   └─────────────────┘        └─────────────────┘        └─────────────────┘           │  │
│   │                                                                                         │  │
│   └────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                │
│   ┌────────────────────────────────────────────────────────────────────────────────────────┐  │
│   │                              DATA PERSISTENCE LAYER                                     │  │
│   ├────────────────────────────────────────────────────────────────────────────────────────┤  │
│   │                                                                                         │  │
│   │   ┌─────────────────────────────────────────────────────────────────────────────────┐  │  │
│   │   │                           MONGODB (Replica Set)                                  │  │  │
│   │   │                              Port: 27017                                         │  │  │
│   │   │                                                                                  │  │  │
│   │   │   Collections:                                                                   │  │  │
│   │   │   ├─ DataSources        (configuration & schemas)                               │  │  │
│   │   │   ├─ ValidationResults  (processing audit trail)                                │  │  │
│   │   │   ├─ InvalidRecords     (failed validations)                                    │  │  │
│   │   │   ├─ MetricDefinitions  (business metrics)                                      │  │  │
│   │   │   ├─ Schedules          (Quartz job store)                                      │  │  │
│   │   │   └─ Schemas            (JSON Schema 2020-12)                                   │  │  │
│   │   │                                                                                  │  │  │
│   │   │   Storage: 20Gi x 2 nodes  |  2Gi RAM each  |  Replica set: rs0                │  │  │
│   │   └─────────────────────────────────────────────────────────────────────────────────┘  │  │
│   │                                                                                         │  │
│   │   ┌─────────────────────────────┐        ┌─────────────────────────────┐              │  │
│   │   │    DATA INPUT VOLUME        │        │    DATA OUTPUT VOLUME       │              │  │
│   │   │         (50Gi)              │        │         (100Gi)             │              │  │
│   │   │                             │        │                             │              │  │
│   │   │   /data/input               │        │   /data/output              │              │  │
│   │   │   • Source files (CSV,XML)  │        │   • Exported files          │              │  │
│   │   │   • ReadWriteMany           │        │   • Multi-destination       │              │  │
│   │   └─────────────────────────────┘        └─────────────────────────────┘              │  │
│   │                                                                                         │  │
│   └────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                │
└───────────────────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                OBSERVABILITY STACK                                             │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│                                ┌─────────────────────────┐                                    │
│                                │    OTEL COLLECTOR       │                                    │
│                                │   (Central Telemetry)   │                                    │
│                                │   Ports: 4317/4318      │                                    │
│                                └────────────┬────────────┘                                    │
│                                             │                                                 │
│          ┌──────────────────────────────────┼──────────────────────────────────┐             │
│          │                                  │                                  │              │
│          ▼                                  ▼                                  ▼              │
│  ┌───────────────────┐           ┌──────────────────┐           ┌─────────────────────┐      │
│  │ PROMETHEUS (Dual) │           │   ELASTICSEARCH  │           │      JAEGER         │      │
│  │                   │           │                  │           │                     │      │
│  │ System: 9090      │           │   Port: 9200     │           │  UI: 16686          │      │
│  │ Business: 9091    │           │                  │           │  Collector: 4317    │      │
│  │                   │           │  • Logs index    │           │                     │      │
│  │ • Infrastructure  │           │  • Traces index  │           │  • Distributed      │      │
│  │   metrics         │           │  • Jaeger spans  │           │    tracing          │      │
│  │ • Business KPIs   │           │                  │           │  • Span analysis    │      │
│  │ • 50Gi storage    │           │                  │           │                     │      │
│  └─────────┬─────────┘           └──────────────────┘           └─────────────────────┘      │
│            │                                ▲                                                 │
│            │                                │                                                 │
│            ▼                      ┌─────────┴──────────┐                                     │
│  ┌───────────────────┐            │    FLUENT BIT      │                                     │
│  │     GRAFANA       │            │   (DaemonSet)      │                                     │
│  │                   │            │                    │                                     │
│  │  UI: 3000/3001    │            │  • Container logs  │                                     │
│  │                   │            │  • K8s enrichment  │                                     │
│  │ Dashboards:       │            │  • JSON parsing    │                                     │
│  │ • Business Metrics│            └────────────────────┘                                     │
│  │ • Infrastructure  │                                                                       │
│  │ • RabbitMQ Queues │                                                                       │
│  └───────────────────┘                                                                       │
│                                                                                                │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## NAS/NFS Storage Architecture

### Overview

EZ Platform v0.2.0 introduces dynamic NAS device management, enabling administrators to configure Network Attached Storage devices that are automatically provisioned as Kubernetes PersistentVolumes.

Key capabilities:
- **Dynamic PV/PVC creation** via Kubernetes API
- **NFS protocol** for network file access
- **Role-based device assignment** (Input/Output/Both/Backup)
- **Real-time mount status monitoring**
- **Connection testing** before provisioning

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NAS DEVICE ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐           ┌──────────────────────┐           ┌──────────────┐
  │   Admin UI   │           │    DataSource        │           │   K8s API    │
  │   (React)    │──────────►│    Management        │──────────►│   Server     │
  │              │   REST    │    Service (5001)    │   K8s     │              │
  └──────────────┘   API     └──────────────────────┘   Client  └──────────────┘
         │                            │                              │
         │ CRUD                       │ Provision                    │ Create
         │ Operations                 │ Request                      │ PV/PVC
         ▼                            ▼                              ▼
  ┌──────────────┐           ┌──────────────────────┐           ┌──────────────┐
  │   MongoDB    │           │   NasResource        │           │  NFS Mount   │
  │  (NasDevice) │           │   Service            │           │  in Pods     │
  └──────────────┘           └──────────────────────┘           └──────────────┘
         │                                                            │
         │                    ┌──────────────────────┐                │
         └───────────────────►│   File Processing    │◄───────────────┘
                              │   Services           │
                              │   (Discovery,        │
                              │    Processor)        │
                              └──────────────────────┘
```

### NasDevice Entity

The `NasDevice` entity stores NAS device configuration and provisioning status:

| Field | Type | Description |
|-------|------|-------------|
| Name | string | Display name for the NAS device |
| Host | string | NFS server hostname or IP address |
| Port | int | NFS server port (default: 2049) |
| ExportPath | string | NFS export path (e.g., `/exports/data`) |
| Role | enum | Input, Output, Both, or Backup |
| StorageCapacity | string | Storage size (e.g., "100Gi") |
| AccessMode | string | ReadWriteOnce, ReadOnlyMany, ReadWriteMany |
| MountOptions | List&lt;string&gt; | NFS mount options (nfsvers, tcp, hard, intr) |
| IsPvCreated | bool | PersistentVolume created in K8s |
| IsPvcBound | bool | PersistentVolumeClaim bound to PV |
| IsActive | bool | Device enabled for use |

**Computed Properties:**
- `PvName`: `{name-lowercase}-pv`
- `PvcName`: `{name-lowercase}-pvc`
- `MountPath`: `/mnt/{name-lowercase}`
- `IsProvisioned`: `IsPvCreated && IsPvcBound`
- `CanBeInput`: Role is Input or Both
- `CanBeOutput`: Role is Output or Both

### Device Roles

| Role | Color | Input | Output | Use Case |
|------|-------|-------|--------|----------|
| **Input** | Blue | Yes | No | Source files for processing |
| **Output** | Green | No | Yes | Processed file destination |
| **Backup** | Orange | No | Yes | Archive/backup storage |
| **Both** | Purple | Yes | Yes | General purpose storage |

### Provisioning Workflow

1. **Admin creates NasDevice** via UI or API (saved to MongoDB)
2. **Admin clicks "Provision"** button in UI
3. **NasResourceService creates PersistentVolume**:
   ```yaml
   apiVersion: v1
   kind: PersistentVolume
   metadata:
     name: nfs-pv-{deviceName}
   spec:
     capacity:
       storage: {storageCapacity}
     accessModes:
       - {accessMode}
     nfs:
       server: {host}
       path: {exportPath}
     mountOptions:
       - nfsvers=3
       - tcp
       - hard
       - intr
   ```
4. **NasResourceService creates PersistentVolumeClaim**:
   ```yaml
   apiVersion: v1
   kind: PersistentVolumeClaim
   metadata:
     name: nfs-pvc-{deviceName}
     namespace: ez-platform
   spec:
     accessModes:
       - {accessMode}
     resources:
       requests:
         storage: {storageCapacity}
     volumeName: nfs-pv-{deviceName}
   ```
5. **Status updated** in MongoDB: `IsPvCreated=true`, `IsPvcBound=true`
6. **File processing pods** can now mount the PVC at `/mnt/{deviceName}`

### RBAC Requirements

The DataSourceManagement service requires Kubernetes RBAC permissions to manage PV/PVC resources:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: nas-device-manager
rules:
- apiGroups: [""]
  resources: ["persistentvolumes"]
  verbs: ["create", "get", "list", "delete", "watch"]
- apiGroups: [""]
  resources: ["persistentvolumeclaims"]
  verbs: ["create", "get", "list", "delete", "watch"]
```

**Applied via:** `k8s/rbac/nas-device-rbac.yaml`

### NAS Device API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/nasdevices` | List all NAS devices |
| GET | `/api/v1/nasdevices/{id}` | Get NAS device by ID |
| POST | `/api/v1/nasdevices` | Create new NAS device |
| PUT | `/api/v1/nasdevices/{id}` | Update NAS device |
| DELETE | `/api/v1/nasdevices/{id}` | Delete NAS device |
| POST | `/api/v1/nasdevices/{id}/provision` | Provision K8s resources |
| POST | `/api/v1/nasdevices/{id}/deprovision` | Remove K8s resources |
| POST | `/api/v1/nasdevices/{id}/test` | Test NFS connection |

### Using NAS in Data Sources

When creating a data source with NAS protocol:

1. Select **NAS** as the connection type
2. Choose a provisioned NAS device from the dropdown
3. Specify a **relative path** within the NAS export
4. The system computes the full mount path: `{MountPath}/{relativePath}`

**Example:**
- NAS Device: "Production-NAS-01" with ExportPath `/exports/data`
- Relative Path: `sales/2026`
- Full Path in Pod: `/mnt/production-nas-01/sales/2026`

**See also:** [Administrator Guide](/admin) for NAS device management procedures.

---

## End-to-End Data Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              END-TO-END DATA PIPELINE                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘

  SOURCE FILES                PROCESSING PIPELINE                    DESTINATIONS
  ═══════════                 ═══════════════════                    ════════════

  ┌─────────┐     ┌──────────────────────────────────────────────────────┐     ┌─────────┐
  │  CSV    │     │                                                      │     │  Local  │
  │  XML    │────►│  DISCOVER ───► CONVERT ───► VALIDATE ───► OUTPUT    │────►│  Files  │
  │  Excel  │     │     │            │             │            │        │     └─────────┘
  │  JSON   │     │     │            │             │            │        │     ┌─────────┐
  └─────────┘     │     ▼            ▼             ▼            │        │────►│  SFTP   │
                  │  Hazelcast   Hazelcast    Hazelcast        │        │     └─────────┘
      50Gi        │  (hashes)    (content)   (valid-records)   │        │     ┌─────────┐
      INPUT       │                                             │        │────►│ HTTP    │
                  │     ▲            ▲             ▲            │        │     │  APIs   │
                  │     │            │             │            │        │     └─────────┘
                  │     └────────────┴─────────────┘            │        │     ┌─────────┐
                  │            RABBITMQ                         │        │────►│ Message │
                  │         (Event-Driven)                      │        │     │ Queues  │
                  │                                             │        │     └─────────┘
                  │              ERRORS ──────────────────────────────►  INVALID RECORDS
                  │                                             │              (MongoDB)
                  └──────────────────────────────────────────────┘             100Gi
                                                                              OUTPUT
```

### Pipeline Stages

| Stage | Service | Input | Output | Cache |
|-------|---------|-------|--------|-------|
| **1. Discover** | FileDiscovery (5007) | Folder poll trigger | FileDiscoveredEvent | file-hashes |
| **2. Convert** | FileProcessor (5008) | Raw file (CSV/XML/Excel/JSON) | JSON records | file-content |
| **3. Validate** | Validation (5003) | JSON records + Schema | Valid/Invalid records | valid-records |
| **4. Output** | Output (5009) | Valid records | Multi-destination export | - |

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | React + TypeScript | 19.0 | UI with RTL/Hebrew support |
| **UI Framework** | Ant Design | 5.x | Component library |
| **Backend** | .NET | 10.0 | Microservices |
| **Messaging** | RabbitMQ + MassTransit | - | Event-driven communication |
| **Cache** | Hazelcast | - | Distributed caching |
| **Database** | MongoDB | - | Document storage |
| **Validation** | Corvus.JsonSchema | 2020-12 | Schema validation |
| **Scheduling** | Quartz.NET | - | Job orchestration |
| **Orchestration** | Kubernetes | - | Container orchestration |
| **Metrics** | Prometheus (Dual) | - | System & Business metrics |
| **Tracing** | Jaeger + OTEL | - | Distributed tracing |
| **Logs** | Elasticsearch + Fluent Bit | - | Centralized logging |
| **Visualization** | Grafana | - | Dashboards |

---

## Microservices Overview

| Service | Port | Replicas | Primary Responsibility |
|---------|------|----------|------------------------|
| **Frontend** | 3000 | 2 | React UI with Hebrew/RTL support |
| **DataSource Management** | 5001 | 1 | Configuration & Schema CRUD |
| **Metrics Configuration** | 5002 | 1 | Metric definitions & alerts |
| **Validation** | 5003 | 1 | JSON Schema 2020-12 validation |
| **Scheduling** | 5004 | 1 | Cron-based job orchestration |
| **Invalid Records** | 5006 | 1 | Error tracking & reprocessing |
| **File Discovery** | 5007 | 2 | File polling & deduplication |
| **File Processor** | 5008 | 2 | Multi-format conversion |
| **Output** | 5009 | 3 | Multi-destination export |

---

## RabbitMQ Message Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RABBITMQ QUEUES & EVENTS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Topic: dataprocessing.scheduling.filepolling                               │
│  ├─ Producer: Scheduling Service (Quartz)                                  │
│  └─ Consumer: FileDiscovery Service                                        │
│                                                                              │
│  Topic: dataprocessing.filesreceiver.validationrequest                     │
│  ├─ Producer: FileProcessor Service                                        │
│  └─ Consumer: Validation Service                                           │
│                                                                              │
│  Topic: dataprocessing.validation.completed                                │
│  ├─ Producer: Validation Service                                           │
│  └─ Consumers: Output Service, InvalidRecords Service                      │
│                                                                              │
│  Topic: dataprocessing.global.processingfailed                             │
│  ├─ Producer: Any service on error                                         │
│  └─ Consumer: Error handling                                               │
│                                                                              │
│  Note: Internal (9092) for pod-to-pod | External (9094) for development    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Business Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `business_records_processed_total` | Counter | Total records successfully processed |
| `business_invalid_records_total` | Counter | Records that failed validation |
| `business_files_processed_total` | Counter | Total files processed |
| `business_processing_duration_seconds` | Histogram | Time to process each file |
| `business_end_to_end_latency_seconds` | Histogram | Total pipeline latency |

### Metric Labels
- `data_source` - Source identifier
- `service` - Processing service name
- `status` - Processing status (success/failure)
- `file_type` - Input format (CSV/XML/Excel/JSON)
- `pipeline_stage` - Processing stage

---

## Kubernetes Deployment

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     KUBERNETES CLUSTER (Minikube)                        │
│                         Namespace: ez-platform                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   DEPLOYMENTS (Stateless)              STATEFULSETS (Stateful)          │
│   ═══════════════════════              ════════════════════════          │
│   • Frontend (2)                       • MongoDB (2 nodes)              │
│   • DataSource Management (1)          • RabbitMQ              │
│   • Metrics Configuration (1)          • ZooKeeper (1)                  │
│   • Validation (1)                     • Hazelcast (1)                  │
│   • Scheduling (1)                                                       │
│   • Invalid Records (1)                DAEMONSETS                        │
│   • File Discovery (2)                 ═══════════                       │
│   • File Processor (2)                 • Fluent Bit (all nodes)         │
│   • Output (3)                                                           │
│   • OTEL Collector (1)                 SERVICES                          │
│   • Prometheus System (1)              ════════                          │
│   • Prometheus Business (1)            • ClusterIP (internal)           │
│   • Grafana (1)                        • LoadBalancer (Frontend)        │
│   • Jaeger (1)                         • Ingress (NGINX)                │
│   • Elasticsearch (1)                                                    │
│   • RabbitMQ (1)                                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Resource Requirements

| Environment | CPU | Memory | Notes |
|-------------|-----|--------|-------|
| **Development** | ~12 cores | 32Gi RAM | Minikube single-node |
| **Production** | ~20+ cores | 64Gi+ RAM | HA with redundancy |

---

## Observability Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OBSERVABILITY PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   All Services (OTEL SDK)  →  OTEL Collector (4317/4318)                    │
│                               ├→ Prometheus System (9090) → System Metrics  │
│                               ├→ Prometheus Business (9091) → Business KPIs │
│                               ├→ Elasticsearch (9200) → Logs & Traces      │
│                               └→ Jaeger (16686) → Distributed Tracing      │
│                                                                              │
│   Container Logs  →  Fluent Bit (DaemonSet)  →  Elasticsearch              │
│                                                                              │
│   All Sources  →  Grafana (3000)  →  Dashboards                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Monitoring URLs (after port-forwarding)

| Service | URL | Purpose |
|---------|-----|---------|
| **Grafana** | localhost:3001 | Dashboards (admin/admin) |
| **Jaeger** | localhost:16686 | Distributed tracing |
| **Prometheus System** | localhost:9090 | Infrastructure metrics |
| **Prometheus Business** | localhost:9091 | Business metrics |
| **Elasticsearch** | localhost:9200 | Logs & trace storage |

---

## Critical Infrastructure Items

| Priority | Issue | Status | Action Required |
|----------|-------|--------|-----------------|
| **Critical** | Grafana hardcoded credentials | ⚠️ Open | Move to K8s Secret |
| **Critical** | Jaeger persistence | ✅ Fixed | Elasticsearch backend configured |
| **High** | Elasticsearch security | ⚠️ Open | Enable xpack.security |
| **High** | MongoDB backup strategy | ⚠️ Open | Implement automated backups |
| **Medium** | RabbitMQ clustering | ⚠️ Dev only | Configure HA for production |

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| File processing | &lt;1s per 100-record file | Standard file sizes |
| Cache hit rate | &gt;95% | Hazelcast efficiency |
| Service startup | &lt;5s | Container readiness |
| P99 API latency | &lt;500ms | End-user experience |

---

## Key Features

- **9 microservices** implementing the complete data processing pipeline
- **Event-driven architecture** using RabbitMQ for loose coupling
- **Distributed caching** with Hazelcast for high performance
- **Full observability** with Prometheus, Grafana, Jaeger, and Elasticsearch
- **Multi-format support** (CSV, XML, Excel, JSON)
- **Multi-destination output** (Local, SFTP, HTTP, Message Queues)
- **Hebrew/RTL support** in the React frontend
- **Kubernetes-native deployment** with proper scaling strategies
- **JSON Schema 2020-12** validation with Corvus validator
- **Business metrics** extraction and alerting
- **SignalR real-time monitoring** via WebSocket connections
- **Device health monitoring** with automated Quartz.NET checks
- **Full OTEL verification** across all 8 microservices (24/24 checks)

---

## v0.2.0 Architecture Additions

### SignalR Real-Time Communication

In addition to REST APIs, RabbitMQ events, and Kafka messaging, v0.2.0 adds **SignalR WebSocket** as a fourth communication pattern:

```
Frontend (React) <──WebSocket──> MonitoringHub (/hubs/monitoring)
                                      ^
                                      |
                              MonitoringBroadcaster
                              (Hosted Service, Singleton)
                                      |
                    ┌─────────────────┼─────────────────┐
                    v                 v                  v
              Service Health     Kafka Status      Device Health
              (5s interval)     (5s interval)     (30s interval)
```

The `MonitoringHub` receives broadcasts from the `MonitoringBroadcaster` hosted service, which gathers data from multiple sources at two speeds (5-second fast, 30-second slow).

### OTEL Pipeline

All 8 deployed microservices report telemetry through the OTEL Collector:

```
Application Services (Serilog + OTEL SDK)
         |
         v
    OTEL Collector (4317 gRPC / 4318 HTTP)
    ├── Prometheus System (9090)  → Infrastructure metrics
    ├── Prometheus Business (9091) → Business KPIs
    ├── Elasticsearch (9200)      → Structured logs (dataprocessing-logs index)
    └── Jaeger (16686)            → Distributed traces

Infrastructure Containers (MongoDB, Kafka, etc.)
         |
         v
    Fluent Bit DaemonSet → Elasticsearch (ez-logs-YYYY.MM.DD index)
```

### Device Health Subsystem

```
Quartz.NET Job (30s interval)
         |
         v
    DeviceHealthService
    ├── Check NAS devices (NFS connectivity, latency)
    └── Check AdminServers (protocol connectivity, latency)
         |
         v
    MongoDB (TTL history for uptime calculation)
         |
         v
    REST API: GET /api/v1/health-status
         |
         v
    Frontend (15s React Query polling + SignalR real-time)
```

Consecutive failure tracking: 0 = Healthy, 1-2 = Degraded, 3+ = Down.

---

*Generated: March 2026 | EZ Platform v0.2.0 | Production Release*
