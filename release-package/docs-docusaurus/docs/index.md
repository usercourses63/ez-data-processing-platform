---
sidebar_position: 1
title: Welcome
slug: /
---

# EZ Platform v0.4.0 Documentation

Welcome to the official documentation for EZ Platform version 0.4.0.

## About This Release

EZ Platform is an enterprise data processing system with automated file discovery, format conversion, schema validation, and multi-destination output capabilities.

**Release Date:** March 2026
**Status:** Release
**Version:** 0.4.0

---

## What's New in v0.4.0

This release adds three datasource productivity features:

- **[Clone Datasource](release-notes#clone-datasource)** -- Duplicate any datasource with all settings preserved (schema, connection, archive, output destinations). Available from list page and edit page.
- **[Import from File](release-notes#import-from-file)** -- Upload CSV, JSON, XML, or Excel files (including archives: ZIP, TAR.GZ, 7Z, RAR) to auto-create datasources with smart schema inference.
- **[Completeness Checklist](release-notes#completeness-checklist)** -- Real-time form completion tracking with color-coded indicators, per-tab status, and auto-disable for incomplete datasources.

See the full **[Release Notes](release-notes)** for migration notes and known limitations.

---

## Quick Navigation

### 🚀 Getting Started
- **[Installation Guide](installation)** - Complete deployment instructions
- **[Helm Installation](installation/helm-installation)** - Kubernetes deployment with Helm
- **[Quick Start](installation#quick-start)** - Get up and running in minutes

### 🔧 Administration
- **[Admin Guide](admin)** - System administration and maintenance
- **[Category Management](admin#category-management)** - Manage datasource categories
- **[Monitoring](admin#monitoring--alerts)** - Grafana, Prometheus, Jaeger
- **[Maintenance Tools](admin#maintenance-tools--utilities)** - Reset, backup, utilities

### 📖 User Documentation
- **[Hebrew User Guide](user-guide-he)** - מדריך מלא בעברית

### 🏗️ Architecture
- **[System Architecture](architecture/system-architecture)** - Complete system design
- **[Architecture (Hebrew)](architecture/he/system-architecture-he)** - ארכיטקטורת המערכת

### 🚢 Deployment
- **[Deployment Plan](deployment/deployment-plan)** - Production deployment guide
- **[Success Summary](deployment/deployment-success-summary)** - Deployment checklist
- **[Troubleshooting](deployment/deployment-troubleshooting-guide)** - Common issues

### 📚 Reference
- **[Release Notes](release-notes)** - What's new and technical specifications
- **[Changelog](changelog)** - Version history and changes

---

## Key Features

- ✅ **Admin Category Management** - Hebrew/English bilingual categories
- ✅ **Smart Delete** - Intelligent category deletion with usage tracking
- ✅ **Multi-Source Discovery** - Local, SFTP, FTP, HTTP, Kafka
- ✅ **Format Conversion** - CSV, JSON, XML, Excel
- ✅ **Schema Validation** - JSON Schema 2020-12
- ✅ **Hebrew/RTL UI** - Complete right-to-left support
- ✅ **Network Access** - NodePort on 30080 for internal LAN
- ✅ **Comprehensive Monitoring** - Grafana dashboards, Prometheus metrics, Jaeger tracing
- ✅ **SignalR Real-Time Sync** - Live CRUD updates across all connected clients (v0.3.0)
- ✅ **NAS Auto-Deprovision** - Delete cleans up K8s PV/PVC automatically (v0.3.0)
- ✅ **RabbitMQ Queue Monitoring** - Internal queue health monitoring (v0.3.0)
- ✅ **Device Health Resilience** - HTTP polling fallback, dual-casing normalization (v0.3.0)
- ✅ **Clone Datasource** - One-click duplication with all settings preserved (v0.4.0)
- ✅ **Import from File** - Auto-create datasources from CSV/JSON/XML/Excel samples (v0.4.0)
- ✅ **Completeness Checklist** - Real-time form guidance with auto-disable (v0.4.0)
- ✅ **Archive Support** - ZIP, TAR.GZ, 7Z, RAR including encrypted archives (v0.4.0)

---

## Access URLs

**Production (Internal LAN):**
```
Frontend: http://<NODE-IP>:30080
Example: http://192.168.1.50:30080
```

**Development (localhost):**
```
Frontend: http://localhost:3000
Grafana: http://localhost:3001
Jaeger: http://localhost:16686
Prometheus: http://localhost:9090
```

---

## Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| Grafana | admin | EZPlatform2025!Beta |
| RabbitMQ Management | guest | guest |

---

## Support

For issues or questions, refer to:
- [Installation Guide](installation)
- [Admin Guide](admin)
- [Release Notes](release-notes)
- [Troubleshooting Guide](deployment/deployment-troubleshooting-guide)

---

**Documentation Version:** 4.0
**Platform Version:** v0.4.0
**Last Updated:** March 2026
