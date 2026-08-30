import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import JSZip from 'jszip';
import { ebookCatalog, ebookSeries } from './ebooks.config.mjs';
import { escapeXml, slugFromPostFile } from './ebook-lib.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const postsDirectory = join(projectRoot, 'src/content/posts');
const ebookDirectory = join(projectRoot, 'public/ebooks');
const opdsPath = join(projectRoot, 'public/opds.xml');
const seriesFeedDirectory = join(projectRoot, 'public/opds');
const manifestPath = join(ebookDirectory, 'catalog.json');
const syncManifestPath = join(ebookDirectory, 'library.json');

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      ...options
    });
  } catch (error) {
    const stdout = error.stdout?.toString() ?? '';
    const stderr = error.stderr?.toString() ?? '';
    throw new Error(`${command} ${args.join(' ')} failed:\n${stdout}\n${stderr}`);
  }
}

function runEpubcheck(epubPath) {
  if (process.env.EPUBCHECK_JAR) {
    return run('java', ['-jar', process.env.EPUBCHECK_JAR, epubPath, '--failonwarnings', '--quiet']);
  }
  return run('epubcheck', [epubPath, '--failonwarnings', '--quiet']);
}

function readActivePostSlugs() {
  return readdirSync(postsDirectory)
    .filter((file) => file.endsWith('.md'))
    .filter((file) => {
      const raw = readFileSync(join(postsDirectory, file), 'utf8');
      const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/u);
      if (!match) throw new Error(`${file}: missing YAML frontmatter`);
      return !yaml.load(match[1])?.draft;
    })
    .map(slugFromPostFile)
    .sort();
}

function assertSafeRelativePath(relativePath, expectedDirectory) {
  if (
    !relativePath ||
    relativePath.startsWith('/') ||
    relativePath.includes('\\') ||
    posix.normalize(relativePath) !== relativePath ||
    !relativePath.startsWith(`${expectedDirectory}/`)
  ) {
    throw new Error(`Unsafe or misplaced ebook path: ${relativePath}`);
  }
}

if (
  !existsSync(manifestPath) ||
  !existsSync(syncManifestPath) ||
  !existsSync(opdsPath) ||
  !existsSync(seriesFeedDirectory)
) {
  throw new Error('Run npm run build:ebooks before validating EPUB output');
}

run('xmllint', ['--noout', opdsPath]);
const opds = readFileSync(opdsPath, 'utf8');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const syncManifest = JSON.parse(readFileSync(syncManifestPath, 'utf8'));
const activePostSlugs = readActivePostSlugs();
if (manifest.length !== activePostSlugs.length) {
  throw new Error(`Expected ${activePostSlugs.length} EPUB files, found ${manifest.length}`);
}
const manifestSlugs = manifest.map((record) => record.slug).sort();
if (JSON.stringify(manifestSlugs) !== JSON.stringify(activePostSlugs)) {
  throw new Error('Generated EPUB catalog does not match the active Markdown post set');
}
if (syncManifest.schemaVersion !== 1 || syncManifest.bookCount !== manifest.length) {
  throw new Error('Invalid library sync manifest header or book count');
}
if (syncManifest.rootDirectory !== ebookCatalog.libraryDirectory) {
  throw new Error('Library sync manifest has the wrong root directory');
}
const bundleFilename = 'KeepKeen-Blog-library.zip';
const bundlePath = join(ebookDirectory, bundleFilename);
if (!existsSync(bundlePath) || !syncManifest.bundle) {
  throw new Error('Full-library installation bundle is missing');
}
const bundleBuffer = readFileSync(bundlePath);
const bundleSha256 = createHash('sha256').update(bundleBuffer).digest('hex');
if (
  syncManifest.bundle.bytes !== bundleBuffer.length ||
  syncManifest.bundle.sha256 !== bundleSha256 ||
  syncManifest.bundle.url !==
    new URL(
      `/ebooks/${bundleFilename}?v=${bundleSha256.slice(0, 16)}`,
      ebookCatalog.siteUrl
    ).toString()
) {
  throw new Error('Full-library installation bundle metadata is invalid');
}

const syncBySlug = new Map(syncManifest.books.map((book) => [book.slug, book]));
if (syncBySlug.size !== manifest.length) throw new Error('Duplicate or missing sync-manifest slugs');
const manifestByEpubPath = new Map(manifest.map((record) => [record.epubRelativePath, record]));
const seriesCounts = new Map();
const expectedEpubPaths = new Set();

