/**
 * Social-card (Open Graph) image generation.
 *
 * Cards are composed as SVG here, then rasterized to PNG by the endpoints in
 * src/pages — most social crawlers (Twitter/X, WeChat, Slack, Facebook) do not
 * render SVG og:images. Text uses system serif fonts resolved by fontconfig at
 * build time; CI installs Noto CJK so Chinese titles render there too.
 */

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const MARGIN = 84;

const SERIF_STACK = "Georgia, 'Times New Roman', 'Noto Serif CJK SC', 'Songti SC', serif";
const INK = '#161513';
const MUTED = '#6f6a62';
const PAPER = '#faf8f4';
const ACCENT = '#b03a20';
const HAIRLINE = '#dcd7cd';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const CJK_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}　-〿＀-￯]/u;

function isCjk(char: string) {
  return CJK_PATTERN.test(char);
}

function charUnits(char: string) {
  if (char === ' ') return 0.3;
  return isCjk(char) ? 1 : 0.52;
}

/**
 * Break text into lines of at most maxUnits em-units. CJK breaks anywhere;
 * latin words stay whole. Appends an ellipsis when maxLines overflows.
 */
export function wrapMixedText(value: string, maxUnits: number, maxLines: number) {
  // Tokens: single Han chars, single CJK punctuation marks, latin runs, whitespace.
  const tokens =
    value.match(
      /[\p{Script=Han}]|[、。，．：；！？《》〈〉「」『』（）【】…—～·]|[^\s\p{Script=Han}、。，．：；！？《》〈〉「」『』（）【】…—～·]+|\s+/gu
    ) ?? [];
  const lines: string[] = [];
  let current = '';
  let currentUnits = 0;
  let truncated = false;

  const tokenUnits = (token: string) => [...token].reduce((sum, char) => sum + charUnits(char), 0);
  // CJK line-break rules: closing punctuation must not start a line.
  const closingPunct = /^[、。，．：；！？》」』）】…,.;:!?)]/u;

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (current) {
        current += ' ';
        currentUnits += 0.3;
      }
      continue;
    }

    const units = tokenUnits(token);

    if (closingPunct.test(token) && current.trim()) {
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

export interface OgCardOptions {
  eyebrow: string;
  title: string;
  subtitle?: string;
  footer?: string;
}

export function buildOgCardSvg({ eyebrow, title, subtitle, footer }: OgCardOptions) {
  const titleSize = 60;
  const titleLineHeight = 78;
  const titleLines = wrapMixedText(title, (CARD_WIDTH - MARGIN * 2) / titleSize, 3);
  const subtitleSize = 28;
  const subtitleLines = subtitle
    ? wrapMixedText(subtitle, (CARD_WIDTH - MARGIN * 2) / (subtitleSize * 0.98), 2)
    : [];

  const titleTop = 236;
  const titleMarkup = titleLines
    .map(
      (line, index) =>
        `<text x="${MARGIN}" y="${titleTop + index * titleLineHeight}" fill="${INK}" font-family="${SERIF_STACK}" font-size="${titleSize}" font-weight="700" letter-spacing="-0.5">${escapeXml(line)}</text>`
    )
    .join('\n  ');

  const subtitleTop = titleTop + titleLines.length * titleLineHeight - 20;
  const subtitleMarkup = subtitleLines
    .map(
      (line, index) =>
        `<text x="${MARGIN}" y="${subtitleTop + index * 42}" fill="${MUTED}" font-family="${SERIF_STACK}" font-size="${subtitleSize}">${escapeXml(line)}</text>`
    )
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${PAPER}" />
  <rect x="0" y="0" width="${CARD_WIDTH}" height="10" fill="${ACCENT}" />
  <text x="${MARGIN}" y="122" fill="${MUTED}" font-family="${SERIF_STACK}" font-size="24" letter-spacing="4">${escapeXml(eyebrow.toUpperCase())}</text>
  <rect x="${MARGIN}" y="150" width="56" height="4" fill="${ACCENT}" />
  ${titleMarkup}
  ${subtitleMarkup}
  <line x1="${MARGIN}" y1="536" x2="${CARD_WIDTH - MARGIN}" y2="536" stroke="${HAIRLINE}" stroke-width="2" />
  ${footer ? `<text x="${MARGIN}" y="580" fill="${MUTED}" font-family="${SERIF_STACK}" font-size="23">${escapeXml(footer)}</text>` : ''}
</svg>`;
}
