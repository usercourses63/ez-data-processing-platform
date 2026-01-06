// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer').themes.github;
const darkCodeTheme = require('prism-react-renderer').themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'EZ Platform v0.1.1-rc1',
  tagline: 'Data Processing Platform - Official Documentation',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://your-domain.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: '/',

  // GitHub pages deployment config
  organizationName: 'your-org',
  projectName: 'ez-platform',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  // Internationalization
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'he'],
    localeConfigs: {
      en: {
        label: 'English',
        direction: 'ltr',
        htmlLang: 'en-US',
      },
      he: {
        label: 'עברית',
        direction: 'rtl',
        htmlLang: 'he-IL',
      },
    },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Remove this to remove the "edit this page" links
          editUrl: undefined,
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themes: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      /** @type {import('@easyops-cn/docusaurus-search-local').PluginOptions} */
      ({
        hashed: true,
        language: ['en', 'he'],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      navbar: {
        title: 'EZ Platform',
        logo: {
          alt: 'EZ Platform Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentation',
          },
          {
            type: 'localeDropdown',
            position: 'right',
          },
          {
            href: 'https://github.com/your-org/ez-platform',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              {
                label: 'Getting Started',
                to: '/docs/installation',
              },
              {
                label: 'Admin Guide',
                to: '/docs/admin',
              },
              {
                label: 'Architecture',
                to: '/docs/architecture/system-architecture',
              },
            ],
          },
          {
            title: 'Resources',
            items: [
              {
                label: 'Release Notes',
                to: '/docs/release-notes',
              },
              {
                label: 'Changelog',
                to: '/docs/changelog',
              },
              {
                label: 'Deployment Guide',
                to: '/docs/deployment/deployment-plan',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} EZ Platform Team. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: ['bash', 'powershell', 'csharp', 'yaml', 'json'],
      },
      // Algolia search disabled - use local search plugin instead
      // To enable Algolia, get API keys from https://docsearch.algolia.com/
      // algolia: {
      //   appId: 'YOUR_APP_ID',
      //   apiKey: 'YOUR_SEARCH_API_KEY',
      //   indexName: 'ez-platform',
      //   contextualSearch: true,
      // },
      docs: {
        sidebar: {
          hideable: true,
          autoCollapseCategories: true,
        },
      },
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
    }),
};

module.exports = config;
