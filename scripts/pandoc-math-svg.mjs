#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import MathJax from 'mathjax';

const mathDirectory = process.env.EBOOK_MATH_DIR;
const statsPath = process.env.EBOOK_MATH_STATS;
const resourceDirectory = process.env.EBOOK_RESOURCE_DIR;
const siteUrl = process.env.EBOOK_SITE_URL;
const articleUrl = process.env.EBOOK_ARTICLE_URL;

if (!mathDirectory || !statsPath || !resourceDirectory || !siteUrl || !articleUrl) {
  throw new Error(
    'EBOOK_MATH_DIR, EBOOK_MATH_STATS, EBOOK_RESOURCE_DIR, EBOOK_SITE_URL, and EBOOK_ARTICLE_URL are required'
  );
}

mkdirSync(mathDirectory, { recursive: true });

await MathJax.init({
  loader: { load: ['input/tex', 'output/svg'] },
  svg: { fontCache: 'local' }
});

const adaptor = MathJax.startup.adaptor;
const cache = new Map();
const sanitizedSvgCache = new Map();
let formulaCount = 0;
let sanitizedSvgCount = 0;

async function renderMath(tex, display) {
  formulaCount += 1;
  const cacheKey = `${display ? 'display' : 'inline'}\0${tex}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const hash = createHash('sha256').update(cacheKey).digest('hex').slice(0, 20);
  const filename = `math-${display ? 'display' : 'inline'}-${hash}.svg`;
  const outputPath = `${mathDirectory}/${filename}`;
  const container = await MathJax.tex2svgPromise(tex, {
    display,
    em: 16,
    ex: 8,
    containerWidth: 560
  });
  const svgNode = adaptor.tags(container, 'svg')[0];
  if (!svgNode) {
    throw new Error(`MathJax produced no SVG for: ${tex}`);
  }

  const svg = adaptor.serializeXML(svgNode);
  if (svg.includes('data-mjx-error')) {
    throw new Error(`MathJax could not render: ${tex}`);
  }
  writeFileSync(outputPath, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);
  cache.set(cacheKey, outputPath);
  return outputPath;
}

function sanitizeSourceSvg(target) {
  const sourcePath = resolve(resourceDirectory, target);
  if (!existsSync(sourcePath)) return target;

  const existing = sanitizedSvgCache.get(sourcePath);
  if (existing) return existing;

  const source = readFileSync(sourcePath, 'utf8');
  // Mermaid currently emits a block <p> inside an inline <span>. EPUBCheck
  // rejects that XHTML nesting even though browsers repair it automatically.
  const sanitized = source.replace(
    /<span([^>]*)>\s*<p>([\s\S]*?)<\/p>\s*<\/span>/gu,
    '<span$1>$2</span>'
  );
  if (sanitized === source) return target;

  const hash = createHash('sha256').update(sourcePath).update(sanitized).digest('hex').slice(0, 20);
  const outputPath = `${mathDirectory}/source-${hash}.svg`;
  writeFileSync(outputPath, sanitized);
  sanitizedSvgCache.set(sourcePath, outputPath);
  sanitizedSvgCount += 1;
  return outputPath;
}

async function transform(value, context = {}) {
  if (Array.isArray(value)) {
    const transformed = [];
    for (const item of value) transformed.push(await transform(item, context));
    return transformed;
  }

  if (!value || typeof value !== 'object') return value;

  if (value.t === 'Header') {
    const [level, attributes, inlines] = value.c;
    return {
      ...value,
      c: [level, attributes, await transform(inlines, { ...context, inHeading: true })]
    };
  }

  if (value.t === 'Math') {
    const [mathType, tex] = value.c;
    if (context.inHeading) {
      return { t: 'Str', c: String(tex).replace(/\s+/gu, ' ').trim() };
    }
    const display = mathType.t === 'DisplayMath';
    const outputPath = await renderMath(tex, display);
    return {
      t: 'Image',
      c: [
        ['', [display ? 'math-display' : 'math-inline'], []],
        [{ t: 'Str', c: String(tex).replace(/\s+/gu, ' ').trim() }],
        [outputPath, '']
      ]
    };
  }

  if (value.t === 'Link') {
    const [attributes, inlines, [target, title]] = value.c;
    let normalizedTarget = target;
    if (target.startsWith('/') && !target.startsWith('//')) {
      normalizedTarget = new URL(target, siteUrl).toString();
    } else if (target.startsWith('./') || target.startsWith('../')) {
      normalizedTarget = new URL(target, articleUrl).toString();
    }
    return {
      ...value,
      c: [attributes, await transform(inlines, context), [normalizedTarget, title]]
    };
  }

  if (value.t === 'Image') {
    const [attributes, caption, [target, title]] = value.c;
    const normalizedTarget = extname(target).toLowerCase() === '.svg'
      ? sanitizeSourceSvg(target)
      : target;
    return {
      ...value,
      c: [attributes, await transform(caption, context), [normalizedTarget, title]]
    };
  }

  const transformed = {};
  for (const [key, child] of Object.entries(value)) {
    transformed[key] = await transform(child, context);
  }
  return transformed;
}

const input = readFileSync(0, 'utf8');
const document = JSON.parse(input);
const output = await transform(document);
writeFileSync(
  statsPath,
  `${JSON.stringify({
    formulaCount,
    uniqueFormulaCount: cache.size,
    sanitizedSvgCount
  }, null, 2)}\n`
);
process.stdout.write(JSON.stringify(output));
MathJax.done();
