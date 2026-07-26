import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { siteConfig } from '../site.config';
import { buildOgCardSvg } from '../utils/og-card';

export const GET: APIRoute = async () => {
  const svg = buildOgCardSvg({
    eyebrow: siteConfig.name,
    title: siteConfig.hero.headline,
    subtitle: siteConfig.description,
    footer: siteConfig.hero.signature
  });

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400'
    }
  });
};
