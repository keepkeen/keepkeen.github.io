// Incremental content publish: stage ONLY src/content, commit, rebase-pull, push.
//
//   npm run ship                        # publish all new/changed content
//   npm run ship -- "add post: 标题"    # custom commit message
//   npm run ship -- --dry-run           # show what would be published, change nothing
//
// Code changes outside src/content are never touched — they stay local, so
// content publishing can't fight with in-progress feature work, and a
// rebase-pull means add-only pushes never conflict with the remote.
import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const show = (cmd) => execSync(cmd, { stdio: 'inherit' });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const message = args.filter((arg) => arg !== '--dry-run').join(' ').trim();

const branch = run('git rev-parse --abbrev-ref HEAD');

// Refuse to mix in anything that was already staged manually.
if (run('git diff --cached --name-only')) {
  console.error('The git index already has staged changes. Commit or unstage them first,');
  console.error('so `ship` cannot accidentally publish non-content work.');
  process.exit(1);
}

// Content sanity first (series refs, duplicate order, tag casing).
show('npm run validate:content');

run('git add src/content');
const staged = run('git diff --cached --name-only');

if (!staged) {
  console.log('Nothing new under src/content — nothing to publish.');
  process.exit(0);
}

const files = staged.split('\n');
console.log(`\nPublishing ${files.length} content file(s):`);
for (const file of files) {
  console.log(`  + ${file}`);
}

const leftBehind = run('git status --porcelain')
  .split('\n')
  .filter(Boolean)
  .filter((line) => !line.startsWith('?? ') && !line.slice(3).startsWith('src/content'));

if (leftBehind.length > 0) {
  console.log(`\n(${leftBehind.length} non-content change(s) stay local and are NOT published.)`);
}

if (dryRun) {
  run('git reset');
  console.log('\nDry run: index restored, nothing committed.');
  process.exit(0);
}

const names = files.map((file) => file.split('/').pop().replace(/\.(md|mdx)$/, ''));
const fallback =
  files.length === 1 ? `add post: ${names[0]}` : `add content: ${names.slice(0, 3).join(', ')}${files.length > 3 ? ` +${files.length - 3} more` : ''}`;

execSync(`git commit -m ${JSON.stringify(message || fallback)}`, { stdio: 'inherit' });

// Rebase onto whatever landed remotely in the meantime; add-only content
// commits replay cleanly, so this is where the usual push-fight disappears.
try {
  show(`git pull --rebase origin ${branch}`);
} catch {
  console.error('\nRebase hit a real conflict (same file edited on both sides).');
  console.error('Fix the files it lists, then: git add <file> && git rebase --continue && git push');
  console.error('Or bail out safely with: git rebase --abort');
  process.exit(1);
}

show(`git push origin ${branch}`);
console.log('\nPublished. GitHub Actions will deploy in ~2 minutes.');
