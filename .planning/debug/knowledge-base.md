# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## filediscovery-nas-silent-failure — Dedup hash written before publish blocks file re-discovery
- **Date:** 2026-03-27
- **Error patterns:** silent failure, 0 FileDiscoveredEvent, duplicate skipped, dedup, Hazelcast hash, NAS, FilePollingEvent acked no publish
- **Root cause:** Hazelcast dedup hash was written in DiscoverFilesAsync before FileDiscoveredEvent publish. If downstream failed or first poll errored after hash write, the file was permanently blocked until 24h TTL expired. Compounded by Warning log level masking all consumer activity.
- **Fix:** Moved AddProcessedFileHashAsync from DiscoverFilesAsync to after successful publish in Consume method. Raised FileProcessor log level to Information.
- **Files changed:** src/Services/FileDiscoveryService/Consumers/FilePollingEventConsumer.cs, src/Services/FileProcessorService/appsettings.Production.json
---
