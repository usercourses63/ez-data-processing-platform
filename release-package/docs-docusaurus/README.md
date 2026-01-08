# EZ Platform Documentation (Docusaurus)

This directory contains the Docusaurus-based documentation for EZ Platform v0.1.1-rc2.

## Installation

```bash
npm install
```

## Local Development

```bash
npm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```bash
npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

### Using SSH:

```bash
USE_SSH=true npm run deploy
```

### Not using SSH:

```bash
GIT_USER=<Your GitHub username> npm run deploy
```

## Features

- **Modern UI** - Clean, responsive design with Docusaurus
- **Dark Mode** - Automatic dark/light theme switching
- **RTL Support** - Full Hebrew/Arabic right-to-left support
- **Search** - Built-in search functionality (Algolia compatible)
- **Versioning** - Support for multiple documentation versions
- **i18n** - Internationalization with English and Hebrew locales

## Directory Structure

```
docs-docusaurus/
├── docs/                    # Documentation markdown files
│   ├── installation/        # Installation guides
│   ├── architecture/        # System architecture
│   ├── deployment/          # Deployment guides
│   └── ...
├── src/                     # Custom components
│   └── css/                 # Custom styles
├── static/                  # Static assets (images, files)
│   └── img/                 # Images
├── docusaurus.config.js     # Site configuration
├── sidebars.js              # Sidebar navigation
└── package.json             # Dependencies
```

## Migration from MkDocs

This documentation was migrated from MkDocs to Docusaurus, providing:

- Better React integration
- Enhanced search capabilities
- More flexible theming
- Better mobile experience
- Plugin ecosystem

All documents from the original MkDocs setup have been migrated with proper frontmatter and navigation structure.
