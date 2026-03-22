import type { APIRoute } from 'astro';
import { siteConfig } from '../site.config';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapLines(value: string, maxLength: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
      return;
    }

    current = next;
  });

  if (current) {
    lines.push(current);
  }

  return lines;
}

export const GET: APIRoute = () => {
  const lines = wrapLines(siteConfig.description, 42).slice(0, 3);
  const lineMarkup = lines
    .map(
      (line, index) =>
        `<text x="72" y="${302 + index * 48}" fill="#364152" font-family="Inter, Arial, sans-serif" font-size="34">${escapeXml(line)}</text>`
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(siteConfig.name)} social card">
  <rect width="1200" height="630" fill="#f7f7f4" />
  <rect x="48" y="48" width="1104" height="534" rx="24" fill="#ffffff" stroke="#d7dce5" stroke-width="2" />
  <text x="72" y="132" fill="#64748b" font-family="JetBrains Mono, monospace" font-size="24">${escapeXml(siteConfig.name.toUpperCase())}</text>
  <text x="72" y="238" fill="#111827" font-family="Inter, Arial, sans-serif" font-size="70" font-weight="700">${escapeXml(siteConfig.defaultTitle.split('|')[0].trim())}</text>
  ${lineMarkup}
  <line x1="72" y1="516" x2="1128" y2="516" stroke="#d7dce5" stroke-width="2" />
  <text x="72" y="562" fill="#64748b" font-family="JetBrains Mono, monospace" font-size="24">Technical writing, notes, and systems thinking.</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8'
    }
  });
};
