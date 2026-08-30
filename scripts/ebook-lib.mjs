const CJK_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}　-〿＀-￯]/u;

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function charUnits(char) {
  if (char === ' ') return 0.3;
  return CJK_PATTERN.test(char) ? 1 : 0.52;
}

function textUnits(value) {
  return [...String(value)].reduce((sum, char) => sum + charUnits(char), 0);
}

function balanceCoverTitleLines(lines, minimumLastLineUnits = 4.5) {
  if (lines.length < 2 || textUnits(lines.at(-1)) >= minimumLastLineUnits) return lines;

  const balanced = [...lines];
  const previous = [...balanced.at(-2)];
  const last = [...balanced.at(-1)];
  const wordCharacter = /[\p{Letter}\p{Number}_-]/u;
  const targetUnits = Math.min(
    minimumLastLineUnits,
    (textUnits(previous.join('')) + textUnits(last.join(''))) / 2
  );

  while (previous.length > 1 && textUnits(last.join('')) < targetUnits) {
    last.unshift(previous.pop());
  }
  // If the split now lands inside a Latin word, move the rest of that word too.
  while (
    previous.length > 1 &&
    wordCharacter.test(previous.at(-1)) &&
    wordCharacter.test(last[0]) &&
    !CJK_PATTERN.test(previous.at(-1)) &&
    !CJK_PATTERN.test(last[0])
  ) {
    last.unshift(previous.pop());
  }

  balanced[balanced.length - 2] = previous.join('').trimEnd();
  balanced[balanced.length - 1] = last.join('').trimStart();
  return balanced;
}

export function wrapMixedText(value, maxUnits, maxLines) {
  const tokens =
    String(value).match(
      /[\p{Script=Han}]|[、。，．：；！？《》〈〉「」『』（）【】…—～·]|[^\s\p{Script=Han}、。，．：；！？《》〈〉「」『』（）【】…—～·]+|\s+/gu
    ) ?? [];
  const lines = [];
  let current = '';
  let currentUnits = 0;
  let truncated = false;
  const closingPunctuation = /^[、。，．：；！？》」』）】…,.;:!?)]/u;

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (current) {
        current += ' ';
        currentUnits += 0.3;
      }
      continue;
    }

    const units = [...token].reduce((sum, char) => sum + charUnits(char), 0);
    if (closingPunctuation.test(token) && current.trim()) {
      current += token;
      currentUnits += units;
      continue;
    }

    if (currentUnits + units > maxUnits && current.trim()) {
      lines.push(current.trimEnd());
      if (lines.length >= maxLines) {
        truncated = true;
        current = '';
        break;
      }
      current = token;
      currentUnits = units;
      continue;
    }

    current += token;
    currentUnits += units;
  }

  if (current.trim() && lines.length < maxLines) {
    lines.push(current.trimEnd());
  } else if (current.trim()) {
    truncated = true;
  }

  if (truncated && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[\s,;:，、；：.。]+$/u, '')}…`;
  }
  return lines;
}

export function slugFromPostFile(file) {
  return file.replace(/\.(md|mdx)$/u, '').replace(/^\d{4}-\d{2}-\d{2}-/u, '');
}

export function normalizeTexForMathml(tex) {
  return String(tex).replace(/\{\\rm\s+([^{}]+)\}/gu, '{\\mathrm{$1}}');
}

export function sanitizeFilenameSegment(value, maxBytes = 180) {
  const normalized = String(value)
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .replace(/[. ]+$/gu, '')
    .trim();
  if (!normalized) throw new Error('EPUB filename segment is empty after sanitization');

  let result = '';
  for (const character of normalized) {
    if (Buffer.byteLength(result + character, 'utf8') > maxBytes) break;
    result += character;
  }
  return result.replace(/[. ]+$/gu, '').trim();
}

export function buildSeriesFilename(title, seriesOrder) {
  if (!Number.isInteger(seriesOrder) || seriesOrder < 1) {
    throw new Error(`Invalid ebook series order: ${seriesOrder}`);
  }
  const withoutExistingOrder = String(title).replace(/^\s*\d+\s*[.．、:：-]\s*/u, '');
  const prefix = String(seriesOrder).padStart(2, '0');
  return `${prefix} ${sanitizeFilenameSegment(withoutExistingOrder)}`;
}

export function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ebook date: ${value}`);
  }
  return date.toISOString();
}

export function scaleSvgIntrinsicSize(svg, factor) {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error(`SVG scale must be positive, received ${factor}`);
  }
  return svg.replace(/^<svg\b[^>]*>/u, (root) =>
    root.replace(/\b(width|height)="([0-9]+(?:\.[0-9]+)?)ex"/gu, (_, attribute, value) => {
      const scaled = Number.parseFloat(value) * factor;
      return `${attribute}="${Number(scaled.toFixed(3))}ex"`;
    })
  );
}

