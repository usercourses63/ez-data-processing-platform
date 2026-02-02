---
last-verified: 2026-02-02
status: current
---
# EZ Platform Monitoring Dashboard - Color System from Mockup

**Source:** `docs/mockups/k8s-microservices-dashboard.html`
**Date Extracted:** 2026-01-12

## Color Palette

### Background Colors
```css
--body-background: #0a0e27          /* Deep navy blue - main background */
--panel-background: #1e293b         /* Darker slate - card/panel background */
--panel-header-bg: linear-gradient(135deg, #1e293b 0%, #0f172a 100%)
--inner-panel-bg: #0f172a          /* Darkest - logs, traces, inner sections */
```

### Text Colors
```css
--text-primary: #e4e4e7            /* Near white - body text, log messages */
--text-title: #f1f5f9              /* Brightest white - panel titles, stat values */
--text-secondary: #94a3b8          /* Medium gray - labels, table headers */
--text-tertiary: #64748b           /* Darker gray - timestamps, minor labels */
```

### Border Colors
```css
--border-primary: #334155          /* Slate gray - panel borders, table borders */
--border-secondary: #475569        /* Lighter slate - secondary elements */
```

### Accent Colors
```css
--accent-blue: #3b82f6             /* Primary action blue */
--accent-purple: #8b5cf6           /* Secondary accent purple */
--accent-gradient: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)
```

### Status Colors
```css
--status-success: #10b981          /* Green - running pods, positive metrics */
--status-warning: #fbbf24          /* Yellow - pending, warnings */
--status-error: #ef4444            /* Red - errors, high resource usage */
--status-info: #3b82f6             /* Blue - info logs, normal operations */
```

## Typography

### Font Family
```css
font-family: 'JetBrains Mono', monospace;
```

### Font Sizes
```css
--font-size-xs: 0.7rem             /* Queue stat labels */
--font-size-sm: 0.75rem            /* Log timestamps, pod status badges */
--font-size-base: 0.85rem          /* Table data, buttons, logs */
--font-size-md: 0.9rem             /* Body text */
--font-size-lg: 1.1rem             /* Panel titles */
--font-size-xl: 1.5rem             /* Stat card values */
--font-size-2xl: 1.8rem            /* Page header */
```

### Font Weights
```css
--font-weight-normal: 400
--font-weight-semibold: 600
```

## Component Styles

### Stat Cards (Top KPI Cards)
```css
Background: #1e293b
Border: 1px solid #334155
Border-radius: 8px
Padding: 15px
Top accent: 3px gradient bar (linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%))

Title (label):
  - Font-size: 0.75rem
  - Color: #94a3b8
  - Text-transform: uppercase
  - Letter-spacing: 1px

Value (number):
  - Font-size: 1.5rem
  - Font-weight: 600
  - Color: #f1f5f9

Change indicator:
  - Font-size: 0.75rem
  - Color: #10b981 (positive) or #ef4444 (negative)
```

### Panel/Card Components
```css
Background: #1e293b
Border: 1px solid #334155
Border-radius: 8px
Padding: 20px

Panel Header:
  - Display: flex, justify-content: space-between
  - Margin-bottom: 20px

Panel Title:
  - Font-size: 1.1rem
  - Font-weight: 600
  - Color: #f1f5f9
```

### Buttons
```css
Primary Button:
  - Background: #3b82f6
  - Color: white
  - Border: none
  - Padding: 6px 12px
  - Border-radius: 4px
  - Font-size: 0.85rem
  - Hover: background: #2563eb, transform: translateY(-1px)

Secondary Button:
  - Background: #475569
  - Hover: background: #64748b
```

### Table Styles
```css
Table Header (th):
  - Background: #0f172a
  - Color: #94a3b8
  - Padding: 12px
  - Font-size: 0.85rem
  - Text-transform: uppercase
  - Letter-spacing: 1px
  - Border-bottom: 2px solid #334155

Table Data (td):
  - Padding: 12px
  - Border-bottom: 1px solid #334155
  - Font-size: 0.9rem

Row Hover:
  - Background: rgba(59, 130, 246, 0.1)  /* Blue tint */
```

### Status Badges
```css
Pod Status (Running):
  - Background: rgba(16, 185, 129, 0.2)
  - Color: #10b981
  - Padding: 4px 8px
  - Border-radius: 4px
  - Font-size: 0.75rem
  - Font-weight: 600
  - Text-transform: uppercase

Warning:
  - Background: rgba(251, 191, 36, 0.2)
  - Color: #fbbf24

Error:
  - Background: rgba(239, 68, 68, 0.2)
  - Color: #ef4444
```

### Resource Bars (CPU/Memory)
```css
Container:
  - Width: 100px
  - Height: 8px
  - Background: #0f172a
  - Border-radius: 4px

Fill (Normal):
  - Background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)

Fill (High Usage):
  - Background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%)

Fill (Medium Usage):
  - Background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)
```

### Logs Viewer
```css
Container:
  - Background: #0f172a
  - Border-radius: 4px
  - Padding: 15px
  - Font-family: 'JetBrains Mono', monospace
  - Font-size: 0.85rem

Log Entry:
  - Padding: 8px
  - Border-left: 3px solid transparent
  - Hover: background: rgba(59, 130, 246, 0.1)

Timestamp:
  - Color: #64748b

Service Name:
  - Color: #3b82f6
  - Font-weight: 600

Log Level (INFO):
  - Background: rgba(59, 130, 246, 0.2)
  - Color: #3b82f6
  - Padding: 2px 6px
  - Border-radius: 3px
  - Font-size: 0.75rem
  - Font-weight: 600

Message:
  - Color: #e4e4e7
```

