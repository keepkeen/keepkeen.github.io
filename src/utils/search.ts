import GithubSlugger from 'github-slugger';
import { pinyin } from 'pinyin';
import type { Post } from './content.ts';
import { formatDate, getPostPath, getReadingTime, stripMarkdown } from './content.ts';
import type { SearchIndexEntry, SearchIndexSection } from './client-search.ts';
import { normalizeSearchText } from './client-search.ts';

export { normalizeSearchText };
export type { SearchIndexEntry, SearchIndexSection };

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

// Per-section excerpt budget. Headings + full section coverage matter more
// than unbounded text: this keeps the lazily-fetched index proportionate.
const SECTION_TEXT_LIMIT = 600;
const sectionHeadingPattern = /^(#{1,4})\s+(.+)$/;
const fencePattern = /^(```|~~~)/;

/**
 * Splits a markdown body into heading-anchored sections. Anchors use
 * github-slugger on the stripped heading text, matching the ids Astro
 * assigns to rendered headings, so search results can deep-link.
 */
export function splitSections(body: string): SearchIndexSection[] {
  const slugger = new GithubSlugger();
  const sections: SearchIndexSection[] = [];

  let heading = '';
  let anchor = '';
  let buffer: string[] = [];
  let inFence = false;

  const flush = () => {
    const text = stripMarkdown(buffer.join(' ')).slice(0, SECTION_TEXT_LIMIT);

    if (heading || text) {
      sections.push({ heading, anchor, text });
    }

    buffer = [];
  };

  for (const line of body.split('\n')) {
    if (fencePattern.test(line.trim())) {
      inFence = !inFence;
      continue;
    }

    const match = inFence ? null : line.match(sectionHeadingPattern);

    if (match) {
      flush();
      heading = stripMarkdown(match[2]);
      anchor = slugger.slug(heading);
    } else {
      buffer.push(line);
    }
  }

  flush();

  return sections;
}

export function buildSearchIndexEntry(post: Post): SearchIndexEntry {
  const body = post.body ?? '';
  const sections = splitSections(body);
  const headings = sections.map((section) => section.heading).filter(Boolean).join(' ');
  const tagsText = post.data.tags.join(' ');

  return {
    id: post.id,
    meta: normalizeSearchText([post.data.title, post.data.description, tagsText].join(' ')),
    pinyin: buildPinyinHaystack([post.data.title, tagsText, headings].join(' ')),
    sections
  };
}