export function buildCoverSvg({ title, description, date, author, seriesTitle, seriesOrder }) {
  const titleFontSize = 66;
  const titleLineHeight = 100;
  // Leave enough room for a trailing Chinese closing punctuation mark, which
  // wrapMixedText keeps attached to the preceding line.
  const titleLines = balanceCoverTitleLines(wrapMixedText(title, 14.3, 5));
  const descriptionLines = wrapMixedText(description, 27, 4);
  const seriesLabel = `${seriesTitle} · 第 ${String(seriesOrder).padStart(2, '0')} 篇`;
  const titleMarkup = titleLines
    .map(
      (line, index) =>
        `<text x="92" y="${410 + index * titleLineHeight}" font-size="${titleFontSize}" font-weight="700">${escapeXml(line)}</text>`
    )
    .join('\n  ');
  const descriptionTop = 410 + titleLines.length * titleLineHeight + 42;
  const descriptionMarkup = descriptionLines
    .map(
      (line, index) =>
        `<text x="92" y="${descriptionTop + index * 58}" font-size="34">${escapeXml(line)}</text>`
    )
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
  <rect width="1200" height="1600" fill="#fff"/>
  <rect width="1200" height="112" fill="#000"/>
  <g font-family="Noto Serif CJK SC, Noto Serif, Songti SC, serif" fill="#000">
    <text x="92" y="76" font-size="30" font-weight="700" letter-spacing="6" fill="#fff">KEEPKEEN · 博客电子书</text>
    <text x="92" y="205" font-size="31" font-weight="700">${escapeXml(seriesLabel)}</text>
    <line x1="92" y1="238" x2="1108" y2="238" stroke="#000" stroke-width="5"/>
    ${titleMarkup}
    ${descriptionMarkup}
    <line x1="92" y1="1428" x2="1108" y2="1428" stroke="#000" stroke-width="3"/>
    <text x="92" y="1492" font-size="28" font-weight="700">${escapeXml(author)} · ${escapeXml(String(date).slice(0, 10))}</text>
    <text x="92" y="1542" font-size="24">MathML · Kindle / KOReader EPUB</text>
  </g>
</svg>`;
}

export function buildOpds(entries, catalog) {
  const feedUrl = new URL(catalog.feedPath, catalog.siteUrl).toString();
  const startUrl = new URL(catalog.startPath ?? catalog.feedPath, catalog.siteUrl).toString();
  const updated = entries
    .map((entry) => entry.updated)
    .sort()
    .at(-1) ?? new Date(0).toISOString();
  const entryXml = entries
    .map(
      (entry) => `  <entry>
    <id>${escapeXml(entry.id)}</id>
    <title>${escapeXml(entry.title)}</title>
    <updated>${escapeXml(entry.updated)}</updated>
    <published>${escapeXml(entry.published)}</published>
    <author><name>${escapeXml(catalog.author)}</name></author>
    <summary type="text">${escapeXml(entry.description)}</summary>
    <dc:language>${escapeXml(catalog.language)}</dc:language>
    <dc:issued>${escapeXml(entry.published.slice(0, 10))}</dc:issued>
    <category term="${escapeXml(entry.seriesSlug)}" label="${escapeXml(entry.seriesTitle)}"/>
    <link rel="http://opds-spec.org/acquisition" href="${escapeXml(entry.epubUrl)}" type="application/epub+zip" length="${entry.bytes}"/>
    <link rel="http://opds-spec.org/image" href="${escapeXml(entry.coverUrl)}" type="image/png"/>
    <link rel="http://opds-spec.org/image/thumbnail" href="${escapeXml(entry.coverUrl)}" type="image/png"/>
    <link rel="alternate" href="${escapeXml(entry.articleUrl)}" type="text/html"/>
  </entry>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by scripts/build-ebooks.mjs; do not edit. -->
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:dc="http://purl.org/dc/terms/"
      xmlns:fh="http://purl.org/syndication/history/1.0">
  <id>${escapeXml(feedUrl)}</id>
  <title>${escapeXml(catalog.title)}</title>
  <updated>${escapeXml(updated)}</updated>
  <author><name>${escapeXml(catalog.author)}</name></author>
  <subtitle>${escapeXml(catalog.description)}</subtitle>
  <link rel="self" href="${escapeXml(feedUrl)}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  <link rel="start" href="${escapeXml(startUrl)}" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="http://opds-spec.org/crawlable" href="${escapeXml(feedUrl)}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  <fh:complete/>
${entryXml}
</feed>
`;
}

export function buildOpdsNavigation(sections, catalog) {
  const feedUrl = new URL(catalog.feedPath, catalog.siteUrl).toString();
  const updated = sections
    .map((section) => section.updated)
    .sort()
    .at(-1) ?? new Date(0).toISOString();
  const sectionXml = sections
    .map(
      (section) => `  <entry>
    <id>${escapeXml(section.feedUrl)}</id>
    <title>${escapeXml(section.title)}</title>
    <updated>${escapeXml(section.updated)}</updated>
    <content type="text">${escapeXml(`${section.count} 本 · ${section.description}`)}</content>
    <link rel="subsection" href="${escapeXml(section.feedUrl)}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  </entry>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by scripts/build-ebooks.mjs; do not edit. -->
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escapeXml(feedUrl)}</id>
  <title>${escapeXml(catalog.title)}</title>
  <updated>${escapeXml(updated)}</updated>
  <author><name>${escapeXml(catalog.author)}</name></author>
  <subtitle>${escapeXml(catalog.description)}</subtitle>
  <link rel="self" href="${escapeXml(feedUrl)}" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="start" href="${escapeXml(feedUrl)}" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
${sectionXml}
</feed>
`;
}
