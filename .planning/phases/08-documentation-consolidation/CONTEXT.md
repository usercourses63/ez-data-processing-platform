# Phase 8: Documentation Consolidation - Context

**Created:** 2026-02-02
**Phase Goal:** GSD becomes single source of truth, all guides consolidated
**Requirements:** DOC-04, DOC-05

## Decision Summary

This document captures architectural decisions made during the discussion phase. These decisions guide research and planning work.

---

## 1. Consolidation Approach

**Decision:** Extract and synthesize from scattered sources

**Rationale:**
- Create clear, non-redundant documentation
- Write cohesive narrative that synthesizes information from multiple sources
- Avoid copy-paste redundancies and inconsistent voice
- Balance effort with quality outcome

**Implementation:**
- Read all source documents for each guide (Architecture, Deployment, Testing)
- Extract key insights and technical details
- Write new unified narrative with consistent structure and voice
- Preserve technical accuracy while improving clarity

**Conflict Resolution:**
- Trust newest documentation when contradictions found
- Use last-modified date or git history to determine currency
- Simple rule that avoids analysis paralysis
- Acknowledge newest isn't always most accurate, but provides clear decision criteria

---

## 2. Guide Structure

**Decision:** Multi-level with clear sections

**Target Audiences:**
1. **Overview Section:** High-level summary for all readers
2. **Operations Section:** Runbooks, procedures, commands for operators
3. **Development Section:** Implementation details, patterns, code organization for developers
4. **Architecture Section:** System design, component interactions, trade-offs for architects

**Structure Template:**
```markdown
# [Guide Name]

## Overview
High-level summary, purpose, scope

## Operations
- Deployment procedures
- Configuration management
- Troubleshooting runbooks
- Health check procedures

## Development
- Code organization
- Development workflow
- Build and test procedures
- Integration patterns

## Architecture
- System design
- Component interactions
- Design decisions and trade-offs
- Scalability considerations
```

**Benefits:**
- Single document serves multiple audiences
- Clear navigation via section headers
- Avoids audience confusion
- Comprehensive without duplication

---

## 3. GSD vs Docusaurus Split

**Decision:** Operational/reference split with automation context

**Content Distribution:**

### Docusaurus (docs/)
**Purpose:** Human-readable operational documentation and guides
**Contains:**
- User guides (Hebrew and English)
- Architecture guide (consolidated, multi-level)
- Deployment guide (OCP procedures, runbooks)
- Testing guide (how to run tests, coverage)
- README.md, CHANGELOG.md (project entry points)
- API reference documentation
- Operational procedures
- Troubleshooting guides

**Characteristics:**
- Stable, published content
- Formatted for human consumption
- Updated through controlled process
- Deployed to /docs ingress path

### GSD (.planning/)
**Purpose:** Automated system activities for continuous development, testing, deployment
**Contains:**
- PROJECT.md (canonical project definition)
- ROADMAP.md (phase roadmap)
- REQUIREMENTS.md (requirement traceability)
- STATE.md (current work state)
- Phase directories with plans (RESEARCH.md, PLAN.md, SUMMARY.md, VERIFICATION.md)
- CONTEXT.md files (phase-specific decisions)
- Todo tracking
- Execution logs
- Work-in-progress artifacts

**Characteristics:**
- Dynamic, machine-readable content
- Optimized for GSD workflow automation
- Frequently updated during phases
- Not deployed externally

**Migration Strategy:**
- No duplication between GSD and Docusaurus
- Clear ownership: planning artifacts → GSD, operational guides → Docusaurus
- Completed phase documentation can inform Docusaurus updates

---

## 4. Maintenance Strategy

### 4.1 Freshness Tracking

**Decision:** YAML frontmatter dates

**Implementation:**
- Add `last-verified: YYYY-MM-DD` field to all consolidated guides
- Require update when referenced files older than 30 days
- Simple tracking mechanism
- Relies on discipline during code changes

**Example:**
```yaml
---
title: Architecture Guide
last-verified: 2026-02-02
status: active
audience: [operators, developers, architects]
---
```

### 4.2 Sync Workflow

**Decision:** Block PR until docs updated

**Policy:**
- Code changes that affect documentation require doc updates in same PR
- CI/CD pipeline should flag stale docs (last-verified > 30 days old)
- No merge until documentation updated
- Ensures synchronization but adds development friction

**Benefits:**
- Zero drift between code and docs
- Documentation as first-class deliverable
- Forces consideration of documentation impact

**Trade-off:**
- Adds friction to development workflow
- Requires discipline and enforcement

### 4.3 Ownership Model

**Decision:** GSD workflow ownership

**Implementation:**
- Future phases include documentation updates as part of implementation work
- Documentation is first-class deliverable in every phase success criteria
- Phase verification checks for documentation completeness
- Example: Phase 10 (Feature Completion) includes "External File Access v0.2.0 documentation complete in GSD structure"

