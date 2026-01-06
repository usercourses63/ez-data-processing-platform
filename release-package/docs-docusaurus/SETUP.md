# EZ Platform Documentation Setup Guide

Complete setup and deployment guide for the Docusaurus-based documentation.

## Prerequisites

- **Node.js** 18.0 or higher
- **npm** or **yarn**
- **Docker** (optional, for containerized deployment)
- **Kubernetes/Minikube** (optional, for K8s deployment)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm start
```

The documentation will be available at [http://localhost:3000](http://localhost:3000)

### 3. Build for Production

```bash
npm run build
```

Static files will be generated in the `build/` directory.

## Deployment Options

### Option 1: Docker Compose (Recommended for Testing)

```bash
# Build and start
docker-compose up -d

# Access at http://localhost:8080
```

Stop the container:
```bash
docker-compose down
```

### Option 2: Kubernetes/Minikube

**Automated deployment:**
```bash
# Windows
.\scripts\build-and-deploy.ps1

# Linux/Mac
./scripts/build-and-deploy.sh
```

**Manual deployment:**
```bash
# Build Docker image
docker build -t ez-platform-docs:latest .

# Load to minikube
minikube image load ez-platform-docs:latest

# Deploy to Kubernetes
kubectl apply -f k8s-deployment.yaml

# Check status
kubectl get pods -n ez-platform-docs

# Access the documentation
# NodePort: http://<MINIKUBE-IP>:30081
```

Get Minikube IP:
```bash
minikube ip
```

### Option 3: Static Hosting

After building, copy the `build/` directory contents to any static web server:

- **Nginx**: Copy to `/usr/share/nginx/html`
- **Apache**: Copy to `/var/www/html`
- **GitHub Pages**: Use `npm run deploy` (configure in `docusaurus.config.js`)
- **Netlify/Vercel**: Connect repository and deploy

## Configuration

### Site Metadata

Edit [docusaurus.config.js](docusaurus.config.js):

```javascript
const config = {
  title: 'EZ Platform v0.1.1-rc1',
  tagline: 'Data Processing Platform - Official Documentation',
  url: 'https://your-domain.com',
  baseUrl: '/',
  // ...
};
```

### Navigation

Edit [sidebars.js](sidebars.js) to customize sidebar navigation:

```javascript
const sidebars = {
  tutorialSidebar: [
    'index',
    {
      type: 'category',
      label: 'Getting Started',
      items: ['installation', 'installation/helm-installation'],
    },
    // ...
  ],
};
```

### Styling

Custom styles are in [src/css/custom.css](src/css/custom.css).

Key variables:
```css
:root {
  --ifm-color-primary: #2196f3;
  --ifm-color-primary-dark: #1e88e5;
  /* ... */
}
```

### Internationalization (i18n)

The site supports English and Hebrew locales:

**Switch locale in development:**
```bash
npm start -- --locale he
```

**Build all locales:**
```bash
npm run build
```

**Add translations:**
```bash
npm run write-translations -- --locale he
```

## Features

### ✅ Included

- **Modern UI** - Clean Docusaurus v3 interface
- **Dark Mode** - Automatic theme switching
- **RTL Support** - Full Hebrew support with RTL layout
- **Search** - Built-in search (Algolia-ready)
- **Mobile Responsive** - Works on all devices
- **Code Highlighting** - Syntax highlighting for multiple languages
- **Versioning** - Support for multiple documentation versions
- **Fast** - Static site generation for optimal performance

### 🚀 Future Enhancements

- Algolia search integration (requires API keys)
- Version dropdown for multiple releases
- Localized Hebrew documentation
- Interactive API explorer
- Video tutorials
- Community contributions via GitHub

## Directory Structure

```
docs-docusaurus/
├── docs/                          # Documentation markdown files
│   ├── index.md                   # Home page
│   ├── installation.md            # Installation guide
│   ├── admin.md                   # Admin guide
│   ├── installation/              # Installation subdocs
│   │   └── helm-installation.md
│   ├── architecture/              # Architecture docs
│   │   ├── system-architecture.md
│   │   └── he/
│   │       └── system-architecture-he.md
│   ├── deployment/                # Deployment guides
│   │   ├── deployment-plan.md
│   │   ├── deployment-success-summary.md
│   │   └── deployment-troubleshooting-guide.md
│   ├── user-guide-he.md           # Hebrew user guide
│   ├── release-notes.md           # Release notes
│   └── changelog.md               # Changelog
├── src/                           # Custom React components
│   └── css/
│       └── custom.css             # Custom styles
├── static/                        # Static assets
│   └── img/                       # Images
├── scripts/                       # Build scripts
│   ├── build-and-deploy.sh
│   └── build-and-deploy.ps1
├── docusaurus.config.js           # Main configuration
├── sidebars.js                    # Sidebar navigation
├── package.json                   # Dependencies
├── Dockerfile                     # Docker image
├── docker-compose.yml             # Docker Compose config
└── k8s-deployment.yaml            # Kubernetes manifests
```

## Troubleshooting

### Port Already in Use

If port 3000 is already in use:
```bash
# Use a different port
PORT=3001 npm start
```

### Build Errors

Clear cache and rebuild:
```bash
npm run clear
npm install
npm run build
```

### Docker Issues

Remove old containers and rebuild:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Kubernetes Issues

Check pod status:
```bash
kubectl get pods -n ez-platform-docs
kubectl logs -f <pod-name> -n ez-platform-docs
kubectl describe pod <pod-name> -n ez-platform-docs
```

Restart deployment:
```bash
kubectl rollout restart deployment/docs -n ez-platform-docs
```

## Maintenance

### Update Dependencies

```bash
npm update
npm audit fix
```

### Add New Documentation

1. Create a new `.md` file in `docs/`
2. Add frontmatter:
   ```yaml
   ---
   sidebar_position: 1
   title: My Page Title
   ---
   ```
3. Add to `sidebars.js` navigation
4. Test locally with `npm start`

### Add Images

1. Place images in `static/img/`
2. Reference in markdown:
   ```markdown
   ![Alt text](/img/screenshot.png)
   ```

## Support

For issues or questions:
- Check [Docusaurus documentation](https://docusaurus.io/docs)
- Review [troubleshooting guide](docs/deployment/deployment-troubleshooting-guide.md)
- Open an issue in the project repository

## Migration Notes

This documentation was migrated from MkDocs to Docusaurus to provide:

- Better React integration
- Enhanced mobile experience
- More flexible theming
- Superior search capabilities
- Built-in internationalization
- Active development and support

All original MkDocs documents have been preserved with proper formatting and navigation.

---

**Last Updated:** January 6, 2026
**Version:** 1.0.0
**Docusaurus Version:** 3.1.0
