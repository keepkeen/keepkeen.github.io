import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { siteConfig } from '../site.config';
import { getPlainExcerpt, getPostPath, sortPosts, stripMarkdown, withBasePath } from '../utils/content';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  const siteOrigin = site ?? new URL(siteConfig.siteUrl);
  const posts = sortPosts(await getCollection('posts', ({ data }) => !data.draft));
  const feedUrl = new URL(withBasePath('/rss.xml'), siteOrigin).toString();
  const homepage = new URL(withBasePath('/'), siteOrigin).toString();
  const lastBuildDate = (posts[0]?.data.updatedDate ?? posts[0]?.data.date ?? new Date()).toUTCString();
  const items = posts
    .map((post) => {
      const url = new URL(getPostPath(post), siteOrigin).toString();
      const description = post.data.description || getPlainExcerpt(stripMarkdown(post.body ?? ''), 220);
      const published = post.data.date.toUTCString();

      return `<item>
  <title>${escapeXml(post.data.title)}</title>
  <link>${url}</link>
  <guid isPermaLink="true">${url}</guid>
  <pubDate>${published}</pubDate>
  <description>${escapeXml(description)}</description>
  ${post.data.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join('\n  ')}
</item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXml(siteConfig.name)}</title>
  <link>${homepage}</link>
  <description>${escapeXml(siteConfig.description)}</description>
  <language>en</language>
  <lastBuildDate>${lastBuildDate}</lastBuildDate>
  <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
  ${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8'
    }
  });
};