### Service Mesh Nodes
```css
Node:
  - Width: 100px
  - Height: 100px
  - Background: #1e293b
  - Border: 2px solid #3b82f6
  - Border-radius: 12px
  - Hover: transform: scale(1.1), background: #334155

Node Icon:
  - Font-size: 2rem

Node Name:
  - Font-size: 0.75rem
  - Color: #e4e4e7

Connections (animated):
  - Background: linear-gradient(90deg, transparent, #3b82f6, transparent)
  - Height: 2px
  - Animation: dataFlow 2s linear infinite (opacity 0.2 → 1 → 0.2)
```

### Queue Cards
```css
Card:
  - Background: #0f172a
  - Border: 1px solid #334155
  - Border-radius: 8px
  - Padding: 15px
  - Hover: transform: translateY(-2px), box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3)

Queue Name:
  - Font-weight: 600
  - Color: #3b82f6

Queue Stat Label:
  - Color: #64748b
  - Font-size: 0.7rem

Queue Stat Value:
  - Color: #e4e4e7
  - Font-weight: 600
```

### Charts (Chart.js Configuration)
```javascript
Chart Options:
{
  scales: {
    x: {
      grid: { color: '#334155' },
      ticks: { color: '#94a3b8' }
    },
    y: {
      grid: { color: '#334155' },
      ticks: { color: '#94a3b8' }
    }
  },
  plugins: {
    legend: {
      labels: { color: '#e4e4e7' }
    }
  }
}

Dataset Colors:
  - Line 1: borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)'
  - Line 2: borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)'
```

## Scrollbar Styling
```css
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #0f172a;
}

::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
```

## Key Design Principles

1. **Dark Theme Foundation**: Deep navy (#0a0e27) as primary background
2. **Layered Depth**: Use darker shades for inner containers (#0f172a) vs outer panels (#1e293b)
3. **High Contrast Text**: Always use #f1f5f9 or #e4e4e7 for readable text, never #888 or dark grays
4. **Blue Gradient Accents**: Use blue-purple gradient (#3b82f6 → #8b5cf6) for primary actions and data flow
5. **Semantic Colors**: Green for success/running, Yellow for warning/pending, Red for errors
6. **Monospace Font**: JetBrains Mono for technical/operational feel
7. **Subtle Borders**: Use #334155 for separation without harshness
8. **Hover Effects**: Blue tint (rgba(59, 130, 246, 0.1)) for interactive elements
9. **Status with Alpha**: Use rgba() with 0.2 alpha for status badge backgrounds

## Application to EZ Platform Monitoring

### Current Issues
- User reports "gray colors" persist despite multiple deployments
- Current CSS uses #f1f5f9 which SHOULD be bright white (per mockup)
- Likely issue: Ant Design defaults overriding custom styles OR inline styles not matching mockup

### Solution Strategy
1. **Exact Color Replacement**: Replace ALL color values with mockup equivalents
2. **Inline Style Priority**: Use inline styles for critical elements (Ant Design override)
3. **CSS Variables**: Define variables for consistency
4. **Higher Specificity**: Use !important judiciously for Ant Design overrides

### Priority Changes

#### MetricsOverviewCards Component
```typescript
// Stat titles: Change from undefined to explicit inline style
<Statistic
  title="Total Throughput"
  titleStyle={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}
  value={metrics.totalThroughput}
  valueStyle={{ color: '#f1f5f9', fontSize: '1.5rem', fontWeight: 600 }}
/>

// Card backgrounds: Change to exact mockup color
<Card style={{ background: '#1e293b', border: '1px solid #334155' }}>
```

#### ServiceHealthGrid Component
```typescript
// Service name: Change to #f1f5f9 (brightest)
<div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f1f5f9' }}>

// Port label: Change to #94a3b8 (secondary)
<div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>

// CPU/Memory labels: Change to #94a3b8
<span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>

// Card background: Use mockup panel color
style={{ background: '#1e293b', border: '1px solid #334155' }}
```

#### PerformanceCharts Component
```typescript
// Chart axis: Use mockup values
<XAxis stroke="#334155" tick={{ fontSize: 12, fill: '#94a3b8' }} />
<YAxis stroke="#334155" tick={{ fontSize: 12, fill: '#94a3b8' }} />

// Legend text:
<Legend wrapperStyle={{ color: '#e4e4e7' }} />
```

#### EventStream Component
```typescript
// Timestamp: #64748b
// Service name: #3b82f6
// Message: #e4e4e7
// Container background: #0f172a
```

#### SystemMonitoring.css
```css
/* Add CSS variables at top */
:root {
  --bg-body: #0a0e27;
  --bg-panel: #1e293b;
  --bg-inner: #0f172a;
  --text-primary: #e4e4e7;
  --text-title: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  --border: #334155;
  --accent-blue: #3b82f6;
}

/* Apply to dashboard container */
.monitoring-dashboard {
  background: var(--bg-body);
  color: var(--text-primary);
}

/* Override Ant Design statistic */
.ant-statistic-title {
  color: var(--text-secondary) !important;
}

.ant-statistic-content {
  color: var(--text-title) !important;
}
```

## Testing Checklist

After applying colors, verify in browser:
- [ ] Stat card titles are light gray (#94a3b8), NOT dark gray
- [ ] Stat card values are bright white (#f1f5f9)
- [ ] Service card backgrounds are dark slate (#1e293b)
- [ ] Service names are bright white (#f1f5f9)
- [ ] Chart axes are visible light gray (#94a3b8)
- [ ] Event stream timestamps are medium gray (#64748b)
- [ ] Panel backgrounds are consistent (#1e293b)
- [ ] No element uses #888 or other dark grays
- [ ] Hard refresh (Ctrl+Shift+R) clears browser cache
