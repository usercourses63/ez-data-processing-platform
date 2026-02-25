---
last-verified: 2026-02-02
status: current
---
# EZ Platform Architecture Documentation - Exported Formats

This directory contains the EZ Platform architecture documentation converted from HTML presentations into multiple formats suitable for network distribution and offline viewing.

## 📋 Overview

**Generated:** January 1, 2026
**Source Files:** 8 HTML presentation files (4 English + 4 Hebrew)
**Total Exports:** 30 files across 4 formats

## 📂 Directory Structure

```
exports/
├── pdf/              # PDF versions (8 files)
├── markdown/         # Markdown with embedded SVG (8 files)
├── powerpoint/       # PowerPoint presentations (8 files)
├── svg/              # Extracted SVG diagrams (6 files)
└── README.md         # This file
```

## 📄 Available Presentations

### English Presentations

1. **Architecture Overview** (`architecture-overview.*`)
   - System architecture with all 9 microservices
   - Presentation, API, Processing, and Infrastructure layers
   - Component relationships and data flow

2. **Data Pipeline** (`data-pipeline.*`)
   - End-to-end data processing workflow
   - File discovery through validation to output
   - Message broker integration (RabbitMQ/Kafka)
   - Hazelcast caching layer

3. **Observability Stack** (`observability.*`)
   - Complete monitoring infrastructure
   - OpenTelemetry pipeline
   - Dual Prometheus instances (System + Business metrics)
   - Grafana dashboards, Jaeger tracing, Elasticsearch logging

4. **Development Effort** (`development-effort.*`)
   - Team structure and roles
   - 6-month project timeline
   - Effort estimation (~47.5 person-months)
   - Budget and resource planning

### Hebrew Presentations (עברית)

All presentations also available in Hebrew with `_he` suffix:
- `architecture-overview_he.*`
- `data-pipeline_he.*`
- `observability_he.*`
- `development-effort_he.*`

## 📑 Format Details

### PDF Format (`pdf/`)

**Best for:** Printing, formal documentation, archival

- **Files:** 8 PDFs (4 English + 4 Hebrew)
- **Format:** A4 Landscape
- **Features:**
  - Preserves original HTML styling
  - Full color with gradients and backgrounds
  - Print-optimized with margins
  - Self-contained (no external dependencies)

**Use Cases:**
- Executive presentations
- Formal documentation packages
- Offline reference materials
- Printing for meetings

### Markdown Format (`markdown/`)

**Best for:** Git repositories, documentation sites, GitHub

- **Files:** 8 Markdown files
- **Features:**
  - GitHub-compatible markdown
  - Embedded SVG references
  - Inline SVG source code
  - Links to related documentation
  - Extracted legends and metadata

**Use Cases:**
- Git repository documentation
- GitHub/GitLab wikis
- Static site generators (MkDocs, Docusaurus)
- Developer documentation

**Example Structure:**
```markdown
# Architecture Diagram

![EZ Platform Architecture](../svg/architecture-overview.svg)

## Architecture Diagram (Embedded)
<svg viewBox="0 0 1200 900" ...>
...
</svg>

## Legend
- Presentation Layer (Purple): Frontend React app
- API Layer (Blue): Management services
...
```

### PowerPoint Format (`powerpoint/`)

**Best for:** Business presentations, stakeholder meetings

- **Files:** 8 PPTX files
- **Format:** 16:9 widescreen (13.33" x 7.5")
- **Features:**
  - Title slide with main heading
  - Diagram reference slide
  - Legend slide (where applicable)
  - Links to other format files

**Slide Structure:**
1. **Title Slide:** Presentation title and subtitle
2. **Diagram Reference:** Information about accessing diagrams in other formats
3. **Legend Slide:** Color coding and component explanations

**Use Cases:**
- Executive briefings
- Stakeholder presentations
- Architecture reviews
- Training sessions

### SVG Format (`svg/`)

**Best for:** High-quality diagrams, web embedding, editing

- **Files:** 6 SVG files (2 presentations have no diagrams)
- **Features:**
  - Vector graphics (infinite zoom)
  - Editable in design tools
  - Web-embeddable
  - Accessible text

**Use Cases:**
- High-resolution diagrams
- Website embedding
- Further editing in tools like:
  - Inkscape
  - Adobe Illustrator
  - Figma
  - Draw.io

## 🔧 Technical Details

### Conversion Process

