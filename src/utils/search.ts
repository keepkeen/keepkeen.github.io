import { pinyin } from 'pinyin';
import type { Post } from './content.ts';
import { formatDate, getPostPath, getReadingTime, stripMarkdown } from './content.ts';
import type { SearchIndexEntry } from './client-search.ts';
import { normalizeSearchText } from './client-search.ts';

export { normalizeSearchText };
export type { SearchIndexEntry };

/** Display fields consumed by list components (PostRow etc.). */
export interface SearchDocument {
  id: string;
  href: string;
  title: string;
  description: string;
  tags: string[];
  dateISO: string;
  dateLabel: string;
  readingTime: number;
  featured: boolean;
}

const hanSequencePattern = /[\p{Script=Han}]+/gu;
const headingPattern = /^#{1,6}\s+(.+)$/gm;

export function extractHeadings(source: string) {
  return [...source.matchAll(headingPattern)].map((match) => stripMarkdown(match[1]));
}

/**
 * Pinyin haystack for CJK text: for each han run, emit spaced syllables,
 * the joined form ("yasuo"), and the initials ("ys").
 */
export function buildPinyinHaystack(value: string) {
  const parts: string[] = [];

  for (const sequence of value.match(hanSequencePattern) ?? []) {
    const syllables = pinyin(sequence, { style: 'normal', segment: true })
      .flat()
      .map((syllable) => normalizeSearchText(syllable))
      .filter(Boolean);

    if (syllables.length === 0) {
      continue;
    }

    parts.push(syllables.join(' '), syllables.join(''), syllables.map((s) => s[0]).join(''));
  }

  return normalizeSearchText(parts.join(' '));
}

export function buildSearchDocument(post: Post): SearchDocument {
  return {
    id: post.id,
    href: getPostPath(post),
    title: post.data.title,
    description: post.data.description,
    tags: post.data.tags,
    dateISO: post.data.date.toISOString(),
    // List UI is English; keep one date format per list regardless of post language.
    dateLabel: formatDate(post.data.date, 'en'),
    readingTime: getReadingTime(post.body),
    featured: Boolean(post.data.featured)
  };
}

// Body head length for the search index: headings cover the deep structure of
// long posts, this just adds the opening prose.
const BODY_HEAD_LENGTH = 3000;

export function buildSearchIndexEntry(post: Post): SearchIndexEntry {
  const body = post.body ?? '';
  const headings = extractHeadings(body).join(' ');
  const tagsText = post.data.tags.join(' ');
  const bodyHead = stripMarkdown(body).slice(0, BODY_HEAD_LENGTH);

  return {
    id: post.id,
    text: normalizeSearchText(
      [post.data.title, post.data.description, tagsText, headings, bodyHead].join(' ')
    ),
    pinyin: buildPinyinHaystack([post.data.title, tagsText, headings].join(' '))
  };
}
