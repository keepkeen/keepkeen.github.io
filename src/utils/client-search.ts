/**
 * Client-side search over the lazily-fetched /search-index.json.
 * Kept free of Node-only imports so it can ship to the browser.
 *
 * Matching is plain substring inclusion on normalized text, which handles
 * CJK queries without any ngram expansion; pinyin (full + initials) is
 * precomputed at build time into each entry's `pinyin` haystack.
 *
 * Entries carry the post body split into heading-anchored sections, so the
 * UI can show *where* a query matched (section title + highlighted excerpt)
 * instead of only which post matched.
 */

export interface SearchIndexSection {
  /** Display heading; empty string for the opening prose before the first heading. */
  heading: string;
  /** In-page anchor slug matching the rendered heading id; empty for the opening. */
  anchor: string;
  /** Original (non-normalized) plain text, used for both matching and excerpts. */
  text: string;
}

export interface SearchIndexEntry {
  id: string;
  /** Normalized title + description + tags; matching only, never displayed. */
  meta: string;
  /** Normalized pinyin haystack for title/tags/headings. */
  pinyin: string;
  sections: SearchIndexSection[];
}

export interface SnippetPart {
  text: string;
  marked: boolean;
}

export interface SectionMatch {
  heading: string;
  anchor: string;
  parts: SnippetPart[];
}

export interface SearchResult {
  id: string;
  /** Best-matching sections (up to the configured limit); may be empty for pinyin/meta-only hits. */
  sections: SectionMatch[];
  /** How many additional sections also matched but were not included. */
  extraMatchCount: number;
}

const nonWordPattern = /[^\p{L}\p{N}\s-]+/gu;

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(nonWordPattern, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Excerpt window: context kept before the first hit and total excerpt length. */
const SNIPPET_LEAD = 36;
const SNIPPET_LENGTH = 170;
const MAX_MARK_RANGES = 24;

/** Normalized section haystacks are derived once per entry and memoized. */
const normalizedSectionsCache = new WeakMap<SearchIndexEntry, string[]>();

function getNormalizedSections(entry: SearchIndexEntry) {
  let cached = normalizedSectionsCache.get(entry);

  if (!cached) {
    cached = entry.sections.map((section) =>
      normalizeSearchText(`${section.heading} ${section.text}`)
    );
    normalizedSectionsCache.set(entry, cached);
  }

  return cached;
}

/**
 * Builds a display excerpt from the original section text, wrapping every
 * token occurrence inside the window with a marked part. Falls back to the
 * section head when no token is literally present (e.g. pinyin matches).
 */
export function buildSnippetParts(text: string, tokens: string[]): SnippetPart[] {
  const lower = text.toLowerCase();
  const ranges: { start: number; end: number }[] = [];

  for (const token of tokens) {
    if (!token) continue;

    let from = 0;
    while (ranges.length < MAX_MARK_RANGES) {
      const at = lower.indexOf(token, from);
      if (at < 0) break;
      ranges.push({ start: at, end: at + token.length });
      from = at + token.length;
    }
  }

  const firstHit = ranges.length > 0 ? Math.min(...ranges.map((range) => range.start)) : 0;
  const start = Math.max(firstHit - SNIPPET_LEAD, 0);
  const end = Math.min(start + SNIPPET_LENGTH, text.length);

  const clipped = ranges
    .filter((range) => range.start < end && range.end > start)
    .map((range) => ({ start: Math.max(range.start, start), end: Math.min(range.end, end) }))
    .sort((left, right) => left.start - right.start);

  const merged: { start: number; end: number }[] = [];
  for (const range of clipped) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  const parts: SnippetPart[] = [];
  if (start > 0) parts.push({ text: '…', marked: false });

  let cursor = start;
  for (const range of merged) {
    if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start), marked: false });
    parts.push({ text: text.slice(range.start, range.end), marked: true });
    cursor = range.end;
  }

  if (cursor < end) parts.push({ text: text.slice(cursor, end), marked: false });
  if (end < text.length) parts.push({ text: '…', marked: false });

  return parts;
}

/**
 * Returns matching entries with their best sections. Every query token must
 * match somewhere in the entry (meta, any section, or pinyin) — same AND
 * semantics as before, now with per-section evidence for the UI.
 */
export function searchIndexDetailed(
  entries: SearchIndexEntry[],
  query: string,
  options: { sectionLimit?: number } = {}
): SearchResult[] {
  const sectionLimit = options.sectionLimit ?? 3;
  const normalized = normalizeSearchText(query);

  if (!normalized) {
    return entries.map((entry) => ({ id: entry.id, sections: [], extraMatchCount: 0 }));
  }

  const tokens = [...new Set(normalized.split(' '))];
  const compact = tokens.join('');
  const results: SearchResult[] = [];

  for (const entry of entries) {
    const normalizedSections = getNormalizedSections(entry);

    const tokensMatch = tokens.every(
      (token) =>
        entry.meta.includes(token) ||
        entry.pinyin.includes(token) ||
        normalizedSections.some((section) => section.includes(token))
    );

    // "ya suo" typed with spaces should still hit the joined pinyin "yasuo".
    if (!tokensMatch && !(compact.length > 0 && entry.pinyin.includes(compact))) {
      continue;
    }

    const scored = entry.sections
      .map((section, index) => {
        const haystack = normalizedSections[index];
        let matchedTokens = 0;
        let firstPosition = Number.MAX_SAFE_INTEGER;

        for (const token of tokens) {
          const at = haystack.indexOf(token);
          if (at >= 0) {
            matchedTokens += 1;
            firstPosition = Math.min(firstPosition, at);
          }
        }

        return { section, matchedTokens, firstPosition };
      })
      .filter((candidate) => candidate.matchedTokens > 0)
      .sort(
        (left, right) =>
          right.matchedTokens - left.matchedTokens || left.firstPosition - right.firstPosition
      );

    const top = scored.slice(0, sectionLimit);

    results.push({
      id: entry.id,
      sections: top.map(({ section }) => ({
        heading: section.heading,
        anchor: section.anchor,
        parts: buildSnippetParts(section.text, tokens)
      })),
      extraMatchCount: Math.max(scored.length - top.length, 0)
    });
  }

  return results;
}

/** Returns ids of entries where every query token matches (legacy shape). */
export function searchIndex(entries: SearchIndexEntry[], query: string): string[] {
  return searchIndexDetailed(entries, query).map((result) => result.id);
}
