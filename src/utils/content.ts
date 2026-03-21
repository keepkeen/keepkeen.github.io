import type { CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

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
  const words = (source ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
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