**Benefits:**
- Documentation integrated into development workflow
- No separate documentation phase needed
- Continuous maintenance rather than catch-up work

### 4.4 Legacy Content

**Decision:** Archive to docs/archive/

**Process:**
1. Move superseded documentation to `docs/archive/[category]/`
2. Add YAML frontmatter explaining superseded-by:
   ```yaml
   ---
   status: archived
   archived-date: 2026-02-02
   superseded-by: docs/architecture/ARCHITECTURE.md
   reason: Consolidated into unified architecture guide
   ---
   ```
3. Preserve git history via `git mv`
4. Update DOCUMENTATION-INDEX.md to reflect archive location

**Benefits:**
- Preserves historical context
- Clear migration path for readers
- Searchable archive for reference
- Clean separation of active vs archived docs

---

## Research Guidance

When creating RESEARCH.md for this phase, investigate:

1. **Source Inventory:**
   - Identify all current architecture/deployment/testing docs
   - Map content overlap and contradictions
   - Determine newest versions via git history

2. **Content Analysis:**
   - What sections/topics exist across scattered docs?
   - What gaps exist in current documentation?
   - What audience needs are currently unmet?

3. **Structure Design:**
   - How to organize multi-level sections effectively?
   - What navigation aids needed (TOC, cross-references)?
   - How to balance depth vs accessibility?

4. **Docusaurus Integration:**
   - Current docs/ structure and what needs consolidation
   - How to structure guides for Docusaurus rendering
   - Navigation hierarchy for consolidated content

5. **YAML Frontmatter Schema:**
   - Required fields for active documentation
   - Required fields for archived documentation
   - Validation approach

---

## Planning Guidance

When creating PLAN.md for this phase, consider task breakdown:

1. **Architecture Guide Consolidation**
   - Identify source documents
   - Extract and synthesize content
   - Structure with multi-level sections
   - Add YAML frontmatter
   - Archive superseded docs

2. **Deployment Guide Consolidation**
   - Merge OCP procedures
   - Create runbook-style operations section
   - Document current deployment workflow
   - Archive old deployment docs

3. **Testing Guide Consolidation**
   - Document test strategy
   - Provide running instructions
   - Document coverage approach
   - Include E2E-first rationale

4. **GSD Structure Finalization**
   - Ensure .planning/ contains all active planning docs
   - Verify no planning/execution docs outside .planning/
   - Document GSD workflow ownership model

5. **Documentation Maintenance Setup**
   - Define YAML frontmatter schema
   - Create CI/CD freshness check
   - Document PR documentation policy
   - Update CLAUDE.md with maintenance guidelines

---

## Success Criteria Interpretation

Based on ROADMAP.md success criteria:

1. ✅ **.planning/ contains all active project planning documentation**
   - Already true post-Phase 7
   - Verify no new planning docs in docs/

2. ✅ **Architecture guide consolidated from scattered sources into coherent document**
   - Single ARCHITECTURE.md in docs/architecture/
   - Multi-level sections (Overview, Operations, Development, Architecture)
   - YAML frontmatter with last-verified date
   - Old versions archived to docs/archive/architecture/

3. ✅ **Deployment guide consolidated with current OCP procedures**
   - Single DEPLOYMENT.md in docs/deployment/
   - Multi-level sections including operational runbooks
   - Current OCP v4.x procedures documented
   - Old deployment docs archived

4. ✅ **Testing guide documents test strategy, running tests, and coverage**
   - Single TESTING.md in docs/testing/
   - E2E-first strategy explained
   - Instructions for running all test types
   - Coverage targets and rationale

5. ✅ **No planning/execution docs exist outside .planning/ structure**
   - Audit for stray planning docs in docs/
   - Migrate or archive as appropriate
   - GSD workflow fully contained in .planning/

---

## Next Steps

1. **Research Phase:** `/gsd:research-phase 8`
   - Inventory existing architecture/deployment/testing docs
   - Analyze content and identify consolidation approach
   - Design guide structure and YAML schema
   - Output: 08-RESEARCH.md

2. **Planning Phase:** `/gsd:plan-phase 8`
   - Create detailed execution plan
   - Break down into tasks with verification criteria
   - Define waves and dependencies
   - Output: 08-01-PLAN.md, 08-02-PLAN.md, etc.

3. **Execution Phase:** `/gsd:execute-phase 8`
   - Execute plans with wave-based parallelization
   - Verify after each plan completes
   - Commit atomically with descriptive messages
   - Output: Consolidated guides, archived legacy docs, updated indexes

---

*Context created: 2026-02-02*
*Discussion completed: 8 questions across 4 gray areas*
*Ready for research phase*
