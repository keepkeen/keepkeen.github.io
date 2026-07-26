import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sortPosts } from '../utils/content';
import { buildSearchIndexEntry } from '../utils/search';

// Lazily fetched by the archive search UI so the index never bloats the HTML.
export const GET: APIRoute = async () => {
  const posts = sortPosts(await getCollection('posts', ({ data }) => !data.draft));
  const entries = posts.map((post) => buildSearchIndexEntry(post));

  return new Response(JSON.stringify(entries), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
