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
      label: 'User Guide / \u05DE\u05D3\u05E8\u05D9\u05DA \u05DC\u05DE\u05E9\u05EA\u05DE\u05E9',
      collapsed: false,
      items: [
        'user-guide/index',
        'user-guide/getting-started',
        'user-guide/create-datasource',
        'user-guide/import-from-file',
        'user-guide/clone-datasource',
        'user-guide/completeness',
        'user-guide/schema-validation',
        'user-guide/scheduling',
        'user-guide/monitoring',
        'user-guide/invalid-records',
        'user-guide/alerts',
        'user-guide/system-settings',
        'user-guide/troubleshooting',
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
        'components/system-monitoring',
        'components/device-health',
      ],
    },
    {
      type: 'category',
      label: 'Monitoring',
      collapsed: false,
      items: [
        'components/system-monitoring',
        'components/device-health',
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
      label: 'Architecture',
      collapsed: true,
      items: [
        'architecture/system-architecture',
        'architecture/he/system-architecture-he',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
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
