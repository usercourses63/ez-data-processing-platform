---
sidebar_position: 1
title: Development Guides
---

# Development Guides

Resources for EZ Platform frontend and backend development.

## Available Guides

### [API Coordination](/docs/development/api-coordination)

Process for coordinating frontend/backend API changes. Covers contract-first development, versioning strategy, and change communication.

### [React 19 Patterns](/docs/development/react19-patterns)

React 19 patterns and best practices used in EZ Platform. Includes lazy loading, hooks, RTL support, and common anti-patterns to avoid.

## Quick Links

| Resource | Location |
|----------|----------|
| Frontend Code | `src/Frontend/` |
| API Clients | `src/Frontend/src/services/*-api-client.ts` |
| Component Library | [/docs/components](/docs/components) |
| E2E Tests | `src/Frontend/tests/e2e/` |
| Backend Services | `src/Services/` |
| Shared Library | `src/Services/Shared/` |

## Development Setup

### Prerequisites

- Node.js 20+
- .NET 10.0 SDK
- Docker Desktop
- Minikube (for local Kubernetes)

### Quick Start

```bash
# 1. Start Kubernetes cluster
minikube start

# 2. Deploy all services
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/infrastructure/
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/

# 3. Start port forwarding (Windows PowerShell)
powershell.exe -ExecutionPolicy Bypass -File scripts/start-port-forwards.ps1

# 4. Start frontend dev server
cd src/Frontend
npm install
npm start
```

Access the application at: http://localhost:7000

### Key Ports

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 7000 | React UI |
| DataSourceManagement | 5001 | Primary API |
| Validation | 5003 | Schema validation |
| Grafana | 3001 | Monitoring |
| Jaeger | 16686 | Distributed tracing |

See `scripts/start-port-forwards.ps1` for the complete port list.

## Code Quality

### Frontend

- TypeScript strict mode enabled
- ESLint with React rules
- Prettier for formatting
- Playwright for E2E tests

### Backend

- C# nullable reference types
- XML documentation
- xUnit for testing
- OpenTelemetry for observability

## Related Documentation

- [Component Documentation](/docs/components) - UI component library
- [Architecture Guide](/docs/architecture/system-architecture) - System architecture
- [Deployment Guide](/docs/deployment/deployment-plan) - Deployment procedures
