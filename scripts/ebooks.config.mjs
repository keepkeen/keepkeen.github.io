export const ebookCatalog = {
  title: 'Liuliming · Kindle 电子书库',
  author: 'Liuliming',
  language: 'zh-Hans',
  siteUrl: 'https://keepkeen.github.io',
  feedPath: '/opds.xml',
  seriesFeedDirectory: '/opds',
  syncManifestPath: '/ebooks/library.json',
  libraryDirectory: 'KeepKeen Blog',
  description: '面向 Kindle 与 KOReader 的全量离线 EPUB 书库。',
  mathRenderer: 'mathml',
  mathScale: {
    inline: 1.6,
    display: 1.8
  }
};

// Directory names are deliberately numbered: KOReader's file browser sorts
// them predictably even when locale-aware collation is unavailable.
export const ebookSeries = [
  {
    slug: 'reinforcement-learning-paper-reading',
    title: '强化学习论文精读',
    directory: '01 强化学习论文精读'
  },
  {
    slug: 'llm-agent-paper-reading',
    title: '智能体论文精读',
    directory: '02 智能体论文精读'
  },
  {
    slug: 'ilya-sutskever-reading-list',
    title: 'Ilya 阅读清单',
    directory: '03 Ilya 阅读清单'
  },
  {
    slug: 'coding-agent-source-analysis',
    title: 'Coding Agent 源码解析',
    directory: '04 Coding Agent 源码解析'
  },
  {
    slug: 'llm-reinforcement-learning-interview',
    title: '大模型强化学习面试',
    directory: '05 大模型强化学习面试'
  },
  {
    slug: 'llm-algo-job-hunt',
    title: '大模型算法求职',
    directory: '06 大模型算法求职'
  },
  {
    slug: 'verl-interview-guide',
    title: 'verl 面试与源码',
    directory: '07 verl 面试与源码'
  },
  {
    slug: 'slime-interview-guide',
    title: 'slime 面试与源码',
    directory: '08 slime 面试与源码'
  },
  {
    slug: 'stanford-cs336',
    title: 'Stanford CS336',
    directory: '09 Stanford CS336'
  },
  {
    slug: 'other',
    title: '其他',
    directory: '10 其他'
  }
];
