import { describe, expect, it } from 'vitest';
import { buildPinyinHaystack, extractHeadings, normalizeSearchText } from './search';
import { searchIndex } from './client-search';
import type { SearchIndexEntry } from './client-search';

describe('normalizeSearchText', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    expect(normalizeSearchText('  Hello,   WORLD!  ')).toBe('hello world');
    expect(normalizeSearchText('full-width：ＡＢＣ')).toBe('full width abc');
  });
});

describe('extractHeadings', () => {
  it('collects headings of every level and strips markdown', () => {
    const body = '# One\n\ntext\n\n## Two **bold**\n\n### `code` three\n\nnot # a heading';
    expect(extractHeadings(body)).toEqual(['One', 'Two bold', 'code three']);
  });
});

describe('buildPinyinHaystack', () => {
  it('emits spaced syllables, joined pinyin, and initials', () => {
    const haystack = buildPinyinHaystack('压缩');
    expect(haystack).toContain('ya suo');
    expect(haystack).toContain('yasuo');
    expect(haystack).toContain('ys');
  });

  it('ignores latin-only text', () => {
    expect(buildPinyinHaystack('hello world')).toBe('');
  });
});

describe('searchIndex', () => {
  const entries: SearchIndexEntry[] = [
    {
      id: 'codex',
      text: normalizeSearchText('为什么 Codex 总在压缩 上下文 harness 复盘'),
      pinyin: buildPinyinHaystack('为什么 Codex 总在压缩')
    },
    {
      id: 'clarity',
      text: normalizeSearchText('Code Is a Form of Clarity clean argument'),
      pinyin: ''
    }
  ];

  it('matches CJK substrings without ngrams', () => {
    expect(searchIndex(entries, '压缩')).toEqual(['codex']);
  });

  it('matches pinyin, including spaced and joined forms', () => {
    expect(searchIndex(entries, 'yasuo')).toEqual(['codex']);
    expect(searchIndex(entries, 'ya suo')).toEqual(['codex']);
  });

  it('requires every token to match (AND)', () => {
    expect(searchIndex(entries, 'clarity clean')).toEqual(['clarity']);
    expect(searchIndex(entries, 'clarity 压缩')).toEqual([]);
  });

  it('returns all ids for an empty query', () => {
    expect(searchIndex(entries, '  ')).toHaveLength(2);
  });
});
