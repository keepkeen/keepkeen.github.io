import { pinyin } from 'pinyin';
import type { Post } from './content.ts';
import {
  formatDate,
  getPlainExcerpt,
  getPostPath,
  getReadingTime,
  stripMarkdown
} from './content.ts';

export interface SearchDocument {
  id: string;
  href: string;
  title: string;
  description: string;
  excerpt: string;
  bodyText: string;
  tags: string[];
  tagsText: string;
  dateISO: string;
  dateLabel: string;
  readingTime: number;
  searchTerms: string;
}

const nonWordPattern = /[^\p{L}\p{N}\s-]+/gu;
const hanSequencePattern = /[\p{Script=Han}]+/gu;

function uniqueTokens(tokens: string[]) {
  return [...new Set(tokens.filter(Boolean))];
}

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(nonWordPattern, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getHanSequences(value: string) {
  return value.match(hanSequencePattern) ?? [];
}

function getHanTerms(value: string) {
  const terms: string[] = [];

  for (const sequence of getHanSequences(value)) {
    const chars = Array.from(sequence);

    terms.push(sequence);

    for (let index = 0; index < chars.length; index += 1) {
      terms.push(chars[index]);

      for (let size = 2; size <= 4 && index + size <= chars.length; size += 1) {
        terms.push(chars.slice(index, index + size).join(''));
      }
    }
  }

  return terms;
}

function expandTokenRuns(tokens: string[], maxSpan = 4) {
  const expanded = [...tokens];

  for (let start = 0; start < tokens.length; start += 1) {
    let combined = '';

    for (let end = start; end < tokens.length && end < start + maxSpan; end += 1) {
      combined += tokens[end];
      expanded.push(combined);
    }
  }

  return expanded;
}

function getPinyinTerms(value: string, style: 'normal' | 'first_letter') {
  const terms: string[] = [];

  for (const sequence of getHanSequences(value)) {
    const tokens = pinyin(sequence, { style, segment: true })
      .flat()
      .map((token) => normalizeSearchText(token))
      .filter(Boolean);

    terms.push(...expandTokenRuns(tokens));
  }

  return terms;
}

export function buildSearchTerms(parts: string[]) {
  const raw = parts.join(' ');
  const normalized = normalizeSearchText(raw);

  return uniqueTokens([
    ...normalized.split(/\s+/),
    ...getHanTerms(raw),
    ...getPinyinTerms(raw, 'normal'),
    ...getPinyinTerms(raw, 'first_letter')
  ]).join(' ');
}

export function expandSearchQuery(query: string) {
  return buildSearchTerms([query]) || normalizeSearchText(query);
}

export function buildSearchDocument(post: Post): SearchDocument {
  const bodyText = stripMarkdown(post.body ?? '');
  const tagsText = post.data.tags.join(' ');

  return {
    id: post.id,
    href: getPostPath(post),
    title: post.data.title,
    description: post.data.description,
    excerpt: getPlainExcerpt(bodyText, 240),
    bodyText,
    tags: post.data.tags,
    tagsText,
    dateISO: post.data.date.toISOString(),
    dateLabel: formatDate(post.data.date),
    readingTime: getReadingTime(post.body),
    searchTerms: buildSearchTerms([post.data.title, post.data.description, tagsText, bodyText])
  };
}
