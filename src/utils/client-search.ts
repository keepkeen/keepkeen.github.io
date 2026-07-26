/**
 * Client-side search over the lazily-fetched /search-index.json.
 * Kept free of Node-only imports so it can ship to the browser.
 *
 * Matching is plain substring inclusion on normalized text, which handles
 * CJK queries without any ngram expansion; pinyin (full + initials) is
 * precomputed at build time into each entry's `pinyin` haystack.
 */

export interface SearchIndexEntry {
  id: string;
  /** Normalized text: title + description + tags + headings + body head. */
  text: string;
  /** Normalized pinyin haystack for title/tags/headings. */
  pinyin: string;
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

/** Returns ids of entries where every query token matches text or pinyin. */
export function searchIndex(entries: SearchIndexEntry[], query: string): string[] {
  const normalized = normalizeSearchText(query);

  if (!normalized) {
    return entries.map((entry) => entry.id);
  }

  const tokens = normalized.split(' ');
  const compact = tokens.join('');

  return entries
    .filter((entry) => {
      const tokensMatch = tokens.every(
        (token) => entry.text.includes(token) || entry.pinyin.includes(token)
      );

      // "ya suo" typed with spaces should still hit the joined pinyin "yasuo".
      return tokensMatch || (compact.length > 0 && entry.pinyin.includes(compact));
    })
    .map((entry) => entry.id);
}