for (const record of manifest) {
  const { slug } = record;
  const series = ebookSeries.find((candidate) => candidate.slug === record.seriesSlug);
  if (!series) throw new Error(`${slug}: unknown series ${record.seriesSlug}`);
  if (series.title !== record.seriesTitle || series.directory !== record.seriesDirectory) {
    throw new Error(`${slug}: series metadata does not match ebook configuration`);
  }
  assertSafeRelativePath(record.epubRelativePath, series.directory);
  assertSafeRelativePath(record.coverRelativePath, series.directory);
  if (expectedEpubPaths.has(record.epubRelativePath)) {
    throw new Error(`${slug}: duplicate EPUB path ${record.epubRelativePath}`);
  }
  expectedEpubPaths.add(record.epubRelativePath);
  seriesCounts.set(series.slug, (seriesCounts.get(series.slug) ?? 0) + 1);

  const epubPath = join(ebookDirectory, record.epubRelativePath);
  const coverPath = join(ebookDirectory, record.coverRelativePath);
  if (!existsSync(epubPath) || !existsSync(coverPath)) {
    throw new Error(`${slug}: missing EPUB or cover`);
  }
  if (statSync(epubPath).size !== record.bytes) throw new Error(`${slug}: EPUB byte count changed`);
  const sha256 = createHash('sha256').update(readFileSync(epubPath)).digest('hex');
  if (sha256 !== record.sha256 || !record.epubUrl.includes(`?v=${sha256.slice(0, 16)}`)) {
    throw new Error(`${slug}: EPUB checksum or cache-busting URL mismatch`);
  }
  const syncBook = syncBySlug.get(slug);
  if (
    !syncBook ||
    syncBook.relativePath !== record.epubRelativePath ||
    syncBook.url !== record.epubUrl ||
    syncBook.bytes !== record.bytes ||
    syncBook.sha256 !== record.sha256
  ) {
    throw new Error(`${slug}: sync manifest differs from generated catalog`);
  }

  run('unzip', ['-t', epubPath]);
  runEpubcheck(epubPath);
  const entries = run('unzip', ['-Z1', epubPath])
    .split(/\r?\n/u)
    .filter(Boolean);
  for (const required of ['mimetype', 'META-INF/container.xml']) {
    if (!entries.includes(required)) throw new Error(`${slug}: missing ${required}`);
  }
  if (!entries.some((entry) => entry.endsWith('.opf'))) throw new Error(`${slug}: missing OPF`);
  if (!entries.some((entry) => entry.endsWith('nav.xhtml'))) throw new Error(`${slug}: missing nav`);
  if (!entries.some((entry) => entry.endsWith('.png'))) throw new Error(`${slug}: missing cover image`);

  const opfEntry = entries.find((entry) => entry.endsWith('.opf'));
  const opf = run('unzip', ['-p', epubPath, opfEntry]);
  const expectedModified = new Date(record.updated).toISOString().replace('.000Z', 'Z');
  if (!opf.includes(`<meta property="dcterms:modified">${expectedModified}</meta>`)) {
    throw new Error(`${slug}: EPUB modified timestamp is not source-derived and reproducible`);
  }
  if (!opf.includes('belongs-to-collection') || !opf.includes(record.seriesTitle)) {
    throw new Error(`${slug}: EPUB collection metadata is missing`);
  }
  if (!opf.includes('group-position') || !opf.includes(String(record.seriesOrder))) {
    throw new Error(`${slug}: EPUB series position metadata is missing`);
  }

  const xhtmlEntries = entries.filter((entry) => entry.endsWith('.xhtml'));
  const xhtml = run('unzip', ['-p', epubPath, ...xhtmlEntries]);
  if (/katex/iu.test(xhtml)) throw new Error(`${slug}: KaTeX runtime markup remains in EPUB`);
  const mathNodeCount = (xhtml.match(/<math(?:\s|>)/giu) ?? []).length;
  // Pandoc assigns OCF-safe names (file0.svg, file1.svg, …) while packaging,
  // so identify MathJax assets by their SVG internals rather than source names.
  const svgEntries = entries.filter((entry) => entry.endsWith('.svg'));
  const mathAssets = svgEntries
    .map((entry) => ({ entry, svg: run('unzip', ['-p', epubPath, entry]) }))
    .filter(({ svg }) => /(?:data-mml-node=|id="MJX-)/u.test(svg));
  const mathEntries = mathAssets.map(({ entry }) => entry);
  if (record.mathRenderer === 'mathml') {
    if (mathNodeCount !== record.formulaCount) {
      throw new Error(
        `${slug}: expected ${record.formulaCount} MathML nodes, found ${mathNodeCount}`
      );
    }
    if (record.uniqueFormulaCount !== 0 || mathEntries.length !== 0) {
      throw new Error(`${slug}: MathML EPUB unexpectedly contains formula SVG files`);
    }
  } else if (record.mathRenderer === 'svg') {
    if (mathNodeCount !== 0) throw new Error(`${slug}: unexpected MathML nodes in SVG EPUB`);
    if (record.formulaCount > 0 && mathEntries.length !== record.uniqueFormulaCount) {
      throw new Error(
        `${slug}: expected ${record.uniqueFormulaCount} unique math SVG files, found ${mathEntries.length}`
      );
    }
    if (record.formulaCount === 0 && mathEntries.length !== 0) {
      throw new Error(`${slug}: unexpected math SVG files`);
    }
  } else {
    throw new Error(`${slug}: unsupported math renderer ${record.mathRenderer}`);
  }
  for (const { entry: mathEntry, svg } of mathAssets) {
    if (!svg.includes('<svg') || !svg.includes('<path') || svg.includes('data-mjx-error')) {
      throw new Error(`${slug}: invalid formula asset ${mathEntry}`);
    }
  }

  const seriesFeedPath = join(seriesFeedDirectory, `${series.slug}.xml`);
  if (!existsSync(seriesFeedPath)) throw new Error(`${series.slug}: missing OPDS series feed`);
  const seriesFeed = readFileSync(seriesFeedPath, 'utf8');
  if (
    !seriesFeed.includes(escapeXml(record.epubUrl)) ||
    !seriesFeed.includes(escapeXml(record.coverUrl))
  ) {
    throw new Error(`${slug}: OPDS feed is missing acquisition or cover URL`);
  }
}

const actualEpubPaths = readdirSync(ebookDirectory, { recursive: true })
  .filter((entry) => entry.endsWith('.epub'))
  .map((entry) => entry.replaceAll('\\', '/'));
if (
  actualEpubPaths.length !== expectedEpubPaths.size ||
  actualEpubPaths.some((entry) => !expectedEpubPaths.has(entry))
) {
  throw new Error('Generated ebook directory contains unexpected or missing EPUB files');
}
const bundle = await JSZip.loadAsync(bundleBuffer);
const bundledEpubPaths = Object.values(bundle.files)
  .filter((entry) => !entry.dir && entry.name.endsWith('.epub'))
  .map((entry) => entry.name);
if (
  bundledEpubPaths.length !== expectedEpubPaths.size ||
  bundledEpubPaths.some((entry) => !expectedEpubPaths.has(entry))
) {
  throw new Error('Full-library installation bundle contains unexpected or missing EPUB files');
}
for (const entry of Object.values(bundle.files)) {
  if (!entry.dir && !expectedEpubPaths.has(entry.name)) {
    throw new Error(`Unexpected file in full-library installation bundle: ${entry.name}`);
  }
  if (!entry.dir) {
    const bundledEpub = await entry.async('nodebuffer');
    const expected = manifestByEpubPath.get(entry.name);
    const bundledSha256 = createHash('sha256').update(bundledEpub).digest('hex');
    if (bundledEpub.length !== expected.bytes || bundledSha256 !== expected.sha256) {
      throw new Error(`EPUB content mismatch in full-library installation bundle: ${entry.name}`);
    }
  }
}
if (!opds.includes(`href="${new URL(ebookCatalog.feedPath, ebookCatalog.siteUrl)}"`)) {
  throw new Error('OPDS feed self URL is incorrect');
}
for (const series of ebookSeries) {
  const count = seriesCounts.get(series.slug) ?? 0;
  if (count === 0) continue;
  const feedPath = join(seriesFeedDirectory, `${series.slug}.xml`);
  run('xmllint', ['--noout', feedPath]);
  const feedUrl = new URL(
    `${ebookCatalog.seriesFeedDirectory}/${series.slug}.xml`,
    ebookCatalog.siteUrl
  ).toString();
  if (!opds.includes(feedUrl)) throw new Error(`${series.slug}: missing from root OPDS navigation`);
  console.log(`Validated ${series.directory}: ${count} EPUB files`);
}

const syncBooksForRevision = manifest.map((record) => ({
  slug: record.slug,
  title: record.title,
  seriesSlug: record.seriesSlug,
  seriesTitle: record.seriesTitle,
  seriesOrder: record.seriesOrder,
  relativePath: record.epubRelativePath,
  url: record.epubUrl,
  bytes: record.bytes,
  sha256: record.sha256,
  updated: record.updated
}));
const revision = createHash('sha256').update(JSON.stringify(syncBooksForRevision)).digest('hex');
if (revision !== syncManifest.revision) throw new Error('Library sync revision checksum is invalid');

console.log(
  `EPUB, series OPDS, and sync-manifest validation passed for ${manifest.length} books.`
);
