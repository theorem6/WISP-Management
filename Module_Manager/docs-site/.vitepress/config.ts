import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'WISP Management Documentation',
  description: 'Complete documentation for WISP Management (wisptools.io) - LTE WISP Management Platform',
  
  // Base URL (adjust if deploying to subdirectory)
  base: '/',
  
  // Theme configuration
  themeConfig: {
    // Logo (optional)
    // logo: '/logo.png',
    
    // Navigation
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Guides', link: '/guides/' },
      { text: 'API', link: '/api/' },
      { text: 'Deployment', link: '/deployment/' },
      { text: 'Reference', link: '/reference/' }
    ],
    
    // Sidebar
    sidebar: {
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/getting-started/' },
            { text: 'Quick Start', link: '/getting-started/quick-start' },
            { text: 'Installation', link: '/getting-started/installation' },
            { text: 'Configuration', link: '/getting-started/configuration' }
          ]
        }
      ],
      '/guides/': [
        {
          text: 'User Guides',
          items: [
            { text: 'User Roles & Permissions', link: '/guides/user-guides/user-roles' }
          ]
        },
        {
          text: 'Administrator Guides',
          items: [
            { text: 'Multi-Tenant Setup', link: '/guides/admin-guides/multi-tenant-setup' },
            { text: 'HSS Production Guide', link: '/guides/admin-guides/hss-production' },
            { text: 'Admin & User Management', link: '/guides/admin-guides/admin-user-management' },
            { text: 'Tenant Deletion Guide', link: '/guides/admin-guides/tenant-deletion' }
          ]
        },
        {
          text: 'Developer Guides',
          items: [
            { text: 'Database Structure', link: '/guides/developer-guides/database-structure' },
            { text: 'Data Model', link: '/guides/developer-guides/data-model' }
          ]
        },
        {
          text: 'Integration Guides',
          items: [
            { text: 'CBRS/SAS Setup', link: '/guides/integration-guides/cbrs-setup' },
            { text: 'Google OAuth Setup', link: '/guides/integration-guides/google-oauth' }
          ]
        }
      ],
      '/deployment/': [
        {
          text: 'Deployment',
          items: [
            { text: 'Overview', link: '/deployment/' },
            { text: 'Backend Deployment', link: '/deployment/backend' },
            { text: 'Infrastructure Setup', link: '/deployment/infrastructure' }
          ]
        }
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Overview', link: '/reference/' },
            { text: 'Project Status & Next Steps', link: '/reference/project-status' }
          ]
        }
      ]
    },
    
    // Social links
    socialLinks: [
      // { icon: 'github', link: 'https://github.com/yourorg/wisptools' }
    ],
    
    // Footer
    footer: {
      message: 'WISP Management Documentation',
      copyright: 'Copyright © 2025 wisptools.io'
    },
    
    // Search
    search: {
      provider: 'local'
    },
    
    // Edit link
    editLink: {
      // pattern: 'https://github.com/yourorg/wisptools/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    }
  },
  
  // Markdown configuration
  markdown: {
    lineNumbers: true,
    config: (md) => {
      // You can add markdown plugins here
    }
  },
  
  // Ignore dead links for now (we'll fix them as we add more content)
  ignoreDeadLinks: true
})

