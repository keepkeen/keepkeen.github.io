import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { siteConfig } from './site.config.mjs';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const owner = process.env.GITHUB_REPOSITORY_OWNER;
const isUserSite = repository?.toLowerCase().endsWith('.github.io');
const inferredBase = repository && !isUserSite ? `/${repository}` : '/';
const inferredSite =
  owner && repository
    ? `https://${owner}.github.io${isUserSite ? '' : `/${repository}`}`
    : 'https://example.github.io';
const hasConfiguredSiteUrl = siteConfig.siteUrl !== 'https://example.github.io';

export default defineConfig({
  site: process.env.SITE_URL ?? (hasConfiguredSiteUrl ? siteConfig.siteUrl : inferredSite),
  base: process.env.PUBLIC_BASE_PATH ?? (process.env.GITHUB_ACTIONS ? inferredBase : '/'),
  integrations: [mdx(), sitemap()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      theme: 'github-light'
    }
  },
  scopedStyleStrategy: 'where'
});
