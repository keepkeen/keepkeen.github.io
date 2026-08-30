export const ebookCatalog = {
  title: 'Liuliming · Kindle 电子书库',
  author: 'Liuliming',
  language: 'zh-CN',
  siteUrl: 'https://keepkeen.github.io',
  feedPath: '/opds.xml',
  description: '面向 Kindle 与 KOReader 的离线 EPUB 版本。'
};

// Pilot set: one math-heavy article, one mixed media/code article, and one
// long-form Chinese baseline. Expand only after all three pass on the PW4.
export const ebookPilotPosts = [
  {
    file: '2026-08-29-rl-paper-03-gae.md',
    expects: { math: true, images: true, code: false }
  },
  {
    file: '2026-07-26-slime-debugging-reliability-performance.md',
    expects: { math: false, images: true, code: true }
  },
  {
    file: '2026-08-30-china-agent-interview-guide-2025-2026.md',
    expects: { math: false, images: false, code: false }
  }
];
