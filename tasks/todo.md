# Blog Overhaul Plan

## 2026-03-22 Design Correction Pass

目标：

- `Home` 和 `Blog` 必须是同一套出版物界面，不允许首页是专题拼贴、博客页是目录工具这两种互相割裂的风格。
- 背景统一为纯白；去掉半透明头部、blur、偏暖底色、卡片阴影和不必要的面板感。
- `Blog` 页面必须让列表成为主角；桌面端预览框只在 hover/focus 某一条目时浮现，不应长期常驻抢占空间。
- 搜索入口收敛成图标触发，不再占据整行大输入框；展开后再进入检索状态。
- 主题切换收敛成图标按钮：默认跟随系统，不显示单独的 `Auto` 模式文案；按钮图标始终显示“当前实际主题”，点击一次即切到反向主题并持久化。
- 全站视觉应从“常见模板式 blog”收敛到“克制、锋利、统一、目录优先”的个人出版物界面。

本轮实施清单：

- [x] 重写共享设计 tokens 与基础布局，统一 `Home` / `Blog` / 头部控件的设计语言。
- [x] 把全站背景收敛为纯白，并移除头部 blur、浮层和多余面板阴影。
- [x] 重做头部导航与主题按钮，改为更轻的文字导航 + 日夜图标切换。
- [x] 重构首页信息架构，使其与 blog 目录页共享相同的列表、节奏和排版系统。
- [x] 重构 blog 目录页，让列表占据主要宽度，预览卡在桌面端仅在 hover/focus 时浮现。
- [x] 把搜索入口改为图标触发的紧凑搜索，不默认铺开大搜索栏。
- [x] 逐项重新审核桌面/平板/手机的响应式表现与 hover/触屏退化。
- [x] 运行 `npm run check` 与 `npm run build`，把结果写回 review。

## Product Direction

目标不是继续做“有设计感的个人主页”，而是把它重做成一个朴素、整洁、目录优先、写作优先、可长期维护的技术博客产品。

当前代码里的主要偏差：

- `src/styles/global.css` 里大量使用渐变背景、圆角、glass-card、装饰性阴影和大标题字体，整体过于花哨。
- `src/pages/index.astro` 首页由多块卡片拼接组成，信息组织零散，不像稳定的博客入口。
- `src/pages/blog/index.astro` 目前只有简单归档列表，没有搜索、目录交互和 hover 预览。
- `src/layouts/PostLayout.astro` 文章页没有目录、没有代码块复制、没有公式块复制、没有主题感知和阅读辅助。
- 当前项目完全没有编辑器、Notion 导入或内容管理工作流，仍然依赖直接改源码。

## Research Notes

- [x] 审计现有实现与缺口。
- [x] 补充外部参考，确认优秀技术站点/文档站的共性。

研究结论会作为设计和实现约束：

- 优秀技术站点的基础能力是稳定导航、搜索、SEO、易读排版、代码高亮、暗色模式和响应式，而不是装饰性视觉优先。
- Astro 官方文档支持为代码高亮同时配置 light/dark 双主题，适合做系统主题同步。
- Pagefind 对静态站点和多语言检索很友好，但“中文 + 拼音”不是开箱即用能力。
- MiniSearch 原生支持 exact/prefix/fuzzy/field boosting，更适合做可控的自定义排序。
- `pinyin-engine` 可以为中文标题/标签建立拼音和首字母索引，适合补齐拼音召回。
- Notion 官方既支持 Markdown 导入，也提供 Blocks API 读取页面内容，适合做本地导入管线。

## Architecture Decisions

- [x] 保持公开博客为 Astro 静态站点，优先保证发布简单、访问快、部署稳定。
- [x] 新增“本地浏览器编辑器”而不是在线 CMS。
- [x] Notion 导入优先走“导出 Markdown/ZIP 后本地导入”的安全链路，而不是把 Notion secret 暴露给浏览器端编辑器。

这样做的原因：

公开站如果继续走静态部署，线上浏览器直接写文件并不现实；更稳妥的方案是把编辑器做成 repo 内的本地 authoring 工具，在本地开发环境中写入 `src/content/posts`，再继续使用现有静态构建发布。这样能满足“不要直接改源码”的诉求，同时不把整站升级成复杂后台系统。

## Implementation Checklist

- [x] Phase 1: 视觉系统重置

验收标准：
移除圆角 pill 导航、玻璃卡片、复杂渐变背景和过度装饰字体；建立浅色/深色两套 design tokens；统一间距、边框、层级和文字尺寸；确保移动端、平板、桌面端都不是勉强缩放后的样子。

交付内容：
重写 `src/styles/global.css` 的基础变量、排版、布局和组件样式；重做 `src/components/SiteHeader.astro` 和页脚的朴素版结构；同步调整 `src/layouts/BaseLayout.astro` 的 `theme-color` 和系统主题元信息。

- [x] Phase 2: 首页改成稳定入口页

验收标准：
首页不再是零散卡片堆叠，而是简洁欢迎区 + 最新文章 + 主题索引 + 明确入口；标题不夸张；布局在窄屏下保持秩序。

