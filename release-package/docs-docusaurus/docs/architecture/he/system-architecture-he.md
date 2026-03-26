---
sidebar_position: 1
---

# EZ Platform - System Architecture

> **Executive Architecture Overview**
> Data Processing & Validation Platform
> Status: Production Release (v0.4.0, March 2026)

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
│            │  RABBITMQ MESSAGE BUS  │   (Event-Driven)       │                      │        │
│   ═════════╪════════════════════════╪════════════════════════╪══════════════════════╪═════   │
│            │                        │                        │                      │        │
│   Queues: │                        │                        │                      │        │
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
│  Queue: dataprocessing.scheduling.filepolling                              │
│  ├─ Producer: Scheduling Service (Quartz)                                  │
│  └─ Consumer: FileDiscovery Service                                        │
│                                                                              │
│  Queue: dataprocessing.filesreceiver.validationrequest                     │
│  ├─ Producer: FileProcessor Service                                        │
│  └─ Consumer: Validation Service                                           │
│                                                                              │
│  Queue: dataprocessing.validation.completed                                │
│  ├─ Producer: Validation Service                                           │
│  └─ Consumers: Output Service, InvalidRecords Service                      │
│                                                                              │
│  Queue: dataprocessing.global.processingfailed                             │
│  ├─ Producer: Any service on error                                         │
│  └─ Consumer: Error handling                                               │
│                                                                              │
│  Note: AMQP (5672) for services | Management UI (15672) for development   │
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
│   • DataSource Management (1)          • RabbitMQ (1)                   │
│   • Metrics Configuration (1)          • Hazelcast (1)                  │
│   • Validation (1)                                                       │
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
| **Medium** | RabbitMQ clustering | ⚠️ Dev only | Add HA mirrors for production |

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
- **SignalR real-time** multi-user synchronization (v0.3.0)
- **Device health monitoring** with automated checks (v0.3.0)
- **NAS device management** with auto PV/PVC provisioning (v0.2.0)

---

## v0.4.0 - תכונות חדשות

### שכפול מקור נתונים (Clone Datasource)

שכפול מקור נתונים מאפשר יצירת עותק מלא של מקור נתונים קיים כולל כל ההגדרות: סכמה, חיבור, הגדרות ארכיון ויעדי פלט.

### ייבוא מקובץ (Import from File)

ייבוא מקובץ מאפשר יצירה אוטומטית של מקור נתונים מקובץ דוגמה (CSV, JSON, XML, Excel). תמיכה בארכיונים (ZIP, TAR.GZ, 7Z, RAR) כולל ארכיונים מוצפנים באמצעות Archive API ו-SharpCompress בצד השרת.

**נקודות קצה של Archive API:**
- `POST /api/v1/archive/analyze` - ניתוח תוכן ארכיון
- `POST /api/v1/archive/extract` - חילוץ קובץ מתוך ארכיון

### שלמות מקור נתונים (Completeness Checklist)

רשימת שלמות בזמן אמת עם מעקב אחר התקדמות, גבולות שדות מקודדי צבע, ומנגנון השבתה אוטומטית למקורות נתונים שלא עומדים בסף השלמות הנדרש.

---

## v0.3.0 - תכונות חדשות

### עדכונים בזמן אמת עם SignalR

כל פעולות CRUD משדרות אירועי EntityChanged דרך WebSocket לכל הלקוחות המחוברים. מיושם על: DataSource, Servers, Categories, NasDevices.

### ניטור בריאות התקנים (Device Health)

בדיקות בריאות אוטומטיות באמצעות Quartz.NET כל 30 שניות. מעקב אחר כשלים רצופים: 0=תקין, 1-2=מדורג, 3+=מנותק.

### שיפורי NAS UX

- מחיקה אוטומטית של PV/PVC בעת מחיקת התקן NAS
- תגיות סטטוס בעברית ובאנגלית (i18n)

---

*Generated: March 2026 | EZ Platform v0.4.0 | Production Release*
