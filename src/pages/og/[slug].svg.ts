import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { siteConfig } from '../../site.config';
import { getPostSlug, sortPosts } from '../../utils/content';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapLines(value: string, maxLength: number, maxLines = 3) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
      continue;
    }

    current = next;
  }

  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

export async function getStaticPaths() {
  const posts = sortPosts(await getCollection('posts', ({ data }) => !data.draft));

  return posts.map((post) => ({
    params: { slug: getPostSlug(post) },
    props: { post }
  }));
}

export const GET: APIRoute = ({ props }) => {
  const { post } = props;
  const titleLines = wrapLines(post.data.title, 28, 2);
  const descriptionLines = wrapLines(post.data.description, 42, 3);
  const tags = post.data.tags.slice(0, 4).join(' · ');

  const titleMarkup = titleLines
    .map(
      (line, index) =>
        `<text x="72" y="${210 + index * 58}" fill="#111827" font-family="Inter, Arial, sans-serif" font-size="52" font-weight="700">${escapeXml(line)}</text>`
    )
    .join('');

  const descriptionMarkup = descriptionLines
    .map(
      (line, index) =>
        `<text x="72" y="${340 + index * 40}" fill="#364152" font-family="Inter, Arial, sans-serif" font-size="28">${escapeXml(line)}</text>`
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(post.data.title)}">
  <rect width="1200" height="630" fill="#f7f7f4" />
  <rect x="48" y="48" width="1104" height="534" rx="24" fill="#ffffff" stroke="#d7dce5" stroke-width="2" />
  <text x="72" y="120" fill="#64748b" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="22">${escapeXml(siteConfig.name.toUpperCase())}</text>
  ${titleMarkup}
  ${descriptionMarkup}
  <line x1="72" y1="516" x2="1128" y2="516" stroke="#d7dce5" stroke-width="2" />
  <text x="72" y="562" fill="#64748b" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="22">${escapeXml(tags || 'Essay')}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    }
  });
};
