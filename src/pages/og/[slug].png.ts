import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import sharp from 'sharp';
import { siteConfig } from '../../site.config';
import { formatDate, getPostLang, getPostSlug, getReadingTime, sortPosts } from '../../utils/content';
import { buildOgCardSvg } from '../../utils/og-card';

export async function getStaticPaths() {
  const posts = sortPosts(await getCollection('posts', ({ data }) => !data.draft));

  return posts.map((post) => ({
    params: { slug: getPostSlug(post) },
    props: { post }
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { post } = props;
  const lang = getPostLang(post);
  const minutes = getReadingTime(post.body);
  const readingLabel = lang.startsWith('zh') ? `约 ${minutes} 分钟` : `${minutes} min read`;
  const tags = post.data.tags.slice(0, 3).join(' · ');
  const footer = [formatDate(post.data.date, lang), readingLabel, tags].filter(Boolean).join('  ·  ');

  const svg = buildOgCardSvg({
    eyebrow: siteConfig.name,
    title: post.data.title,
    subtitle: post.data.description,
    footer
  });

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400'
    }
  });
};
