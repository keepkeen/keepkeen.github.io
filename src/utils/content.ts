import type { CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

const markdownSyntaxPattern =
  /```[\s\S]*?```|`([^`]+)`|!\[[^\]]*]\(([^)]+)\)|\[(.*?)\]\(([^)]+)\)|[*_~>#-]+/g;
const mathDelimiterPattern = /\$\$?([^$]+)\$\$?/g;

export function sortPosts(posts: Post[]) {
  return [...posts].sort((left, right) => right.data.date.valueOf() - left.data.date.valueOf());
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
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
  const words = stripMarkdown(source ?? '').split(/\s+/).filter(Boolean).length;
  return words;
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

export function withBasePath(path: string) {
  const base = import.meta.env.BASE_URL;
  const relative = path === '/' ? '.' : path.replace(/^\//, '');
  return new URL(relative, `https://placeholder${base}`).pathname;
}

export function getPostPath(post: Post) {
  return withBasePath(`/blog/${getPostSlug(post)}/`);
}
