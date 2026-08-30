import { describe, expect, it } from 'vitest';
import {
  buildCoverSvg,
  buildOpds,
  buildOpdsNavigation,
  buildSeriesFilename,
  escapeXml,
  normalizeTexForMathml,
  normalizeDate,
  sanitizeFilenameSegment,
  scaleSvgIntrinsicSize,
  slugFromPostFile,
  wrapMixedText
} from './ebook-lib.mjs';

describe('ebook helpers', () => {
  it('derives stable article slugs from dated Markdown filenames', () => {
    expect(slugFromPostFile('2026-08-29-rl-paper-03-gae.md')).toBe('rl-paper-03-gae');
  });

  it('escapes XML metadata and wraps Chinese cover text', () => {
    expect(escapeXml('A & B <C>')).toBe('A &amp; B &lt;C&gt;');
    const lines = wrapMixedText('在看得远和看得近之间连续调节', 7, 4);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('在看得远和看得近之间连续调节');
  });

  it('normalizes publication dates to Atom timestamps', () => {
    expect(normalizeDate('2026-08-29')).toBe('2026-08-29T00:00:00.000Z');
  });

  it('normalizes legacy roman math commands before MathML conversion', () => {
    expect(normalizeTexForMathml('D_{\\rm KL}(\\pi_{\\rm old})')).toBe(
      'D_{\\mathrm{KL}}(\\pi_{\\mathrm{old}})'
    );
  });

  it('builds ordered, FAT-safe Chinese filenames', () => {
    expect(buildSeriesFilename('03. GAE：偏差/方差权衡?', 3)).toBe('03 GAE：偏差 方差权衡');
    expect(sanitizeFilenameSegment('A:B* C')).toBe('A B C');
    expect(Buffer.byteLength(sanitizeFilenameSegment('中'.repeat(100)), 'utf8')).toBeLessThanOrEqual(
      180
    );
  });

  it('builds a high-contrast portrait SVG cover', () => {
    const svg = buildCoverSvg({
      title: 'GAE & PPO',
      description: '偏差—方差权衡',
      date: '2026-08-29',
      author: 'Liuliming'
    });
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="1600"');
    expect(svg).toContain('GAE &amp; PPO');
  });

  it('scales only intrinsic ex dimensions on the SVG root', () => {
    const svg = '<svg width="2.5ex" height="1.25ex" viewBox="0 0 100 50"><path width="0"/></svg>';
    expect(scaleSvgIntrinsicSize(svg, 1.6)).toBe(
      '<svg width="4ex" height="2ex" viewBox="0 0 100 50"><path width="0"/></svg>'
    );
  });

  it('emits an OPDS 1.2-compatible acquisition entry', () => {
    const xml = buildOpds(
      [
        {
          id: 'https://keepkeen.github.io/blog/a/',
          title: 'A & B',
          description: 'Summary',
          updated: '2026-08-30T00:00:00.000Z',
          published: '2026-08-29T00:00:00.000Z',
          bytes: 123,
          seriesSlug: 'series-a',
          seriesTitle: '系列 A',
          epubUrl: 'https://keepkeen.github.io/ebooks/a.epub',
          coverUrl: 'https://keepkeen.github.io/ebooks/a.png',
          articleUrl: 'https://keepkeen.github.io/blog/a/'
        }
      ],
      {
        title: 'Catalog',
        author: 'Liuliming',
        language: 'zh-CN',
        siteUrl: 'https://keepkeen.github.io',
        feedPath: '/opds.xml',
        description: 'Books'
      }
    );
    expect(xml).toContain('http://opds-spec.org/acquisition');
    expect(xml).toContain('application/epub+zip');
    expect(xml).toContain('A &amp; B');
    expect(xml).toContain('label="系列 A"');
    expect(xml).toContain('<fh:complete/>');
  });

  it('emits OPDS navigation entries for series feeds', () => {
    const xml = buildOpdsNavigation(
      [
        {
          title: '01 强化学习论文精读（51 本）',
          description: '强化学习论文精读系列',
          count: 51,
          updated: '2026-08-30T00:00:00.000Z',
          feedUrl: 'https://keepkeen.github.io/opds/reinforcement-learning.xml'
        }
      ],
      {
        title: 'Catalog',
        author: 'Liuliming',
        siteUrl: 'https://keepkeen.github.io',
        feedPath: '/opds.xml',
        description: 'Books'
      }
    );
    expect(xml).toContain('kind=navigation');
    expect(xml).toContain('rel="subsection"');
    expect(xml).toContain('51 本');
  });
});
