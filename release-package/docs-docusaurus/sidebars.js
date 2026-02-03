/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 * The sidebars can be generated from the filesystem, or explicitly defined here.

 * Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    'index',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'installation',
        'installation/helm-installation',
      ],
    },
    {
      type: 'category',
      label: 'Administration',
      collapsed: false,
      items: [
        'admin',
      ],
    },
    {
      type: 'category',
      label: 'User Guide',
      collapsed: false,
      items: [
        'user-guide-he',
      ],
    },
    {
      type: 'category',
      label: 'Components',
      collapsed: false,
      items: [
        'components/index',
        'components/datasource-forms',
        'components/schema-editor',
        'components/nas-devices',
      ],
    },
    {
      type: 'category',
      label: 'Development',
      collapsed: false,
      items: [
        'development/index',
        'development/api-coordination',
        'development/react19-patterns',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      items: [
        'architecture/ARCHITECTURE',      // Consolidated architecture guide
        'deployment/DEPLOYMENT',          // Consolidated deployment guide
        'testing/TESTING',                // Consolidated testing guide
      ],
    },
    {
      type: 'category',
      label: 'Architecture (Legacy)',
      collapsed: true,
      items: [
        'architecture/system-architecture',
        'architecture/he/system-architecture-he',
      ],
    },
    {
      type: 'category',
      label: 'Deployment (Legacy)',
      collapsed: true,
      items: [
        'deployment/deployment-plan',
        'deployment/deployment-success-summary',
        'deployment/deployment-troubleshooting-guide',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: false,
      items: [
        'release-notes',
        'changelog',
      ],
    },
  ],
};

module.exports = sidebars;
