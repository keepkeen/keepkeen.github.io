import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ebookCatalog, ebookPilotPosts } from './ebooks.config.mjs';
import { slugFromPostFile } from './ebook-lib.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ebookDirectory = join(projectRoot, 'public/ebooks');
const opdsPath = join(projectRoot, 'public/opds.xml');
const manifestPath = join(ebookDirectory, 'catalog.json');

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
    return run('java', ['-jar', process.env.EPUBCHECK_JAR, epubPath]);
  }
  return run('epubcheck', [epubPath]);
}

if (!existsSync(manifestPath) || !existsSync(opdsPath)) {
  throw new Error('Run npm run build:ebooks before validating EPUB output');
}

run('xmllint', ['--noout', opdsPath]);
const opds = readFileSync(opdsPath, 'utf8');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.length !== ebookPilotPosts.length) {
  throw new Error(`Expected ${ebookPilotPosts.length} pilot EPUB files, found ${manifest.length}`);
}

for (const spec of ebookPilotPosts) {
  const slug = slugFromPostFile(spec.file);
  const record = manifest.find((entry) => entry.slug === slug);
  if (!record) throw new Error(`${slug}: missing from generated catalog`);
  const epubPath = join(ebookDirectory, record.epubFilename);
  const coverPath = join(ebookDirectory, record.coverFilename);
  if (!existsSync(epubPath) || !existsSync(coverPath)) {
    throw new Error(`${slug}: missing EPUB or cover`);
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

  if (!opds.includes(record.epubUrl) || !opds.includes(record.coverUrl)) {
    throw new Error(`${slug}: OPDS feed is missing acquisition or cover URL`);
  }
  console.log(
    `Validated ${record.epubFilename}: ${record.formulaCount} ${record.mathRenderer} formulas, ${record.sourceImageCount} source images`
  );
}

if (!opds.includes('http://opds-spec.org/acquisition')) {
  throw new Error('OPDS feed has no acquisition relation');
}
if (!opds.includes(`href="${new URL(ebookCatalog.feedPath, ebookCatalog.siteUrl)}"`)) {
  throw new Error('OPDS feed self URL is incorrect');
}
console.log('EPUB and OPDS validation passed.');