交付内容：
重写 `src/pages/index.astro`，把首页变成“博客总入口”而不是“个人形象页”；减少模块数量，提升信息密度和扫描效率。

- [x] Phase 3: Blog 页面改成目录 + Hover 预览

验收标准：
`/blog` 变成真正的目录页，默认是结构清晰的文章目录；鼠标悬停目录项时，旁边展示文章摘要、标签、时间、阅读时长和可能的封面占位；在触屏设备上改成点击展开或内联预览，不依赖 hover。

交付内容：
重写 `src/pages/blog/index.astro`；抽离目录项与预览面板组件；为桌面和触屏分别定义交互。

- [x] Phase 4: 搜索系统

验收标准：
支持标题、简介、正文片段、标签搜索；支持英文、中文、模糊匹配；支持拼音全拼和首字母召回；结果排序稳定，优先标题命中、前缀命中和更近文章；移动端可用。

交付内容：
新增构建时索引生成脚本与前端搜索组件；采用 “MiniSearch + 自定义字段权重 + pinyin-engine 辅助索引” 的方案；保留后续接入 Pagefind 的可能，但首版以可控召回和排序为主。

- [x] Phase 5: 文章页阅读增强

验收标准：
文章页具备更强的技术阅读能力，包括更稳的正文宽度、目录、锚点、代码块复制、公式块复制、长代码横向滚动、双主题代码高亮。

交付内容：
扩展 `src/layouts/PostLayout.astro`；为 Markdown/MDX 输出增加客户端增强脚本；为代码块和 KaTeX block 注入复制按钮；在 `astro.config.mjs` 中改成 Shiki 双主题配置。

- [x] Phase 6: 主题与响应式系统化适配

验收标准：
跟随系统浅色/深色主题，并允许手动切换与持久化；在手机、平板、不同分辨率 PC 上，导航、目录、文章正文、搜索、预览面板和编辑器都可用且不拥挤。

交付内容：
主题切换状态管理、CSS token 重构、关键断点重排、代码块/目录/搜索的窄屏降级方案。

- [x] Phase 7: 本地博客编辑器

验收标准：
可以在浏览器里新建、编辑、预览、保存 Markdown/MDX 文章；支持 frontmatter 表单编辑、草稿切换、slug/date/tags 管理、实时预览、语法提示和自动保存；用户不需要手动打开源码文件。

交付内容：
新增本地 authoring 页面和文件写入接口；编辑器默认直接操作 `src/content/posts`；提供 posts folder 浏览、文件筛选、保存校验、拖拽导入、快捷键、语法插入工具栏和实时预览。

- [x] Phase 8: Notion 导入

验收标准：
支持把 Notion Markdown/ZIP 导出导入为本地 Markdown 草稿；至少覆盖标题、段落、列表、代码块、引用、分割线、公式、图片链接等常见块；导入失败时要能给出可修复提示，并报告资产文件和相对路径风险。

交付内容：
实现 Studio 内的 Notion Markdown/ZIP 导入、拖拽导入、首个 Markdown 入口选择、frontmatter 自动补全、内容分析与导入报告；保留未来追加 API 导入的扩展位，但首版不把 secret 暴露到浏览器端。

- [x] Phase 9: SEO 与元信息补齐

验收标准：
每篇文章具备规范 title/description/canonical/open graph/更新时间；博客目录和文章页具备结构化数据；站点级 metadata 与主题色会随主题切换表现合理。

交付内容：
补强 `BaseLayout` 和文章页 metadata；补 `AboutPage`/`CollectionPage`/`BlogPosting`/`BreadcrumbList` 结构化数据；补 `robots.txt`、`rss.xml`、默认社交卡片和 canonical 细节。

- [ ] Phase 10: 全量审核与验证

验收标准：
每一阶段完成后都要重新审核；最终必须完成功能、视觉、响应式、主题、搜索、编辑器、导入链路的逐项回归，并留下 review 结论。

验证清单：
运行 `npm run check` 和 `npm run build`；手工检查首页、目录页、文章页、编辑器、Notion 导入；验证浅色/深色；验证桌面、平板、手机；验证英文/中文/拼音/模糊搜索；验证代码和公式复制按钮。

## Execution Order

- [x] 先出规格和计划，冻结方向。
- [x] 先做 Phase 1 到 Phase 3，把“视觉与信息架构”纠正回来。
- [x] 再做 Phase 4 到 Phase 6，把“搜索、阅读体验、主题和响应式”打牢。
- [ ] 最后做 Phase 10，把“全量验证与回归审核”补齐。

## Review

