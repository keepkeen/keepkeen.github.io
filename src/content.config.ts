import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: '**/*.{md,mdx}'
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    lang: z.enum(['en', 'zh', 'zh-CN', 'zh-TW']).default('en'),
    // Optional series membership: `series` is the id (filename) of an entry in
    // src/content/series; `seriesOrder` pins the position (falls back to date order).
    series: z.string().optional(),
    seriesOrder: z.number().int().positive().optional()
  })
});

const series = defineCollection({
  loader: glob({
    base: './src/content/series',
    pattern: '**/*.{md,mdx}'
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    lang: z.enum(['en', 'zh', 'zh-CN', 'zh-TW']).default('en'),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false)
  })
});

export const collections = { posts, series };
