// Content integrity checks that zod cannot express per-entry:
// - post `series` references must point to an existing, non-draft series file
// - `seriesOrder` must not repeat within one series
// - tags must not collide by case ("AI" vs "ai" would split archives)
// Run via `npm run validate:content`; CI fails the build on any error.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import yaml from 'js-yaml';

const POSTS_DIR = 'src/content/posts';
const SERIES_DIR = 'src/content/series';

function readFrontmatter(path) {
  const raw = readFileSync(path, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!match) {
    return null;
  }

  return yaml.load(match[1]) ?? {};
}

function listMarkdown(dir) {
  try {
    return readdirSync(dir).filter((name) => /\.(md|mdx)$/.test(name));
  } catch {
    return [];
  }
}

const errors = [];

const seriesIds = new Map();
for (const file of listMarkdown(SERIES_DIR)) {
  const id = basename(file).replace(/\.(md|mdx)$/, '');
  const data = readFrontmatter(join(SERIES_DIR, file));

  if (!data) {
    errors.push(`${SERIES_DIR}/${file}: missing frontmatter`);
    continue;
  }

  if (!data.title || !data.description) {
    errors.push(`${SERIES_DIR}/${file}: series requires title and description`);
  }

  seriesIds.set(id, { draft: Boolean(data.draft) });
}

const seriesOrders = new Map();
const tagCasing = new Map();

for (const file of listMarkdown(POSTS_DIR)) {
  const path = `${POSTS_DIR}/${file}`;
  const raw = readFileSync(join(POSTS_DIR, file), 'utf8');
  const data = readFrontmatter(join(POSTS_DIR, file));

  const illegalControl = raw.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/u);
  if (illegalControl) {
    errors.push(
      `${path}: contains XML-illegal control character U+${illegalControl[0]
        .codePointAt(0)
        .toString(16)
        .toUpperCase()
        .padStart(4, '0')}`
    );
  }

  if (!data) {
    errors.push(`${path}: missing frontmatter`);
    continue;
  }

  if (data.series) {
    const target = seriesIds.get(data.series);

    if (!target) {
      errors.push(`${path}: series "${data.series}" has no file in ${SERIES_DIR}/`);
    } else if (target.draft && !data.draft) {
      errors.push(`${path}: references draft series "${data.series}" but is not a draft itself`);
    }

    if (data.seriesOrder != null) {
      const key = `${data.series}#${data.seriesOrder}`;

      if (seriesOrders.has(key)) {
        errors.push(
          `${path}: duplicate seriesOrder ${data.seriesOrder} in series "${data.series}" (also in ${seriesOrders.get(key)})`
        );
      } else {
        seriesOrders.set(key, file);
      }
    }
  }

  for (const tag of data.tags ?? []) {
    const lower = String(tag).toLowerCase();
    const seen = tagCasing.get(lower);

    if (seen && seen.tag !== tag) {
      errors.push(
        `${path}: tag "${tag}" collides with "${seen.tag}" (${seen.file}) — unify the casing`
      );
    } else if (!seen) {
      tagCasing.set(lower, { tag, file });
    }
  }
}

if (errors.length > 0) {
  console.error(`Content validation failed with ${errors.length} error(s):\n`);
  for (const error of errors) {
    console.error(`  ✗ ${error}`);
  }
  process.exit(1);
}

console.log('Content validation passed.');
