export const siteConfig = {
  name: 'Liuliming',
  role: '大模型算法、训练系统与工程实践的学习笔记。',
  siteUrl: 'https://keepkeen.github.io',
  email: '',
  location: 'Shanghai, China',
  defaultTitle: 'Liuliming | 大模型算法与系统笔记',
  description:
    '关于大模型算法、训练框架与工程实践的中文笔记：课程作业实录、源码精读、面试证据账本与求职资料。',
  hero: {
    eyebrow: 'Liuliming / Keepkeen',
    headline: '大模型算法与系统，边学边写。',
    lead: '课程作业逐篇复盘、训练框架源码精读、求职面经的证据账本——写给正在走这条路的人，也写给未来的自己。',
    deck: '中文长文为主，重工程与实证。',
    signature: '公开地学，认真地写。'
  },
  // Privacy-friendly analytics via GoatCounter (https://www.goatcounter.com):
  // register a site there and put its code here (e.g. 'keepkeen' for
  // keepkeen.goatcounter.com). Empty string keeps analytics disabled.
  analytics: {
    goatcounter: ''
  },
  deskFacts: [
    { label: 'Base', value: '上海' },
    { label: 'Mode', value: '长文 · 系列 · 源码精读' },
    { label: 'Bias', value: '证据优先' },
    { label: 'Online', value: 'GitHub / keepkeen' }
  ],
  currentQuestions: [
    '训练框架的设计取舍，怎样讲给第一次读源码的人听？',
    '大模型岗位的面试信号里，哪些经得起证据核对？',
    '课程作业与真实工程之间，缺的那一层到底是什么？'
  ],
  about: {
    intro:
      '我在系统性地学习大模型：从课程作业、训练框架源码到面试与求职，把整个过程原样写成笔记。',
    body: [
      '这里的文章多数很长：课程作业的逐篇复盘、verl 与 slime 这类训练框架的源码精读、以证据为准的面经账本。长，是因为想把"为什么"讲完整。',
      '我希望它读起来更像一本编辑过的笔记，而不是内容输出：成系列、可检索、有出处。',
      '如果这些笔记恰好帮你省下了一些摸索的时间，那就是它最好的用处。'
    ],
    journey: [
      {
        period: '现在',
        title: '大模型算法与训练系统',
        description: 'CS336 课程实录、RLHF 训练框架源码精读，以及围绕它们的工程笔记。'
      },
      {
        period: '进行中',
        title: '大模型算法岗求职笔记',
        description: '面经证据账本、笔试作战手册与 30 天执行计划。'
      },
      {
        period: '一直',
        title: '把学习过程写下来',
        description: '公开写作是最诚实的复盘方式：写不清楚，就是还没学会。'
      }
    ],
    values: [
      '证据优先，注明出处。',
      '长文成系列，不做碎片输出。',
      '源码为准，不转述二手结论。',
      '写给未来的自己，也写给同路人。'
    ],
    now: [
      '精读 verl 与 slime 的训练主链路源码。',
      '逐篇完成并复盘 Stanford CS336 的课程作业。',
      '维护大模型算法岗的求职笔记与题库。'
    ],
    colophon: '基于 Astro 与 Markdown 构建，数学公式用 KaTeX。设计偏好节制、留白与清晰。'
  },
  socialLinks: [
    {
      label: 'GitHub',
      href: 'https://github.com/keepkeen'
    }
  ]
};
