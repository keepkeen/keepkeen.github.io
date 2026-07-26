import { describe, expect, it } from 'vitest';
import {
  countByScript,
  countWords,
  getPlainExcerpt,
  getPostsInSeries,
  getReadingTime,
  getRelatedPosts,
  getTagSlug,
  sortPosts,
  stripMarkdown
} from './content';
import type { Post } from './content';

function makePost(overrides: Record<string, unknown> = {}, data: Record<string, unknown> = {}) {
  return {
    id: 'post-id',
    body: '',
    ...overrides,
    data: {
      title: 'Title',
      description: 'Description',
      date: new Date('2026-01-01'),
      tags: [],
      featured: false,
      draft: false,
      lang: 'en',
      ...data
    }
  } as unknown as Post;
}

describe('getTagSlug', () => {
  it('normalizes spacing, case, and separators', () => {
    expect(getTagSlug('AI Systems')).toBe('ai-systems');
    expect(getTagSlug('  Code_Craft ')).toBe('code-craft');
  });

  it('falls back to "tag" when nothing survives', () => {
    expect(getTagSlug('！！！')).toBe('tag');
  });
});

describe('stripMarkdown / countByScript', () => {
  it('strips code fences, links, and emphasis', () => {
    const text = stripMarkdown('Some **bold** and [link](https://example.com)\n```js\ncode();\n```');
    expect(text).toContain('bold');
    expect(text).toContain('link');
    expect(text).not.toContain('code()');
    expect(text).not.toContain('](');
  });

  it('counts han characters and latin words separately', () => {
    const { han, latin } = countByScript('上下文压缩 context compaction');
    expect(han).toBe(5);
    expect(latin).toBe(2);
    expect(countWords('上下文压缩 context compaction')).toBe(7);
  });
});

describe('getReadingTime', () => {
  it('never reports below one minute', () => {
    expect(getReadingTime('short')).toBe(1);
  });

  it('uses ~350 chars/min for Chinese', () => {
    const zh = '字'.repeat(1750);
    expect(getReadingTime(zh)).toBe(5);
  });

  it('uses ~220 wpm for latin text', () => {
    const en = Array.from({ length: 660 }, (_, i) => `word${i}`).join(' ');
    expect(getReadingTime(en)).toBe(3);
  });
});

describe('getPlainExcerpt', () => {
  it('returns short text unchanged', () => {
    expect(getPlainExcerpt('hello world')).toBe('hello world');
  });

  it('truncates long text with an ellipsis marker', () => {
    const long = 'word '.repeat(100);
    const excerpt = getPlainExcerpt(long, 50);
    expect(excerpt.length).toBeLessThanOrEqual(53);
    expect(excerpt.endsWith('...')).toBe(true);
  });
});

describe('sortPosts', () => {
  it('sorts newest first without mutating input', () => {
    const older = makePost({ id: 'older' }, { date: new Date('2026-01-01') });
    const newer = makePost({ id: 'newer' }, { date: new Date('2026-06-01') });
    const input = [older, newer];
    const sorted = sortPosts(input);

    expect(sorted.map((post) => post.id)).toEqual(['newer', 'older']);
    expect(input[0].id).toBe('older');
  });
});

describe('getPostsInSeries', () => {
  const first = makePost({ id: 'a' }, { series: 's', seriesOrder: 1, date: new Date('2026-03-05') });
  const second = makePost({ id: 'b' }, { series: 's', seriesOrder: 2, date: new Date('2026-03-01') });
  const dateOnly = makePost({ id: 'c' }, { series: 's', date: new Date('2026-02-01') });
  const other = makePost({ id: 'd' }, { series: 'other' });
  const draft = makePost({ id: 'e' }, { series: 's', draft: true });

  it('orders by explicit seriesOrder, then date for unordered posts', () => {
    const result = getPostsInSeries([dateOnly, second, draft, other, first], 's');
    expect(result.map((post) => post.id)).toEqual(['a', 'b', 'c']);
  });

  it('excludes drafts and other series', () => {
    const result = getPostsInSeries([draft, other], 's');
    expect(result).toHaveLength(0);
  });
});

describe('getRelatedPosts', () => {
  const current = makePost({ id: 'current' }, { tags: ['ai', 'engineering'] });
  const twoShared = makePost({ id: 'two' }, { tags: ['AI', 'Engineering'], date: new Date('2026-01-01') });
  const oneShared = makePost({ id: 'one' }, { tags: ['ai'], date: new Date('2026-05-01') });
  const unrelated = makePost({ id: 'zero' }, { tags: ['cooking'] });

  it('ranks by tag overlap (case-insensitive), then recency', () => {
    const result = getRelatedPosts(current, [current, unrelated, oneShared, twoShared]);
    expect(result.map((post) => post.id)).toEqual(['two', 'one']);
  });

  it('returns empty when nothing overlaps', () => {
    expect(getRelatedPosts(current, [current, unrelated])).toHaveLength(0);
  });
});
