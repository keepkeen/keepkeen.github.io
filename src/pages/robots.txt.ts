import type { APIRoute } from 'astro';
import { siteConfig } from '../site.config';
import { withBasePath } from '../utils/content';

export const GET: APIRoute = ({ site }) => {
  const siteOrigin = site ?? new URL(siteConfig.siteUrl);
  const robots = [
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${new URL(withBasePath('/sitemap-index.xml'), siteOrigin).toString()}`
  ].join('\n');

  return new Response(robots, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
