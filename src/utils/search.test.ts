import { describe, expect, it } from 'vitest';
import { buildPinyinHaystack, extractHeadings, normalizeSearchText, splitSections } from './search';
import { buildSnippetParts, searchIndex, searchIndexDetailed } from './client-search';
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

describe('splitSections', () => {
  it('splits by headings, keeps opening prose, and slugs anchors like rendered ids', () => {
    const body = [
      '开场白一段。',
      '',
      '## 1. 为什么 GRPO 出现',
      '',
      'PPO 需要 critic 估计 value。',
      '',
      '```python',
      '# fenced code should not create sections',
      '```',
      '',
      '### 标准 GRPO 有没有 GAE',
      '',
      '没有。'
    ].join('\n');

    const sections = splitSections(body);

    expect(sections[0]).toMatchObject({ heading: '', anchor: '' });
    expect(sections[0].text).toContain('开场白');
    expect(sections[1]).toMatchObject({ heading: '1. 为什么 GRPO 出现', anchor: '1-为什么-grpo-出现' });
    expect(sections[2]).toMatchObject({ anchor: '标准-grpo-有没有-gae' });
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

describe('buildSnippetParts', () => {
  it('marks every token occurrence inside the excerpt window', () => {
    const parts = buildSnippetParts('GRPO 去掉 critic，用组内相对优势替代 critic 的估计。', ['critic']);
    const marked = parts.filter((part) => part.marked).map((part) => part.text);

    expect(marked).toEqual(['critic', 'critic']);
    expect(parts.map((part) => part.text).join('')).toContain('组内相对优势');
  });

  it('falls back to the section head when tokens are not literally present', () => {
    const parts = buildSnippetParts('压缩策略的完整复盘。', ['yasuo']);

    expect(parts.some((part) => part.marked)).toBe(false);
    expect(parts[0].text).toContain('压缩策略');
  });
});

describe('searchIndex', () => {
  const entries: SearchIndexEntry[] = [
    {
      id: 'codex',
      meta: normalizeSearchText('为什么 Codex 总在压缩 ai harness'),
      pinyin: buildPinyinHaystack('为什么 Codex 总在压缩'),
      sections: [
        { heading: '上下文管理', anchor: '上下文管理', text: 'harness 复盘：上下文的压缩策略与恢复。' },
        { heading: '失败案例', anchor: '失败案例', text: '压缩过度导致信息丢失的三个案例。' }
      ]
    },
    {
      id: 'clarity',
      meta: normalizeSearchText('Code Is a Form of Clarity essay'),
      pinyin: '',
      sections: [{ heading: '', anchor: '', text: 'A clean argument about clarity in code.' }]
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

  it('returns matched sections with anchors and highlighted parts', () => {
    const [result] = searchIndexDetailed(entries, '压缩');

    expect(result.id).toBe('codex');
    expect(result.sections).toHaveLength(2);
    // Equal token counts tie-break by earliest match position: '失败案例' hits sooner.
    expect(result.sections.map((section) => section.anchor)).toEqual(['失败案例', '上下文管理']);
    expect(result.sections[0].parts.some((part) => part.marked && part.text === '压缩')).toBe(true);
  });

  it('caps sections at the limit and reports the remainder', () => {
    const [result] = searchIndexDetailed(entries, '压缩', { sectionLimit: 1 });

    expect(result.sections).toHaveLength(1);
    expect(result.extraMatchCount).toBe(1);
  });

  it('returns pinyin-only hits with empty section evidence', () => {
    const [result] = searchIndexDetailed(entries, 'ys');

    expect(result.id).toBe('codex');
  });
});
