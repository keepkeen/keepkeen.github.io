import { describe, expect, it } from 'vitest';
import { buildSearchTerms, expandSearchQuery, normalizeSearchText } from './search';

describe('normalizeSearchText', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    expect(normalizeSearchText('  Hello,   WORLD!  ')).toBe('hello world');
    expect(normalizeSearchText('full-width：ＡＢＣ')).toBe('full width abc');
  });
});

describe('buildSearchTerms', () => {
  it('indexes Chinese text by characters, ngrams, and pinyin', () => {
    const terms = buildSearchTerms(['压缩']);
    expect(terms).toContain('压缩');
    expect(terms).toContain('压');
    expect(terms).toContain('yasuo');
    expect(terms).toContain('ys');
  });

  it('keeps latin tokens searchable', () => {
    const terms = buildSearchTerms(['Codex compaction']);
    expect(terms).toContain('codex');
    expect(terms).toContain('compaction');
  });
});

describe('expandSearchQuery', () => {
  it('expands Chinese queries with pinyin so either script matches', () => {
    const expanded = expandSearchQuery('压缩');
    expect(expanded).toContain('yasuo');
  });
});
