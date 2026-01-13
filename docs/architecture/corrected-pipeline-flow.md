# EZ Platform - Corrected Pipeline Flow Diagram

**Version:** 1.0
**Date:** January 13, 2026
**Purpose:** Visual specification for correcting the monitoring dashboard pipeline visualization

---

## Visual Legend

### Connection Types

| Type | Visual Style | Color | Description |
|------|-------------|-------|-------------|
| **Kafka Event** | Solid line with arrow `───→` | Blue (#3b82f6) | Asynchronous event-driven flow |
| **HTTP API Call** | Dashed line with double arrow `⟷` | Orange (#f59e0b) | Synchronous request/response |
| **Database Write** | Dotted line with arrow `···→` | Purple (#8b5cf6) | Data persistence operation |
| **Reprocess Flow** | Dashed line with arrow `--→` | Green (#10b981) | Manual reprocessing trigger |

### Service Status Colors

| Status | Border Color | Background | Icon Color |
|--------|-------------|------------|------------|
| **Healthy** | Green (#10b981) | #1e293b | White |
| **Warning** | Orange (#f59e0b) | #1e293b | White |
| **Error** | Red (#ef4444) | #1e293b | White |

---

## Corrected Service Layout

### Service Nodes (Canvas Coordinates)

```javascript
const services = [
  // PRIMARY FLOW (Left to Right)
  {
    id: 'datasource',
    name: 'Data Source Management',
    icon: '🗂️',
    x: 100,
    y: 80,
    port: 5001,
    color: 'green'  // Usually healthy
  },
  {
    id: 'scheduling',
    name: 'Scheduling',
    icon: '⏰',
    x: 100,
    y: 240,
    port: 5004,
    color: 'orange'  // Moderate load
  },
  {
    id: 'filediscovery',
    name: 'File Discovery',
    icon: '📥',
    x: 300,
    y: 240,
    port: 5006,
    color: 'green'
  },
  {
    id: 'fileprocessor',
    name: 'File Processor',
    icon: '⚙️',
    x: 500,
    y: 240,
    port: 5008,
    color: 'green'
  },
  {
    id: 'validation',
    name: 'Validation',
    icon: '✓',
    x: 700,
    y: 240,
    port: 5003,
    color: 'green'
  },
  {
    id: 'output',
    name: 'Output',
    icon: '📤',
    x: 900,
    y: 240,
    port: 5009,
    color: 'orange'  // High throughput
  },

  // SUPPORTING SERVICES (Top and Bottom)
  {
    id: 'metrics',
    name: 'Metrics Config',
    icon: '📊',
    x: 700,
    y: 80,
    port: 5002,
    color: 'orange'
  },
  {
    id: 'invalidrecords',
    name: 'Invalid Records',
    icon: '⚠️',
    x: 900,
    y: 80,
    port: 5007,
    color: 'green'
  },
];
```

---

## Corrected Connections

### PRIMARY KAFKA EVENT FLOW (Solid Blue Lines)

```javascript
const kafkaConnections = [
  // Connection 1: Data Source Mgmt → Scheduling
  {
    from: 'datasource',
    to: 'scheduling',
    type: 'kafka',
    event: 'DataSourceCreated/Updated/Deleted',
    topic: 'dataprocessing.datasource.lifecycle',
    color: '#3b82f6',
    style: 'solid',
    label: 'DataSource Events'
  },

  // Connection 2: Scheduling → File Discovery
  {
    from: 'scheduling',
    to: 'filediscovery',
    type: 'kafka',
    event: 'FilePollingEvent',
    topic: 'dataprocessing.scheduling.filepolling',
    color: '#3b82f6',
    style: 'solid',
    label: 'File Polling Trigger'
  },

  // Connection 3: File Discovery → File Processor
  {
    from: 'filediscovery',
    to: 'fileprocessor',
    type: 'kafka',
    event: 'FileDiscoveredEvent',
    topic: 'dataprocessing.discovery.filediscovered',
    color: '#3b82f6',
    style: 'solid',
    label: 'File Discovered'
  },

  // Connection 4: File Processor → Validation
  {
    from: 'fileprocessor',
    to: 'validation',
    type: 'kafka',
    event: 'ValidationRequestEvent',
    topic: 'dataprocessing.filesreceiver.validationrequest',
    color: '#3b82f6',
    style: 'solid',
    label: 'Validation Request'
  },

  // Connection 5: Validation → Output
  {
    from: 'validation',
    to: 'output',
    type: 'kafka',
    event: 'ValidationCompletedEvent',
    topic: 'dataprocessing.validation.completed',
    color: '#3b82f6',
    style: 'solid',
    label: 'Validation Complete'
  },
];
```

### HTTP API CALLS (Dashed Orange Lines)

```javascript
const apiConnections = [
  // Connection 6: Validation ↔ Metrics Config (Bidirectional)
  {
    from: 'validation',
    to: 'metrics',
    type: 'http-api',
    method: 'GET',
    endpoint: '/api/v1/metrics/{dataSourceId}',
    color: '#f59e0b',
    style: 'dashed',
    bidirectional: true,
    label: 'Fetch Metric Definitions'
  },
];
```

### DATABASE OPERATIONS (Dotted Purple Lines)

```javascript
const databaseConnections = [
  // Connection 7: Validation → Invalid Records (MongoDB Write)
  {
    from: 'validation',
    to: 'invalidrecords',
    type: 'database',
    operation: 'INSERT',
    store: 'MongoDB',
    entity: 'DataProcessingInvalidRecord',
    color: '#8b5cf6',
    style: 'dotted',
    label: 'Store Invalid Records'
  },
];
```

### REPROCESS FLOW (Dashed Green Lines)

```javascript
const reprocessConnections = [
  // Connection 8: Invalid Records → Validation (User Correction)
  {
    from: 'invalidrecords',
    to: 'validation',
    type: 'reprocess',
    event: 'ValidationRequestEvent',
    trigger: 'User correction via API',
    color: '#10b981',
    style: 'dashed',
    label: 'Reprocess Corrected'
  },
];
```

---

## ❌ REMOVED CONNECTIONS (From Original Screenshot)

These connections were INCORRECT and should be removed:

```javascript
const incorrectConnections = [
  // ❌ WRONG: Scheduling → File Processor
  {
    from: 'scheduling',
    to: 'fileprocessor',
    reason: 'Scheduling triggers File Discovery first, not File Processor directly'
  },

  // ❌ WRONG: Data Source Mgmt → File Processor
  {
    from: 'datasource',
    to: 'fileprocessor',
    reason: 'Data Source Mgmt triggers Scheduling, not File Processor'
  },

  // ❌ WRONG: File Processor → Metrics Config
  {
    from: 'fileprocessor',
    to: 'metrics',
    reason: 'File Processor has no interaction with Metrics Config'
  },
];
```

---

## Complete Flow Visualization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EZ PLATFORM PIPELINE FLOW (CORRECTED)                     │
└─────────────────────────────────────────────────────────────────────────────┘

                         ┌──────────────────┐
                         │ Data Source Mgmt │ (5001)
                         └────────┬─────────┘
                                  │ DataSourceCreated (Kafka)
                                  ↓
                         ┌──────────────────┐
                         │   Scheduling     │ (5004)
                         └────────┬─────────┘
                                  │ FilePollingEvent (Kafka)
                                  ↓
                         ┌──────────────────┐
                         │ File Discovery   │ (5006)
                         └────────┬─────────┘
                                  │ FileDiscoveredEvent (Kafka)
                                  ↓
                         ┌──────────────────┐
                         │ File Processor   │ (5008)
                         └────────┬─────────┘
                                  │ ValidationRequestEvent (Kafka)
                                  ↓
                         ┌──────────────────┐      ┌──────────────────┐
                         │   Validation     │◄─────┤ Metrics Config   │
                         │                  │ HTTP │                  │
                         │      (5003)      │─────►│      (5002)      │
                         └────────┬─────────┘      └──────────────────┘
                                  │ ValidationCompletedEvent (Kafka)
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ↓             ↓             ↓
          ┌──────────────┐  ┌──────────────┐  (MongoDB Write)
          │   Output     │  │Invalid       │
          │   Service    │  │Records       │◄──┐
          │   (5009)     │  │   (5007)     │   │
          └──────────────┘  └──────┬───────┘   │
                                   │           │
                                   └───────────┘
                              (User Correction: Reprocess)

Legend:
━━━→  Kafka Event Flow (Blue)
⟷    HTTP API Call (Orange, Dashed)
···→  Database Write (Purple, Dotted)
--→   Reprocess Flow (Green, Dashed)
```

---

## Implementation Notes for PipelineFlow Component

### Canvas Drawing Logic

```typescript
// PipelineFlow.tsx - Updated connection rendering

const drawConnections = (ctx: CanvasRenderingContext2D) => {
  // 1. Draw Kafka event connections (solid blue)
  kafkaConnections.forEach(conn => {
    const fromService = services.find(s => s.id === conn.from);
    const toService = services.find(s => s.id === conn.to);

    ctx.strokeStyle = conn.color; // #3b82f6
    ctx.lineWidth = 3;
    ctx.setLineDash([]); // Solid line

    drawArrowLine(ctx, fromService, toService);
    drawLabel(ctx, conn.label, midpoint);
  });

  // 2. Draw HTTP API connections (dashed orange)
  apiConnections.forEach(conn => {
    ctx.strokeStyle = conn.color; // #f59e0b
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]); // Dashed line

    if (conn.bidirectional) {
      drawBidirectionalArrow(ctx, fromService, toService);
    }
  });

  // 3. Draw database connections (dotted purple)
  databaseConnections.forEach(conn => {
    ctx.strokeStyle = conn.color; // #8b5cf6
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 4]); // Dotted line

    drawArrowLine(ctx, fromService, toService);
  });

  // 4. Draw reprocess connections (dashed green)
  reprocessConnections.forEach(conn => {
    ctx.strokeStyle = conn.color; // #10b981
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]); // Dashed line

    drawCurvedArrowLine(ctx, fromService, toService); // Curved for visibility
  });
};
```

### Animation Logic

```typescript
// Particle animation - flows along connections
const animateDataFlow = () => {
  // Randomly select a Kafka connection for particle animation
  const activeConnection = kafkaConnections[
    Math.floor(Math.random() * kafkaConnections.length)
  ];

  // Create particle that flows from source to destination
  createParticle(activeConnection.from, activeConnection.to, {
    color: activeConnection.color,
    speed: 2, // pixels per frame
    size: 8,
    glow: true
  });
};

// Animate every 500ms
setInterval(animateDataFlow, 500);
```

---

## Tooltip Content

When hovering over connections, show:

```typescript
const getConnectionTooltip = (connection) => {
  switch (connection.type) {
    case 'kafka':
      return `
        Event: ${connection.event}
        Topic: ${connection.topic}
        Type: Asynchronous Message
      `;
    case 'http-api':
      return `
        Method: ${connection.method}
        Endpoint: ${connection.endpoint}
        Type: Synchronous API Call
      `;
    case 'database':
      return `
        Operation: ${connection.operation}
        Store: ${connection.store}
        Entity: ${connection.entity}
      `;
    case 'reprocess':
      return `
        Trigger: ${connection.trigger}
        Event: ${connection.event}
      `;
  }
};
```

---

## CSS Styles for Connection Labels

```css
/* Connection labels */
.connection-label {
  position: absolute;
  font-size: 11px;
  color: #94a3b8;
  background: rgba(15, 23, 42, 0.9);
  padding: 4px 8px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.connection-label.kafka {
  border-left: 3px solid #3b82f6;
}

.connection-label.http-api {
  border-left: 3px solid #f59e0b;
}

.connection-label.database {
  border-left: 3px solid #8b5cf6;
}

.connection-label.reprocess {
  border-left: 3px solid #10b981;
}
```

---

## Verification Checklist

After updating the visualization:

- [ ] Data Source Mgmt connects to Scheduling (NOT File Processor)
- [ ] Scheduling connects to File Discovery (NOT File Processor)
- [ ] File Discovery connects to File Processor
- [ ] File Processor connects to Validation (NOT Metrics Config)
- [ ] Validation connects to Output
- [ ] Validation connects to Invalid Records (database write)
- [ ] Validation ↔ Metrics Config shown as HTTP API (dashed orange)
- [ ] Invalid Records ↔ Validation reprocess flow shown (dashed green)
- [ ] All Kafka connections are solid blue lines
- [ ] All connections have proper labels
- [ ] Particle animation flows along correct paths
- [ ] Tooltips show correct event/topic information

---

## Files to Update

1. **c:\Users\UserC\source\repos\EZ\src\Frontend\src\pages\monitoring\components\PipelineFlow.tsx**
   - Update service coordinates
   - Update connection definitions
   - Add connection type styling
   - Update particle animation paths

2. **c:\Users\UserC\source\repos\EZ\src\Frontend\src\services\monitoring-mock-data.ts**
   - Update `simulateDataFlow()` to only return valid Kafka connections
   - Remove invalid connections from mock data

3. **c:\Users\UserC\source\repos\EZ\src\Frontend\src\pages\monitoring\SystemMonitoring.css**
   - Add connection label styles
   - Add color variables for different connection types

---

## Testing the Corrections

```bash
# 1. Start frontend
cd src/Frontend
npm start

# 2. Navigate to monitoring dashboard
open http://localhost:3000/monitoring

# 3. Verify visual corrections:
#    - Check all service positions
#    - Verify connection paths
#    - Inspect connection colors and styles
#    - Test particle animations
#    - Hover over connections to see tooltips
```

---

**Document Status:** Ready for Implementation
**Next Steps:** Update PipelineFlow component with corrected service layout and connections
