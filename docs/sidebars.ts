import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';
import apiSidebar from './docs/api/sidebar';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'introduction',
    'installation',
    'getting-started',
    {
      type: 'category',
      label: 'Configuration',
      items: [
        'configuration/overview',
        'configuration/environment',
        'configuration/files',
        'configuration/github',
        'configuration/ai-agents',
        'configuration/tailscale',
      ],
    },
    'cli',
    'workflows',
    'web-ui',
    'troubleshooting',
    {
      type: 'category',
      label: 'API Reference',
      link: {
        type: 'generated-index',
        title: 'Perry API Reference',
        description: 'REST API for programmatic access to Perry workspaces and sessions.',
        slug: '/api',
      },
      items: apiSidebar,
    },
  ],
};

export default sidebars;
