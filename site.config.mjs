export const siteConfig = {
  name: 'Liuliming',
  role: 'AI systems, software taste, and deliberate work.',
  siteUrl: 'https://keepkeen.github.io',
  email: '',
  location: 'Shanghai, China',
  defaultTitle: 'Liuliming | AI Systems, Software Taste, and the Long Game',
  description:
    'A technical publication about AI systems, software taste, markets, and the disciplines that make serious work durable.',
  hero: {
    eyebrow: 'Liuliming / Keepkeen',
    headline: 'AI systems, software taste, and the long game.',
    lead: 'Essays and field notes on building with AI, written from inside the work.',
    deck: 'Mostly technical, occasionally personal.',
    signature: 'Written in public. Kept deliberately small.'
  },
  // Comments are powered by giscus (GitHub Discussions). To enable:
  // 1. Enable Discussions on the repo and install https://github.com/apps/giscus
  // 2. Generate the four ids at https://giscus.app and fill them in below.
  comments: {
    enabled: false,
    repo: '',
    repoId: '',
    category: 'Announcements',
    categoryId: ''
  },
  deskFacts: [
    { label: 'Base', value: 'Shanghai / China' },
    { label: 'Mode', value: 'Essays, notebooks, experiments' },
    { label: 'Bias', value: 'Elegance over noise' },
    { label: 'Online', value: 'GitHub / keepkeen' }
  ],
  currentQuestions: [
    'What makes an AI product trustworthy after the demo glow fades?',
    'How much of engineering taste can be taught, and how much must be absorbed by exposure?',
    'What does a calm, compounding career look like in a noisy decade?'
  ],
  about: {
    intro:
      'I am interested in work that lives between technical depth and human judgment: intelligent systems, durable software, thoughtful products, and the inner discipline required to keep improving for a long time.',
    body: [
      'I like software that explains itself, interfaces that respect attention, and writing that leaves the reader a little sharper than before.',
      'This blog is where I publish essays, learning notes, and reflections from inside the work. I want it to feel less like content output and more like an edited notebook: selective, coherent, and alive.',
      'If there is a through-line in what I care about, it is this: make the system cleaner, make the judgment better, and give time enough room to matter.'
    ],
    journey: [
      {
        period: 'Now',
        title: 'AI systems, writing, and technical taste',
        description: 'Building and studying tools that shape modern work, while writing publicly to sharpen judgment.'
      },
      {
        period: 'Ongoing',
        title: 'Taste in code, products, and interfaces',
        description: 'Paying close attention to the small structural decisions that make products feel more coherent.'
      },
      {
        period: 'Always',
        title: 'The long game',
        description: 'Learning how patience, focus, capital allocation, and compounding outlast intensity.'
      }
    ],
    values: [
      'Precision over posturing.',
      'Taste as a serious technical skill.',
      'Systems that age well.',
      'Attention that compounds.'
    ],
    now: [
      'Building agentic workflows, evaluation loops, and cleaner interfaces for technical work.',
      'Writing about AI reliability, software taste, decision-making, and market structure.',
      'Collecting design references that feel inevitable rather than fashionable.'
    ],
    colophon:
      'Built with Astro, Markdown, KaTeX, and an editorial bias toward rhythm, restraint, and clarity.'
  },
  socialLinks: [
    {
      label: 'GitHub',
      href: 'https://github.com/keepkeen'
    }
  ]
};
