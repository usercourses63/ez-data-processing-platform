---
last-verified: 2026-02-02
status: current
---
# Data Processing Pipeline
_End-to-End Flow: Source Files → Processing → Multi-Destination Output_

---

![Data Processing Pipeline](../svg/data-pipeline.svg)

## Architecture Diagram (Embedded)

<svg viewbox="0 0 1200 780" xmlns="http://www.w3.org/2000/svg">
<defs>
<lineargradient id="sourceGrad" x1="0%" x2="100%" y1="0%" y2="100%">
<stop offset="0%" style="stop-color:#3b82f6"></stop>
<stop offset="100%" style="stop-color:#1d4ed8"></stop>
</lineargradient>
<lineargradient id="processGrad" x1="0%" x2="100%" y1="0%" y2="100%">
<stop offset="0%" style="stop-color:#f59e0b"></stop>
<stop offset="100%" style="stop-color:#d97706"></stop>
</lineargradient>
<lineargradient id="destGrad" x1="0%" x2="100%" y1="0%" y2="100%">
<stop offset="0%" style="stop-color:#10b981"></stop>
<stop offset="100%" style="stop-color:#059669"></stop>
</lineargradient>
<lineargradient id="rabbitmqGrad" x1="0%" x2="100%" y1="0%" y2="0%">
<stop offset="0%" style="stop-color:#8b5cf6"></stop>
<stop offset="100%" style="stop-color:#6d28d9"></stop>
</lineargradient>
<lineargradient id="cacheGrad" x1="0%" x2="100%" y1="0%" y2="100%">
<stop offset="0%" style="stop-color:#06b6d4"></stop>
<stop offset="100%" style="stop-color:#0891b2"></stop>
</lineargradient>
<lineargradient id="errorGrad" x1="0%" x2="100%" y1="0%" y2="100%">
<stop offset="0%" style="stop-color:#ef4444"></stop>
<stop offset="100%" style="stop-color:#dc2626"></stop>
</lineargradient>
<filter id="glow">
<fegaussianblur result="coloredBlur" stddeviation="3"></fegaussianblur>
<femerge>
<femergenode in="coloredBlur"></femergenode>
<femergenode in="SourceGraphic"></femergenode>
</femerge>
</filter>
<filter id="shadow">
<fedropshadow dx="0" dy="4" flood-opacity="0.4" stddeviation="6"></fedropshadow>
</filter>
<marker id="arrow" markerheight="8" markerwidth="12" orient="auto" refx="10" refy="4">
<polygon fill="#f59e0b" points="0 0, 12 4, 0 8"></polygon>
</marker>
<marker id="arrowWhite" markerheight="8" markerwidth="12" orient="auto" refx="10" refy="4">
<polygon fill="#fff" points="0 0, 12 4, 0 8"></polygon>
</marker>
<marker id="arrowRed" markerheight="8" markerwidth="12" orient="auto" refx="10" refy="4">
<polygon fill="#ef4444" points="0 0, 12 4, 0 8"></polygon>
</marker>
</defs>
<!-- Background sections -->
<rect fill="rgba(59,130,246,0.1)" height="280" rx="12" stroke="rgba(59,130,246,0.3)" width="160" x="20" y="20"></rect>
<text fill="#60a5fa" font-size="14" font-weight="bold" text-anchor="middle" x="100" y="50">SOURCE FILES</text>
<rect fill="rgba(245,158,11,0.1)" height="280" rx="12" stroke="rgba(245,158,11,0.3)" width="680" x="200" y="20"></rect>
<text fill="#fbbf24" font-size="14" font-weight="bold" text-anchor="middle" x="540" y="50">PROCESSING PIPELINE</text>
<rect fill="rgba(16,185,129,0.1)" height="280" rx="12" stroke="rgba(16,185,129,0.3)" width="180" x="900" y="20"></rect>
<text fill="#34d399" font-size="14" font-weight="bold" text-anchor="middle" x="990" y="50">DESTINATIONS</text>
<!-- Source Files -->
<g filter="url(#shadow)">
<rect fill="url(#sourceGrad)" height="35" rx="8" width="120" x="40" y="70"></rect>
<text fill="white" font-size="13" font-weight="bold" text-anchor="middle" x="100" y="93">📄 CSV</text>
</g>
<g filter="url(#shadow)">
<rect fill="url(#sourceGrad)" height="35" rx="8" width="120" x="40" y="115"></rect>
<text fill="white" font-size="13" font-weight="bold" text-anchor="middle" x="100" y="138">📑 XML</text>
</g>
<g filter="url(#shadow)">
<rect fill="url(#sourceGrad)" height="35" rx="8" width="120" x="40" y="160"></rect>
<text fill="white" font-size="13" font-weight="bold" text-anchor="middle" x="100" y="183">📊 Excel</text>
</g>
<g filter="url(#shadow)">
<rect fill="url(#sourceGrad)" height="35" rx="8" width="120" x="40" y="205"></rect>
<text fill="white" font-size="13" font-weight="bold" text-anchor="middle" x="100" y="228">📋 JSON</text>
</g>
<!-- Storage indicator -->
<rect fill="rgba(59,130,246,0.3)" height="25" rx="4" width="120" x="40" y="255"></rect>
<text fill="#93c5fd" font-size="10" text-anchor="middle" x="100" y="272">📥 50Gi Input</text>
<!-- Processing Services -->
<!-- File Discovery -->
<g filter="url(#shadow)">
<rect fill="url(#processGrad)" height="120" rx="10" width="140" x="230" y="100"></rect>
<text fill="white" font-size="12" font-weight="bold" text-anchor="middle" x="300" y="130">🔍 FILE</text>
<text fill="white" font-size="12" font-weight="bold" text-anchor="middle" x="300" y="148">DISCOVERY</text>
<line stroke="rgba(255,255,255,0.3)" x1="250" x2="350" y1="160" y2="160"></line>
<text fill="rgba(255,255,255,0.9)" font-size="10" text-anchor="middle" x="300" y="180">Poll Folders</text>
<text fill="rgba(255,255,255,0.9)" font-size="10" text-anchor="middle" x="300" y="195">Deduplication</text>
<text fill="rgba(255,255,255,0.7)" font-size="9" text-anchor="middle" x="300" y="210">2 replicas</text>
</g>
<!-- Arrow -->
<path d="M 375 160 L 405 160" filter="url(#glow)" marker-end="url(#arrow)" stroke="#f59e0b" stroke-width="3"></path>
<!-- File Processor -->
<g filter="url(#shadow)">
<rect fill="url(#processGrad)" height="120" rx="10" width="140" x="420" y="100"></rect>
<text fill="white" font-size="12" font-weight="bold" text-anchor="middle" x="490" y="130">⚙️ FILE</text>
<text fill="white" font-size="12" font-weight="bold" text-anchor="middle" x="490" y="148">PROCESSOR</text>
<line stroke="rgba(255,255,255,0.3)" x1="440" x2="540" y1="160" y2="160"></line>
<text fill="rgba(255,255,255,0.9)" font-size="10" text-anchor="middle" x="490" y="180">Format Detect</text>
<text fill="rgba(255,255,255,0.9)" font-size="10" text-anchor="middle" x="490" y="195">→ JSON Convert</text>
<text fill="rgba(255,255,255,0.7)" font-size="9" text-anchor="middle" x="490" y="210">2 replicas</text>
</g>
<!-- Arrow -->
<path d="M 565 160 L 595 160" filter="url(#glow)" marker-end="url(#arrow)" stroke="#f59e0b" stroke-width="3"></path>
<!-- Validation -->
<g filter="url(#shadow)">
<rect fill="url(#processGrad)" height="120" rx="10" width="140" x="610" y="100"></rect>
<text fill="white" font-size="12" font-weight="bold" text-anchor="middle" x="680" y="130">✅ VALIDATION</text>
<line stroke="rgba(255,255,255,0.3)" x1="630" x2="730" y1="145" y2="145"></line>
<text fill="rgba(255,255,255,0.9)" font-size="10" text-anchor="middle" x="680" y="165">JSON Schema</text>
<text fill="rgba(255,255,255,0.9)" font-size="10" text-anchor="middle" x="680" y="180">2020-12</text>
<text fill="rgba(255,255,255,0.9)" font-size="10" text-anchor="middle" x="680" y="195">Business Rules</text>
<text fill="rgba(255,255,255,0.7)" font-size="9" text-anchor="middle" x="680" y="210">1 replica</text>
</g>
<!-- Arrow -->
<path d="M 755 160 L 775 160" filter="url(#glow)" marker-end="url(#arrow)" stroke="#f59e0b" stroke-width="3"></path>
<!-- Output (moved left to not overlap with DESTINATIONS) -->
<g filter="url(#shadow)">
<rect fill="url(#processGrad)" height="120" rx="10" width="90" x="790" y="100"></rect>
<text fill="white" font-size="11" font-weight="bold" text-anchor="middle" x="835" y="130">📤 OUTPUT</text>
<line stroke="rgba(255,255,255,0.3)" x1="800" x2="870" y1="145" y2="145"></line>
<text fill="rgba(255,255,255,0.9)" font-size="9" text-anchor="middle" x="835" y="165">Multi-Dest</text>
<text fill="rgba(255,255,255,0.9)" font-size="9" text-anchor="middle" x="835" y="180">Router</text>
<text fill="rgba(255,255,255,0.7)" font-size="8" text-anchor="middle" x="835" y="195">3 replicas</text>
</g>
<!-- Destinations -->
<g filter="url(#shadow)">
<rect fill="url(#destGrad)" height="35" rx="6" width="140" x="920" y="70"></rect>
<text fill="white" font-size="11" font-weight="bold" text-anchor="middle" x="990" y="93">📁 Local Files</text>
</g>
<g filter="url(#shadow)">
<rect fill="url(#destGrad)" height="35" rx="6" width="140" x="920" y="115"></rect>
<text fill="white" font-size="11" font-weight="bold" text-anchor="middle" x="990" y="138">🔒 SFTP</text>
</g>
<g filter="url(#shadow)">
<rect fill="url(#destGrad)" height="35" rx="6" width="140" x="920" y="160"></rect>
<text fill="white" font-size="11" font-weight="bold" text-anchor="middle" x="990" y="183">🌐 HTTP APIs</text>
</g>
<g filter="url(#shadow)">
<rect fill="url(#destGrad)" height="35" rx="6" width="140" x="920" y="205"></rect>
<text fill="white" font-size="11" font-weight="bold" text-anchor="middle" x="990" y="228">📨 Message Queues</text>
</g>
<!-- Storage indicator -->
<rect fill="rgba(16,185,129,0.3)" height="25" rx="4" width="120" x="930" y="255"></rect>
<text fill="#6ee7b7" font-size="10" text-anchor="middle" x="990" y="272">📤 100Gi Output</text>
<!-- Arrows from sources to Discovery -->
<path d="M 165 100 L 225 140" stroke="#60a5fa" stroke-dasharray="5,3" stroke-width="2"></path>
<path d="M 165 155 L 225 155" stroke="#60a5fa" stroke-dasharray="5,3" stroke-width="2"></path>
<path d="M 165 210 L 225 170" stroke="#60a5fa" stroke-dasharray="5,3" stroke-width="2"></path>
<path d="M 165 265 L 225 185" stroke="#60a5fa" stroke-dasharray="5,3" stroke-width="2"></path>
<!-- RABBITMQ MESSAGE BUS -->
<rect fill="url(#rabbitmqGrad)" filter="url(#shadow)" height="60" rx="10" width="660" x="220" y="340"></rect>
<text fill="white" font-size="14" font-weight="bold" text-anchor="middle" x="550" y="365">RABBITMQ MESSAGE BUS</text>
<text fill="rgba(255,255,255,0.8)" font-size="11" text-anchor="middle" x="550" y="385">Event-Driven | MassTransit | 2 Brokers</text>
<!-- RabbitMQ queues/exchanges -->
<rect fill="rgba(139,92,246,0.2)" height="80" rx="8" stroke="rgba(139,92,246,0.4)" width="660" x="220" y="410"></rect>
<text fill="#c4b5fd" font-size="11" font-weight="bold" x="240" y="435">Topics:</text>
<text fill="#a5b4fc" font-size="10" x="240" y="455">📍 filepolling</text>
<text fill="#a5b4fc" font-size="10" x="380" y="455">📍 filesreceiver.validationrequest</text>
<text fill="#a5b4fc" font-size="10" x="240" y="475">📍 validation.completed</text>
<text fill="#a5b4fc" font-size="10" x="430" y="475">📍 global.processingfailed</text>
<!-- Vertical connectors to RabbitMQ -->
<line stroke="#8b5cf6" stroke-dasharray="4,4" stroke-width="2" x1="300" x2="300" y1="225" y2="335"></line>
<line stroke="#8b5cf6" stroke-dasharray="4,4" stroke-width="2" x1="490" x2="490" y1="225" y2="335"></line>
<line stroke="#8b5cf6" stroke-dasharray="4,4" stroke-width="2" x1="680" x2="680" y1="225" y2="335"></line>
<!-- HAZELCAST CACHE -->
<rect fill="url(#cacheGrad)" filter="url(#shadow)" height="100" rx="10" width="660" x="220" y="510"></rect>
<text fill="white" font-size="14" font-weight="bold" text-anchor="middle" x="550" y="535">HAZELCAST DISTRIBUTED CACHE</text>
<text fill="rgba(255,255,255,0.8)" font-size="11" text-anchor="middle" x="550" y="555">TTL: 300s | LRU Eviction | 256MB per map</text>
<!-- Cache maps (inside Hazelcast box) -->
<rect fill="rgba(255,255,255,0.2)" height="25" rx="4" width="140" x="250" y="570"></rect>
<text fill="white" font-size="10" text-anchor="middle" x="320" y="587">📦 file-hashes</text>
<rect fill="rgba(255,255,255,0.2)" height="25" rx="4" width="140" x="410" y="570"></rect>
<text fill="white" font-size="10" text-anchor="middle" x="480" y="587">📄 file-content</text>
<rect fill="rgba(255,255,255,0.2)" height="25" rx="4" width="140" x="570" y="570"></rect>
<text fill="white" font-size="10" text-anchor="middle" x="640" y="587">✓ valid-records</text>
<!-- Cache connectors -->
<line opacity="0.5" stroke="#06b6d4" stroke-dasharray="3,3" stroke-width="1" x1="300" x2="300" y1="225" y2="505"></line>
<line opacity="0.5" stroke="#06b6d4" stroke-dasharray="3,3" stroke-width="1" x1="490" x2="490" y1="225" y2="505"></line>
<line opacity="0.5" stroke="#06b6d4" stroke-dasharray="3,3" stroke-width="1" x1="680" x2="680" y1="225" y2="505"></line>
<!-- ERROR FLOW -->
<rect fill="url(#errorGrad)" filter="url(#shadow)" height="70" rx="10" width="660" x="220" y="630"></rect>
<text fill="white" font-size="14" font-weight="bold" text-anchor="middle" x="350" y="660">⚠️ ERROR HANDLING</text>
<rect fill="rgba(0,0,0,0.3)" height="50" rx="8" width="150" x="520" y="640"></rect>
<text fill="white" font-size="11" font-weight="bold" text-anchor="middle" x="595" y="665">Invalid Records</text>
<text fill="rgba(255,255,255,0.8)" font-size="10" text-anchor="middle" x="595" y="680">MongoDB Storage</text>
<rect fill="rgba(0,0,0,0.3)" height="50" rx="8" width="120" x="690" y="640"></rect>
<text fill="white" font-size="11" font-weight="bold" text-anchor="middle" x="750" y="665">Reprocessing</text>
<text fill="rgba(255,255,255,0.8)" font-size="10" text-anchor="middle" x="750" y="680">Manual/Auto</text>
<!-- Error flow arrows (from Validation to Error Handling) -->
<path d="M 610 160 L 590 160 L 590 320 L 200 320 L 200 665 L 215 665" fill="none" stroke="#ef4444" stroke-dasharray="5,3" stroke-width="2"></path>
<polygon fill="#ef4444" points="215,661 225,665 215,669"></polygon>
<text fill="#fca5a5" font-size="9" transform="rotate(-90 150 500)" x="150" y="500">Validation Errors</text>
<!-- Performance metrics -->
<rect fill="rgba(255,255,255,0.05)" height="150" rx="10" stroke="rgba(255,255,255,0.1)" width="180" x="900" y="340"></rect>
<text fill="#94a3b8" font-size="12" font-weight="bold" text-anchor="middle" x="990" y="365">PERFORMANCE</text>
<line stroke="rgba(255,255,255,0.1)" x1="920" x2="1060" y1="375" y2="375"></line>
<text fill="#a5b4fc" font-size="10" x="925" y="400">⚡ &lt;1s per 100 records</text>
<text fill="#a5b4fc" font-size="10" x="925" y="420">📊 95%+ cache hit rate</text>
<text fill="#a5b4fc" font-size="10" x="925" y="440">🚀 &lt;5s service startup</text>
<text fill="#a5b4fc" font-size="10" x="925" y="460">📈 P99 latency &lt;500ms</text>
<text fill="#a5b4fc" font-size="10" x="925" y="480">✓ 1000 files tested</text>
</svg>

## Related Documentation

- [← All Diagrams](./index.md)
- [← Architecture Overview](./architecture-overview.md)
- [Observability Stack →](./observability.md)


---

_Generated from data-pipeline.html_
_Date: 1766661421.5936127_
