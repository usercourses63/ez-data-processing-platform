# Changelog

All notable changes to the EZ Platform release package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.1.1-rc2] - 2025-01-08

### Added
- OCP (OpenShift Container Platform) compatibility
- NetworkPolicies for pod isolation and security
- OpenShift Routes configuration (ocp-routes.yaml)
- PowerShell deployment scripts for Windows environments (install.ps1, uninstall.ps1, deploy-all.ps1)
- SecurityContext configurations for all deployments

### Changed
- Frontend port changed from 80 to 8080 (non-privileged)
- Docusaurus docs portal port changed to 8080
- All images now use pinned versions instead of :latest
- imagePullPolicy changed from Never to IfNotPresent

### Security
- Added runAsNonRoot: true for all pods
- Added allowPrivilegeEscalation: false for all containers
- Added capabilities drop ALL for containers
- Added seccompProfile: RuntimeDefault
- Hardened MongoDB, Kafka, Elasticsearch, Grafana with security contexts
