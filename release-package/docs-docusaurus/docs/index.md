---
sidebar_position: 1
title: Welcome
slug: /
---

# EZ Platform v0.1.1-rc2 Documentation

Welcome to the official documentation for EZ Platform version 0.1.1-rc1.

## About This Release

EZ Platform is an enterprise data processing system with automated file discovery, format conversion, schema validation, and multi-destination output capabilities.

**Release Date:** January 6, 2026
**Status:** Release Candidate 1
**Version:** 0.1.1-rc1

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

**Documentation Version:** 1.1
**Platform Version:** v0.1.1-rc2
**Last Updated:** January 6, 2026
