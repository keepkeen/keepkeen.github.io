import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { marked } from 'marked';
import { siteConfig } from '../site.config';
import { getPlainExcerpt, getPostPath, sortPosts, stripMarkdown, withBasePath } from '../utils/content';

function toCdata(value: string) {
  return `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
}

async function renderPostHtml(body: string) {
  // Strip math blocks (KaTeX cannot render in feed readers) but keep the rest.
  const withoutMath = body.replace(/\$\$[\s\S]*?\$\$/g, '');
  return marked.parse(withoutMath, { gfm: true, async: false }) as string;
}

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
  // Keep the feed lean: newest 25 items, full HTML only for the newest 10
  // and only when a single post's HTML stays under the size cap.
  const FEED_ITEM_LIMIT = 25;
  const FULL_CONTENT_LIMIT = 10;
  const FULL_CONTENT_MAX_BYTES = 150_000;

  const items = (
    await Promise.all(
      posts.slice(0, FEED_ITEM_LIMIT).map(async (post, index) => {
        const url = new URL(getPostPath(post), siteOrigin).toString();
        const description = post.data.description || getPlainExcerpt(stripMarkdown(post.body ?? ''), 220);
        const published = post.data.date.toUTCString();
        let contentBlock = '';

        if (index < FULL_CONTENT_LIMIT) {
          const contentHtml = await renderPostHtml(post.body ?? '');

          if (contentHtml.length <= FULL_CONTENT_MAX_BYTES) {
            contentBlock = `\n  <content:encoded>${toCdata(contentHtml)}</content:encoded>`;
          }
        }

        return `<item>
  <title>${escapeXml(post.data.title)}</title>
  <link>${url}</link>
  <guid isPermaLink="true">${url}</guid>
  <pubDate>${published}</pubDate>
  <description>${escapeXml(description)}</description>${contentBlock}
  ${post.data.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join('\n  ')}
</item>`;
      })
    )
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
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
