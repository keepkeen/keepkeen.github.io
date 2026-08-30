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

function decodeXmlText(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/giu, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/gu, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function parseSvgViewBox(svg) {
  const match = String(svg).match(
    /^<svg\b[^>]*\bviewBox="([+-]?[\d.]+)\s+([+-]?[\d.]+)\s+([\d.]+)\s+([\d.]+)"/u
  );
  if (!match) return null;
  const viewBox = match.slice(1).map(Number);
  return viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0
    ? viewBox
    : null;
}

function extractMermaidNodeBounds(svg) {
  const matches = [...String(svg).matchAll(
    /<g class="node\b[^>]*\btransform="translate\(\s*([+-]?[\d.]+)(?:\s*,\s*|\s+)([+-]?[\d.]+)\s*\)"/gu
  )];
  return matches.flatMap((match, index) => {
    const centerX = Number(match[1]);
    const centerY = Number(match[2]);
    const segment = String(svg).slice(
      match.index,
      matches[index + 1]?.index ?? Math.min(String(svg).length, match.index + 3000)
    );
    const widthMatch = segment.match(/<foreignObject\b[^>]*\bwidth="([\d.]+)"/u);
    const heightMatch = segment.match(/<foreignObject\b[^>]*\bheight="([\d.]+)"/u);
    const labelWidth = Number(widthMatch?.[1]);
    const labelHeight = Number(heightMatch?.[1]);
    if (
      !Number.isFinite(centerX) ||
      !Number.isFinite(centerY) ||
      !Number.isFinite(labelWidth) ||
      !Number.isFinite(labelHeight)
    ) return [];
    // Mermaid's standard flowchart node adds 30 units of horizontal padding
    // on either side of its foreignObject label.
    const halfWidth = labelWidth / 2 + 30;
    const halfHeight = labelHeight / 2 + 15;
    return [[
      centerX - halfWidth,
      centerX + halfWidth,
      centerY - halfHeight,
      centerY + halfHeight
    ]];
  });
}

function chooseAxisSegments(origin, length, targetLength, intervals) {
  if (length <= targetLength * 1.1) return [[origin, length]];

  const clippedIntervals = intervals
    .map(([start, end]) => [
      Math.max(origin, start),
      Math.min(origin + length, end)
    ])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let occupiedEnd = origin;
  for (const [start, end] of clippedIntervals) {
    if (start > occupiedEnd + 12) gaps.push((occupiedEnd + start) / 2);
    occupiedEnd = Math.max(occupiedEnd, end);
  }

  const boundaries = [origin];
  let start = origin;
  const farEdge = origin + length;
  while (farEdge - start > targetLength * 1.1) {
    const desired = start + targetLength;
    const candidates = gaps.filter(
      (gap) => gap > start + targetLength * 0.62 && gap < start + targetLength * 1.1
    );
    const boundary = candidates.length > 0
      ? candidates.reduce((best, gap) =>
          Math.abs(gap - desired) < Math.abs(best - desired) ? gap : best
        )
      : desired;
    if (boundary <= start + 1) break;
    boundaries.push(boundary);
    start = boundary;
  }
  boundaries.push(farEdge);

  const overlap = Math.min(18, targetLength * 0.035);
  return boundaries.slice(0, -1).map((boundary, index) => {
    let panelStart = index === 0 ? origin : boundary - overlap;
    let panelEnd = index === boundaries.length - 2
      ? farEdge
      : boundaries[index + 1] + overlap;
    const missingLength = targetLength - (panelEnd - panelStart);
    if (missingLength > 0) {
      const availableLeft = panelStart - origin;
      const expandLeft = Math.min(availableLeft, missingLength / 2);
      panelStart -= expandLeft;
      panelEnd = Math.min(farEdge, panelEnd + missingLength - expandLeft);
      panelStart = Math.max(
        origin,
        panelStart - Math.max(0, targetLength - (panelEnd - panelStart))
      );
    }
    return [panelStart, panelEnd - panelStart];
  });
}

function chooseDiagramPanelViewBoxes(svg, viewBox) {
  const [originX, originY, width, height] = viewBox;
  const nodeBounds = extractMermaidNodeBounds(svg);
  // With a 758 × 900-ish usable Kindle viewport, these source-space limits
  // keep a 16-unit Mermaid label at about 20 px or larger after fit-to-page.
  const horizontal = chooseAxisSegments(
    originX,
    width,
    500,
    nodeBounds.map(([start, end]) => [start, end])
  );
  const vertical = chooseAxisSegments(
    originY,
    height,
    600,
    nodeBounds.map(([, , start, end]) => [start, end])
  );
  if (horizontal.length === 1 && vertical.length === 1) return [];
  return vertical.flatMap(([panelY, panelHeight]) =>
    horizontal.map(([panelX, panelWidth]) => [panelX, panelY, panelWidth, panelHeight])
  );
}

function replaceSvgRootDimensions(svg, viewBox) {
  const [, , width, height] = viewBox;
  return String(svg).replace(/^<svg\b[^>]*>/u, (root) => {
    const withoutDimensions = root
      .replace(/\swidth="[^"]*"/gu, '')
      .replace(/\sheight="[^"]*"/gu, '')
      .replace(/\sviewBox="[^"]*"/gu, '')
      .replace(/\sstyle="[^"]*"/gu, '');
    return withoutDimensions.replace(
      />$/u,
      ` width="${Number(width.toFixed(3))}" height="${Number(height.toFixed(3))}" viewBox="${viewBox.map((part) => Number(part.toFixed(3))).join(' ')}" style="background-color: white;">`
    );
  });
}

/**
 * Convert Mermaid's XHTML-in-SVG labels to native SVG text for CREngine and
 * describe readable two-dimensional panels for diagrams that are too large
 * for an e-reader screen. The website's source SVG is never modified.
 */
export function prepareEbookDiagramSvg(svg) {
  const source = String(svg);
  const viewBox = parseSvgViewBox(source);
  let labelCount = 0;
  const converted = source.replace(
    /<foreignObject\b([^>]*)>([\s\S]*?)<\/foreignObject>/gu,
    (_, attributes, body) => {
      const width = Number(attributes.match(/\bwidth="([\d.]+)"/u)?.[1]);
      const height = Number(attributes.match(/\bheight="([\d.]+)"/u)?.[1]);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return '';
      }
      const plain = decodeXmlText(
        body
          .replace(/<br\s*\/?\s*>/giu, '\n')
          .replace(/<\/p>\s*<p[^>]*>/giu, '\n')
          .replace(/<[^>]+>/gu, '')
      );
      const lines = plain.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) return '';

      labelCount += 1;
      const fontSize = 16;
      const lineHeight = 20;
      const totalHeight = fontSize + (lines.length - 1) * lineHeight;
      const firstBaseline = Math.max(fontSize, (height - totalHeight) / 2 + fontSize * 0.82);
      const tspans = lines.map((line, index) =>
        `<tspan x="${Number((width / 2).toFixed(3))}" y="${Number((firstBaseline + index * lineHeight).toFixed(3))}">${escapeXml(line)}</tspan>`
      ).join('');
      return `<text class="ebook-native-label" x="${Number((width / 2).toFixed(3))}" text-anchor="middle" font-family="Noto Sans CJK SC, Noto Sans, sans-serif" font-size="${fontSize}" font-weight="600" fill="#000">${tspans}</text>`;
    }
  );

  if (labelCount === 0 || !viewBox) {
    return { svg: source, labelCount: 0, viewBox, panelViewBoxes: [] };
  }

  const highContrast = converted.replace(
    /<\/svg>\s*$/u,
    `<style>
.node rect,.node polygon,.node circle,.node ellipse{fill:#fff!important;stroke:#000!important;stroke-width:2px!important}
.flowchart-link,.edgePath path{stroke:#000!important}
.arrowMarkerPath{fill:#000!important;stroke:#000!important}
.ebook-native-label{fill:#000!important}
</style></svg>`
  );
  const normalized = replaceSvgRootDimensions(highContrast, viewBox);
  return {
    svg: normalized,
    labelCount,
    viewBox,
    panelViewBoxes: chooseDiagramPanelViewBoxes(source, viewBox)
  };
}

export function setSvgViewBox(svg, viewBox) {
  return replaceSvgRootDimensions(svg, viewBox);
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