**Tools Used:**
- **Playwright:** HTML to PDF conversion with browser rendering
- **BeautifulSoup4:** HTML parsing and content extraction
- **python-pptx:** PowerPoint file generation
- **Python 3.13:** Conversion script

**Conversion Script:** `convert_presentations_simple.py`

### File Sizes

| Format     | Total Size | Avg per File |
|------------|------------|--------------|
| PDF        | ~2-3 MB    | ~300-400 KB  |
| Markdown   | ~50-100 KB | ~10-15 KB    |
| PowerPoint | ~150-250 KB| ~20-30 KB    |
| SVG        | ~100-200 KB| ~20-35 KB    |

## 📖 Usage Examples

### Viewing PDFs

```bash
# Windows
start exports/pdf/architecture-overview.pdf

# macOS
open exports/pdf/architecture-overview.pdf

# Linux
xdg-open exports/pdf/architecture-overview.pdf
```

### Embedding SVG in HTML

```html
<img src="exports/svg/architecture-overview.svg"
     alt="EZ Platform Architecture"
     style="max-width: 100%; height: auto;">
```

### Using Markdown in MkDocs

```yaml
# mkdocs.yml
nav:
  - Architecture:
    - Overview: architecture/exports/markdown/architecture-overview.md
    - Pipeline: architecture/exports/markdown/data-pipeline.md
    - Observability: architecture/exports/markdown/observability.md
```

### Opening PowerPoint

```bash
# Windows
start exports/powerpoint/architecture-overview.pptx

# macOS
open -a "Microsoft PowerPoint" exports/powerpoint/architecture-overview.pptx

# Linux (LibreOffice)
libreoffice --impress exports/powerpoint/architecture-overview.pptx
```

## 🌐 Network-Safe Distribution

All exported formats are **safe for network distribution** as they:
- ✅ Contain no executable code
- ✅ Use standard file formats (PDF, MD, PPTX, SVG)
- ✅ Have no external dependencies
- ✅ Are virus-scannable
- ✅ Work offline

**Distribution Methods:**
- Email attachments
- File sharing services (Dropbox, Google Drive, OneDrive)
- Internal network shares
- USB drives
- Documentation repositories

## 📝 Maintenance

### Regenerating Exports

If the source HTML files are updated, regenerate all exports:

```bash
cd docs/architecture
python convert_presentations_simple.py
```

This will overwrite existing exports with updated versions.

### Customization

To customize the conversion process, edit `convert_presentations_simple.py`:

- **PDF settings:** Modify `page.pdf()` parameters in `html_to_pdf()`
- **Markdown format:** Edit `html_to_markdown_with_svg()` method
- **PowerPoint layout:** Adjust slide layouts in `html_to_powerpoint()`

## 🔗 Related Files

- **Original HTML:** `../architecture-overview.html`, `../data-pipeline.html`, etc.
- **Hebrew HTML:** `../he/` directory
- **Conversion Script:** `../convert_presentations_simple.py`
- **Project Documentation:** `../../CLAUDE.md`

## 📊 Content Summary

### Architecture Overview
- 9 microservices architecture
- 4-layer system design
- Event-driven messaging
- Kubernetes deployment

### Data Pipeline
- File discovery workflow
- Format conversion (CSV, JSON, XML, Excel)
- Schema validation
- Multi-destination output
- Error handling and recovery

### Observability
- OpenTelemetry pipeline
- Prometheus (System + Business metrics)
- Grafana dashboards
- Jaeger distributed tracing
- Elasticsearch logging
- Two-tier log architecture

### Development Effort
- Team size: 12-15 members
- Timeline: 6 months (26 weeks)
- Total effort: ~47.5 person-months
- Roles: PM, Architect, Developers, DevOps, QA
- Budget estimation framework

## 🆘 Support

For issues or questions:

1. **Regeneration Issues:** Check that `convert_presentations_simple.py` is in the same directory as HTML files
2. **Missing Dependencies:** Run `pip install playwright python-pptx beautifulsoup4 lxml`
3. **Browser Install:** Run `python -m playwright install chromium`
4. **Encoding Issues:** Ensure Python 3.13+ with UTF-8 support

## 📜 License

These documents are part of the EZ Platform project. All exports maintain the same licensing as the source documentation.

---

**Generated by:** `convert_presentations_simple.py`
**Date:** January 1, 2026
**Version:** 1.0
**Status:** Production Ready ✅
