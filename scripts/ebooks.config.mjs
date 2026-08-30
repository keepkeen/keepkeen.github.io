export const ebookCatalog = {
  title: 'Liuliming · Kindle 电子书库',
  author: 'Liuliming',
  language: 'zh-CN',
  siteUrl: 'https://keepkeen.github.io',
  feedPath: '/opds.xml',
  description: '面向 Kindle 与 KOReader 的离线 EPUB 版本。',
  mathScale: {
    inline: 1.6,
    display: 1.8
  }
};

// Pilot set: one math-heavy article, one mixed media/code article, and one
// long-form Chinese baseline. Expand only after all three pass on the PW4.
export const ebookPilotPosts = [
  {
    file: '2026-08-29-rl-paper-03-gae.md',
    filenameStem: '广义优势估计 GAE 论文精读',
    expects: { math: true, images: true, code: false }
  },
  {
    file: '2026-07-26-slime-debugging-reliability-performance.md',
    filenameStem: '训练系统调试、可靠性与性能',
    expects: { math: false, images: true, code: true }
  },
  {
    file: '2026-08-30-china-agent-interview-guide-2025-2026.md',
    filenameStem: '大厂智能体面经 2025-2026',
    expects: { math: false, images: false, code: false }
  }
];