- 第一批实现已完成：顶部样式、背景、巨型花体字、首页碎片化结构、blog 目录化、hover 预览、搜索框架、代码块复制、公式块复制、文章页目录与双主题代码高亮。
- 全站视觉已切到更朴素的中性风格，移除了 glass-card 方向、夸张标题和装饰性背景。
- Blog 页面现在是“目录 + 右侧预览 + 搜索”的结构；移动端会退化为内联预览，不依赖 hover。
- 搜索已通过构建时拼音索引和 MiniSearch 验证过中文、拼音全拼、拼音首字母和模糊查询的基础召回。
- 系统主题现在支持跟随系统、手动切换和持久化；头部已加入主题切换控件，`theme-color` 也会随当前主题同步。
- 响应式细节已收紧：触屏和窄屏下 blog 目录页改走内联预览，避免 hover 依赖；导航、文章页和 studio 布局都做了窄屏重排。
- `/studio/` 已经提供第一版本地写作工作台：支持 frontmatter 表单、Markdown/MDX 内容编辑、实时预览、本地自动保存、打开文件、直接保存、另存为和导出 Markdown。
- `/studio/` 现在补成更完整的作者工作台：支持连接 `src/content/posts` 文件夹、筛选已存在文章、直接保存到目标目录、拖拽导入、Cmd/Ctrl+S 保存、Tab 缩进和常用 Markdown 片段插入。
- Studio 内已加入实时 checklist，会持续检查 title/slug/date/description/tags/正文长度/文件名冲突，保存时也会把剩余问题反映到状态栏。
- Notion 导入已经走通本地安全链路：支持 `.md`、`.mdx` 和 Notion `.zip` 导出导入，导入后会生成 frontmatter 草稿、保留正文、并给出 headings/list/code/math/image/assets/relative path 的导入报告。
- SEO 和元信息已补齐一轮：`BaseLayout` 现在输出更完整的 title/description/canonical/OG/Twitter metadata；文章页会输出 `BlogPosting` + `BreadcrumbList`；blog 目录页输出 `CollectionPage`；about 页输出 `AboutPage`。
- 站点级 feed 和抓取辅助已补上：新增 `rss.xml`、`robots.txt` 和默认社交卡片 `social-card.svg`，页脚也已加入 RSS 入口；`/studio/` 已标记 `noindex`。
- `npm run check` 已通过。
- `npm run build` 已通过。
- Phase 10 QA 中已额外发现并修复三类真实问题：`/studio/` 被错误写入 sitemap、`robots.txt` 对 `noindex` 页面设置了多余阻断、Studio 在改 slug/date/format 后保存时会继续覆盖旧文件句柄、搜索相关性对短词和模糊词过于宽松。
- 这些问题已分别通过 `@astrojs/sitemap` 过滤、`robots.txt` 调整、Studio 保存逻辑修正和目录页自定义评分器重排收口。
- 公开站头部已不再默认暴露 `Studio`；本地开发时仍可见，如需线上显示可设置 `PUBLIC_SHOW_STUDIO=true`。
- 自动化 QA 还额外验证了：构建产物包含 article/about/blog 的 JSON-LD、RSS 入口、theme toggle、代码/公式复制增强脚本；sitemap 中已移除 `/studio/`；搜索相关性对 `clarity`/`clarit`/`long game`/`invest`/`ai` 的结果排序已收紧。
- 中文、拼音和首字母召回已继续通过脚本验证，合成中文文档对 `技术`、`博客`、`jishu`、`jishuboke`、`jsbk`、`zhongwen`、`pinyin` 都能命中。
- 旧设计残留也已清理：未使用的 `PostCard.astro` 已删除，未再使用的 `@fontsource-variable/fraunces` 和 `minisearch` 依赖已移除，仓库里不再保留 `glass-card`/装饰字体/旧搜索实现的方向性噪音。
- 当前剩余重点：做最终浏览器实测，包括主题切换、不同分辨率、目录 hover/触屏退化、代码/公式复制、Studio 文件保存和 Notion 导入。在当前沙箱中本地监听端口被拒绝，无法完成真正的交互式浏览器回归，只能先做到构建产物与脚本级验证。
- 额外说明：当前示例文章没有二级/三级标题，因此文章目录组件已经接入，但只有后续文章包含 headings 时才会在页面中显示。
- 2026-03-22 新一轮设计纠偏已完成：`Home` 与 `Blog` 统一为同一套出版物界面，首页改成与归档页同样的“导语 + ruled lists + quiet metadata”结构，不再保留之前更像专题页/卡片页的分裂感。
- 全站浅色背景已收敛到纯白，头部移除了半透明与 blur，公共 panel 也改成了无阴影、克制边框的处理。
- 头部主题切换已改成图标按钮：默认按系统主题解析，按钮显示当前实际状态；点击后直接切到相反主题并持久化，不再暴露 `Auto / Light / Dark` 文案模式选择器。
- `/blog` 目录页已改成列表主导布局：搜索默认收进图标按钮里，桌面端预览区默认不出现，只在 hover/focus 某条目时浮现；小屏和触屏下则退化成条目内的短摘要，不再依赖常驻侧栏。
- 目录页的 tags 表现也已从 pill 样式收敛成更轻的文本元信息，减少“一块一块”的碎片感。
- 这轮重新验证了 `npm run check` 和 `npm run build`，结果分别为 `0 errors / 0 warnings / 0 hints` 和构建通过；同时点检了 `dist/index.html`、`dist/blog/index.html`、`dist/about/index.html`，确认新的首页结构、归档搜索图标、hover 预览容器和主题图标按钮都已进入生产产物。
