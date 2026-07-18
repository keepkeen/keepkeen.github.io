import type { CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;
export type PostLang = 'en' | 'zh' | 'zh-CN' | 'zh-TW';

const markdownSyntaxPattern =
  /```[\s\S]*?```|`([^`]+)`|!\[[^\]]*]\(([^)]+)\)|\[(.*?)\]\(([^)]+)\)|[*_~>#-]+/g;
const mathDelimiterPattern = /\$\$?([^$]+)\$\$?/g;

export function sortPosts(posts: Post[]) {
  return [...posts].sort((left, right) => right.data.date.valueOf() - left.data.date.valueOf());
}

export function formatDate(date: Date, lang: PostLang | string = 'en') {
  const locale = lang === 'en' ? 'en' : 'zh-CN';

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

export function getReadingTime(source?: string) {
  return Math.max(1, Math.round(countWords(source) / 220));
}

export function stripMarkdown(source: string) {
  return source
    .replace(markdownSyntaxPattern, (_, inlineCode, imageUrl, linkText, linkUrl) => {
      return inlineCode || linkText || imageUrl || linkUrl || ' ';
    })
    .replace(mathDelimiterPattern, '$1')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(source?: string) {
  const text = stripMarkdown(source ?? '');
  const han = (text.match(/[\p{Script=Han}]/gu) ?? []).length;
  const latin = text
    .replace(/[\p{Script=Han}]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean).length;

  return han + latin;
}

export function getPlainExcerpt(source: string, maxLength = 220) {
  if (source.length <= maxLength) {
    return source;
  }

  return `${source.slice(0, maxLength).replace(/\s+\S*$/, '').trim()}...`;
}

export function getPostSlug(post: Post) {
  return post.id.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

export function getPostLang(post: Post): PostLang {
  return post.data.lang ?? 'en';
}

export function normalizeHtmlLang(lang: string = 'en') {
  if (lang === 'zh' || lang === 'zh-CN') {
    return 'zh-CN';
  }

  if (lang === 'zh-TW') {
    return 'zh-TW';
  }

  return 'en';
}

export function withBasePath(path: string) {
  const base = import.meta.env.BASE_URL;
  const relative = path === '/' ? '.' : path.replace(/^\//, '');
  return new URL(relative, `https://placeholder${base}`).pathname;
}

export function getPostPath(post: Post) {
  return withBasePath(`/blog/${getPostSlug(post)}/`);
}

export function getTagSlug(tag: string) {
  return tag
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tag';
}

export function getTagPath(tag: string) {
  return withBasePath(`/blog/tags/${getTagSlug(tag)}/`);
}

export function collectTags(posts: Post[]) {
  const counts = new Map<string, number>();

  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count, slug: getTagSlug(tag), href: getTagPath(tag) }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

export function postHasMath(post: Post) {
  const source = post.body ?? '';

  if (/\$\$[\s\S]+?\$\$/.test(source)) {
    return true;
  }

  // Inline math: $...$, but ignore currency like $3.93 or lone $.
  return /(?<!\$)\$(?!\d)(?!\$)([^\n$]+?)\$(?!\$)/.test(source);
}
