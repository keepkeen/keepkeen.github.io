import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { basename, dirname, isAbsolute, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  if (!process.argv[index + 1]) throw new Error(`${name} requires a value`);
  return resolve(process.argv[index + 1]);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function safeRelativePath(relativePath) {
  return (
    typeof relativePath === 'string' &&
    relativePath.endsWith('.epub') &&
    !isAbsolute(relativePath) &&
    !relativePath.includes('\\') &&
    posix.normalize(relativePath) === relativePath &&
    relativePath.split('/').length >= 2
  );
}

function atomicWrite(destination, content) {
  mkdirSync(dirname(destination), { recursive: true });
  const temporary = `${destination}.keepkeen-part`;
  const backup = `${destination}.keepkeen-backup`;
  rmSync(temporary, { force: true });
  rmSync(backup, { force: true });
  writeFileSync(temporary, content);
  if (existsSync(destination)) renameSync(destination, backup);
  try {
    renameSync(temporary, destination);
    rmSync(backup, { force: true });
  } catch (error) {
    rmSync(temporary, { force: true });
    if (existsSync(backup) && !existsSync(destination)) renameSync(backup, destination);
    throw error;
  }
}

function atomicReplaceDirectory(source, destination) {
  const temporary = `${destination}.keepkeen-part`;
  const backup = `${destination}.keepkeen-backup`;
  rmSync(temporary, { recursive: true, force: true });
  rmSync(backup, { recursive: true, force: true });
  cpSync(source, temporary, { recursive: true });
  if (existsSync(destination)) renameSync(destination, backup);
  try {
    renameSync(temporary, destination);
    rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    if (existsSync(backup) && !existsSync(destination)) renameSync(backup, destination);
    throw error;
  }
}

const kindleRoot = argument('--kindle-root');
const manifestPath = argument('--manifest', join(projectRoot, 'public/ebooks/library.json'));
const bundlePath = argument(
  '--bundle',
  join(projectRoot, 'public/ebooks/KeepKeen-Blog-library.zip')
);
const pluginPath = argument('--plugin', join(projectRoot, 'kindle/keepkeensync.koplugin'));

if (!kindleRoot) {
  throw new Error(
    'Usage: npm run install:kindle -- --kindle-root /Volumes/Kindle [--manifest FILE --bundle FILE]'
  );
}
for (const required of ['documents', 'koreader', 'koreader/plugins']) {
  const path = join(kindleRoot, required);
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new Error(`Refusing to install: ${path} is not an existing directory`);
  }
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const bundleBuffer = readFileSync(bundlePath);
if (
  manifest.schemaVersion !== 1 ||
  manifest.rootDirectory !== 'KeepKeen Blog' ||
  !Array.isArray(manifest.books) ||
  manifest.bookCount !== manifest.books.length ||
  !manifest.bundle ||
  manifest.bundle.bytes !== bundleBuffer.length ||
  manifest.bundle.sha256 !== sha256(bundleBuffer)
) {
  throw new Error('Manifest and full-library bundle do not match');
}

const booksByPath = new Map();
for (const book of manifest.books) {
  if (
    !safeRelativePath(book.relativePath) ||
    typeof book.bytes !== 'number' ||
    !/^[0-9a-f]{64}$/u.test(book.sha256) ||
    booksByPath.has(book.relativePath)
  ) {
    throw new Error(`Unsafe or duplicate book record: ${book.relativePath}`);
  }
  booksByPath.set(book.relativePath, book);
}

const zip = await JSZip.loadAsync(bundleBuffer);
const files = Object.values(zip.files).filter((entry) => !entry.dir);
if (files.length !== booksByPath.size) throw new Error('Bundle book count does not match manifest');

const libraryRoot = join(kindleRoot, 'documents', manifest.rootDirectory);
let updated = 0;
let unchanged = 0;
for (const entry of files) {
  const book = booksByPath.get(entry.name);
  if (!book) throw new Error(`Unexpected bundle entry: ${entry.name}`);
  const content = await entry.async('nodebuffer');
  if (content.length !== book.bytes || sha256(content) !== book.sha256) {
    throw new Error(`Bundle checksum mismatch: ${entry.name}`);
  }
  const destination = join(libraryRoot, entry.name);
  const current = existsSync(destination) ? readFileSync(destination) : null;
  if (current && current.length === book.bytes && sha256(current) === book.sha256) {
    unchanged += 1;
  } else {
    atomicWrite(destination, content);
    updated += 1;
  }
}

const pluginDestination = join(kindleRoot, 'koreader/plugins', basename(pluginPath));
atomicReplaceDirectory(pluginPath, pluginDestination);
writeFileSync(
  join(libraryRoot, '.keepkeen-library.json'),
  `${JSON.stringify({ revision: manifest.revision, installedAt: new Date().toISOString() }, null, 2)}\n`
);

for (const book of manifest.books) {
  const installed = readFileSync(join(libraryRoot, book.relativePath));
  if (installed.length !== book.bytes || sha256(installed) !== book.sha256) {
    throw new Error(`Post-install verification failed: ${book.relativePath}`);
  }
}

console.log(
  `Installed ${manifest.bookCount} books (${updated} updated, ${unchanged} unchanged) and ${basename(pluginPath)}.`
);
