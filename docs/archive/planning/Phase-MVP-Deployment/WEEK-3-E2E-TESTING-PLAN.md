# Week 3: Service Deployment & E2E Testing - Implementation Plan

**Week:** 3 of 5
**Duration:** 7 days
**MCP Task:** task-37
**Status:** 🔄 In Progress
**Start Date:** December 3, 2025 (Afternoon)

---

## Objectives

### Primary Goals
1. Build Docker images for all 9 microservices
2. Complete Helm chart for deployment management
3. Deploy complete system to Kubernetes
4. Execute all 6 E2E test scenarios
5. Achieve 90%+ E2E test pass rate

### Success Criteria
- [ ] All 9 service Docker images built
- [ ] Helm chart complete and functional
- [ ] All services deployed via Helm
- [ ] 19 pods running (10 infrastructure + 9 services)
- [ ] DemoDataGenerator works with K8s MongoDB
- [ ] All 6 E2E scenarios executed
- [ ] 90%+ pass rate (5 of 6 scenarios)
- [ ] Defects logged and critical ones fixed

---

## Architectural Decisions

### MongoDB Connection Strategy
**Choice:** Configurable DemoDataGenerator
- Command-line argument: `--mongodb-connection`
- Default: `localhost:27017` (backwards compatible)
- K8s: `mongodb.ez-platform:27017` OR port-forward

### Service Management Strategy
**Choice:** Helm-based orchestration
- Start: `helm install ez-platform ./helm/ez-platform`
- Stop: `helm uninstall ez-platform`
- Replaces ServiceOrchestrator for K8s

---

## Day 1: Docker Images & Helm Chart (6-8 hours)

### Morning: Dockerfiles (3 hours)

**Backend Services (8 Dockerfiles):**
```dockerfile
# Example: FileDiscoveryService
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["src/Services/FileDiscoveryService/", "FileDiscoveryService/"]
COPY ["src/Services/Shared/", "Shared/"]
RUN dotnet restore "FileDiscoveryService/DataProcessing.FileDiscovery.csproj"
RUN dotnet build "FileDiscoveryService/DataProcessing.FileDiscovery.csproj" -c Release
RUN dotnet publish "FileDiscoveryService/DataProcessing.FileDiscovery.csproj" -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "DataProcessing.FileDiscovery.dll"]
```

**Frontend Dockerfile:**
```dockerfile
# Build stage
FROM node:20 AS build
WORKDIR /app
COPY src/Frontend/package*.json ./
RUN npm install
COPY src/Frontend/ ./
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

### Afternoon: Helm Chart Completion (3 hours)

**Complete Helm Templates:**
- `templates/deployments/` - All 9 service deployments
- `templates/services/` - All service definitions
- `templates/configmaps/` - Service configs
- `values.yaml` - Complete configuration

**Helm Chart Structure:**
```
helm/ez-platform/
├── Chart.yaml
├── values.yaml
├── values-dev.yaml
├── templates/
│   ├── namespace.yaml
│   ├── configmaps/
│   ├── deployments/
│   ├── services/
│   ├── infrastructure/
│   └── NOTES.txt
└── README.md
```

---

## Day 2: Build, Deploy & Validate (6 hours)

### Morning: Build & Load Images (3 hours)

**Build all images:**
```bash
# Backend services
docker build -t ez-platform/filediscovery:latest -f docker/FileDiscoveryService.Dockerfile .
docker build -t ez-platform/fileprocessor:latest -f docker/FileProcessorService.Dockerfile .
# ... all 9 services

# Load into Minikube
minikube image load ez-platform/filediscovery:latest
# ... all 9 images
```

---

### Afternoon: Deploy & Test (3 hours)

**Deploy via Helm:**
```bash
helm install ez-platform ./helm/ez-platform -n ez-platform
```

**Verify:**
- All 19 pods running
- All services healthy
- Service-to-service communication works

**Update DemoDataGenerator:**
- Add `--mongodb-connection` argument
- Test: `dotnet run -- generate-all --mongodb-connection="mongodb.ez-platform:27017"`
- Or port-forward: `kubectl port-forward svc/mongodb 27017:27017`

---

## Days 3-7: E2E Testing

[Continue with E2E scenarios as originally planned...]

---

**Document Created:** December 3, 2025
**Status:** Ready to start implementation
