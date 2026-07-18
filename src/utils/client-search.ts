/**
 * Shared client-side search ranking for the blog directory.
 * Kept free of Node-only imports so it can ship to the browser.
 */

export interface ClientSearchDocument {
  id: string;
  href: string;
  title: string;
  description: string;
  excerpt: string;
  tags: string[];
  tagsText: string;
  dateISO: string;
  dateLabel: string;
  readingTime: number;
  featured?: boolean;
  lang?: string;
  searchTerms: string;
}

const nonWordPattern = /[^\p{L}\p{N}\s-]+/gu;
const hanSequencePattern = /[\p{Script=Han}]+/gu;

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(nonWordPattern, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function tokenize(value: string) {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}

function expandSearchQuery(query: string) {
  const normalized = normalizeSearchText(query);
  const hanTerms: string[] = [];

  for (const sequence of query.match(hanSequencePattern) ?? []) {
    const chars = Array.from(sequence);
    hanTerms.push(sequence);

    for (let index = 0; index < chars.length; index += 1) {
      hanTerms.push(chars[index]);

      for (let size = 2; size <= 4 && index + size <= chars.length; size += 1) {
        hanTerms.push(chars.slice(index, index + size).join(''));
      }
    }
  }

  return unique([...normalized.split(/\s+/), ...hanTerms]);
}

function getEditDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  if (Math.abs(left.length - right.length) > 2) return Number.POSITIVE_INFINITY;

  const matrix = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

  for (let index = 0; index <= left.length; index += 1) matrix[index][0] = index;
  for (let index = 0; index <= right.length; index += 1) matrix[0][index] = index;

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function matchesWholeToken(tokens: string[], term: string) {
  return tokens.includes(term);
}

function matchesTokenPrefix(tokens: string[], term: string) {
  return tokens.some((token) => token.startsWith(term));
}

function getFuzzyMatchScore(term: string, tokens: string[]) {
  if (term.length < 4) return 0;

  const threshold = term.length >= 7 ? 2 : 1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const token of tokens) {
    if (Math.abs(token.length - term.length) > threshold) continue;
    const distance = getEditDistance(term, token);
    if (distance < bestDistance) bestDistance = distance;
  }

  if (bestDistance > threshold) return 0;
  return threshold === 1 ? 16 - bestDistance * 6 : 18 - bestDistance * 5;
}

interface IndexedDocument extends ClientSearchDocument {
  normalizedTitle: string;
  normalizedDescription: string;
  normalizedTags: string;
  normalizedSearchTerms: string;
  titleTokens: string[];
  descriptionTokens: string[];
  tagTokens: string[];
  searchTokens: string[];
}

export function indexDocuments(documents: ClientSearchDocument[]): IndexedDocument[] {
  return documents.map((document) => ({
    ...document,
    normalizedTitle: normalizeSearchText(document.title),
    normalizedDescription: normalizeSearchText(document.description),
    normalizedTags: normalizeSearchText(document.tagsText),
    normalizedSearchTerms: normalizeSearchText(document.searchTerms),
    titleTokens: unique(tokenize(document.title)),
    descriptionTokens: unique(tokenize(document.description)),
    tagTokens: unique(tokenize(document.tagsText)),
    searchTokens: unique(tokenize(document.searchTerms))
  }));
}

function scoreDocument(document: IndexedDocument, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = unique(tokenize(query));
  const expandedTokens = expandSearchQuery(query);
  const auxiliaryTokens = expandedTokens.filter(
    (token) => !queryTokens.includes(token) && token.length >= 2
  );

  let score = 0;
  let matchedQueryTokens = 0;

  if (document.normalizedTitle === normalizedQuery) score += 280;
  else if (document.normalizedTitle.startsWith(normalizedQuery)) score += 220;
  else if (document.normalizedTitle.includes(normalizedQuery)) score += 140;

  if (document.normalizedTags === normalizedQuery) score += 180;
  else if (document.normalizedTags.startsWith(normalizedQuery)) score += 130;
  else if (document.normalizedTags.includes(normalizedQuery)) score += 90;

  if (document.normalizedDescription.includes(normalizedQuery)) score += 50;
  if (document.normalizedSearchTerms.includes(normalizedQuery)) score += 35;

  for (const token of queryTokens) {
    let tokenMatched = false;

    if (matchesWholeToken(document.titleTokens, token)) {
      score += 120;
      tokenMatched = true;
    } else if (matchesTokenPrefix(document.titleTokens, token)) {
      score += 88;
      tokenMatched = true;
    } else if (document.normalizedTitle.includes(token)) {
      score += 54;
      tokenMatched = true;
    }

    if (matchesWholeToken(document.tagTokens, token)) {
      score += 92;
      tokenMatched = true;
    } else if (matchesTokenPrefix(document.tagTokens, token)) {
      score += 70;
      tokenMatched = true;
    }

    if (matchesTokenPrefix(document.descriptionTokens, token)) {
      score += 26;
      tokenMatched = true;
    }

    if (matchesWholeToken(document.searchTokens, token)) {
      score += 24;
      tokenMatched = true;
    } else if (matchesTokenPrefix(document.searchTokens, token)) {
      score += 16;
      tokenMatched = true;
    }

    if (!tokenMatched) {
      const fuzzyScore = Math.max(
        getFuzzyMatchScore(token, document.titleTokens),
        getFuzzyMatchScore(token, document.tagTokens),
        getFuzzyMatchScore(token, document.searchTokens)
      );

      if (fuzzyScore > 0) {
        score += fuzzyScore;
        tokenMatched = true;
      }
    }

    if (tokenMatched) matchedQueryTokens += 1;
  }

  for (const token of auxiliaryTokens) {
    if (matchesWholeToken(document.searchTokens, token)) score += 10;
    else if (matchesTokenPrefix(document.searchTokens, token)) score += 6;
  }

  if (matchedQueryTokens === 0 && score < 80) return null;

  return {
    id: document.id,
    matchedQueryTokens,
    score
  };
}

export function searchDocuments(documents: IndexedDocument[], query: string) {
  const byId = new Map(documents.map((document) => [document.id, document]));
  const ranked = documents
    .map((document) => scoreDocument(document, query))
    .filter((item): item is { id: string; matchedQueryTokens: number; score: number } => Boolean(item))
    .sort((left, right) => {
      if (left.matchedQueryTokens !== right.matchedQueryTokens) {
        return right.matchedQueryTokens - left.matchedQueryTokens;
      }

      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return (
        Date.parse(byId.get(right.id)?.dateISO ?? '1970-01-01') -
        Date.parse(byId.get(left.id)?.dateISO ?? '1970-01-01')
      );
    });

  const topScore = ranked[0]?.score ?? 0;
  const cutoff = Math.max(45, topScore * 0.28);

  return ranked.filter((item) => item.score >= cutoff);
}
