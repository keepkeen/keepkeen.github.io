# Blog Overhaul Plan

## 2026-03-22 Design Correction Pass

目标：

- `Home` 和 `Blog` 必须是同一套出版物界面，不允许首页是专题拼贴、博客页是目录工具这两种互相割裂的风格。
- 背景统一为纯白；去掉半透明头部、blur、偏暖底色、卡片阴影和不必要的面板感。
- `Blog` 页面必须让列表成为主角；桌面端预览框只在 hover/focus 某一条目时浮现，不应长期常驻抢占空间。
- 搜索入口收敛成图标触发，不再占据整行大输入框；展开后再进入检索状态。
- 主题切换收敛成图标按钮：默认跟随系统，不显示单独的 `Auto` 模式文案；按钮图标始终显示“当前实际主题”，点击一次即切到反向主题并持久化。
- 全站视觉应从“常见模板式 blog”收敛到“克制、锋利、统一、目录优先”的个人出版物界面。
- 如果 `Home` 仍然是编排页、`Blog` 仍然是目录工具页，那么即使视觉 token 接近也仍然是割裂的；本轮必须把它们收敛成同一个出版物产品的 front page / archive 关系。

本轮实施清单：

- [x] 重写共享设计 tokens 与基础布局，统一 `Home` / `Blog` / 头部控件的设计语言。
- [x] 把全站背景收敛为纯白，并移除头部 blur、浮层和多余面板阴影。
- [x] 重做头部导航与主题按钮，改为更轻的文字导航 + 日夜图标切换。
- [x] 重构首页信息架构，使其与 blog 目录页共享相同的列表、节奏和排版系统。
- [x] 重构 blog 目录页，让列表占据主要宽度，预览卡在桌面端仅在 hover/focus 时浮现。
- [x] 把搜索入口改为图标触发的紧凑搜索，不默认铺开大搜索栏。
- [x] 逐项重新审核桌面/平板/手机的响应式表现与 hover/触屏退化。
- [x] 运行 `npm run check` 与 `npm run build`，把结果写回 review。

## 2026-03-22 Convergence Pass

目标：

- `Home` 不再保留自己的独立页面语法，而是成为同一出版物系统里的前台封面。
- `Blog` 的目录语言必须直接渗透到 `Home` 的“最新文章”区，而不是只做样式层相似。
- 两页要共享相同的核心列表组件、预览逻辑和元信息节奏，差异只能来自作用域不同，而不是组件宇宙不同。
- 归档搜索必须保持 icon-first：只有点击图标后才展开空白输入框，不默认展示大搜索栏，也不在输入框里放提示语。
- 预览框只在鼠标移到标题链接或键盘 focus 到标题链接时才展开，不能由整行 hover 触发。

本轮实施清单：

- [x] 抽出并复用统一的文章目录组件，让 `Home` 和 `Blog` 共用核心列表/预览结构。
- [x] 重写首页，把“最新文章”区升级成与 archive 同构的 front page block。
- [x] 砍掉首页多余的专属结构，保留真正必要的 front page 信息。
- [x] 重新审查两页在桌面和移动端的组件对齐程度。
- [x] 再次运行 `npm run check` 和 `npm run build`，并记录 review 结果。

## 2026-03-22 Interaction Tightening Pass

目标：

- 把首页和归档页共享的部分收敛为“文章列表骨架”，而不是继续复用整套 archive 交互。
- 归档页搜索改成真正的 click-to-open 空输入框。
- 归档页预览只由标题链接 hover/focus 触发，列表本体保持稳定，不靠整行 hover 放大存在感。
- 首页继续做 front page，只共享列表语言，不共享 archive 的搜索与 hover-preview 控制层。

本轮实施清单：

- [x] 拆分共享列表组件与 archive 增强组件，移除首页无用的搜索数据和脚本负担。
- [x] 调整归档搜索交互，确保默认折叠、无 placeholder、点击图标展开、Esc/外部点击关闭。
- [x] 调整预览触发源，只响应标题链接的 hover/focus。
- [x] 修正残留的旧主题脚本逻辑，避免线上继续带着废弃状态字段。
- [x] 运行 `npm run check` 和 `npm run build`，补写 review。

## 2026-03-22 Tail Pass

目标：

- 把 `About` 页也收敛进同一套出版物语法，不再保留旧的 panel/card 页面语气。
- 继续做本地收尾验证，确认 `About` 的新结构已经进入构建产物。
- 明确记录当前真正剩下的尾项，只保留无法在这个环境内完成的浏览器实机回归。

本轮实施清单：

- [x] 重写 `About` 页结构，改成与 `Home` / `Blog` 同源的 editorial hero + section rail 语法。
- [x] 跑通 `npm run check` 和 `npm run build`，确认没有回归。
- [x] 点检 `dist/about/index.html`，确认新 hero、profile、trajectory、notes 结构已进入产物。
- [x] 回写 review，并保留最终浏览器 QA 为唯一未清项。

## 2026-03-22 High-Signal Typography Pass

目标：

- 把“极简但优雅”收敛成可执行的排版和间距规则，而不是继续靠组件感和版块感撑页面。
- 在不违背既有要求的前提下，吸收高端技术博客的高信噪比特征：严格字距、阅读宽度、灰阶层次、无阴影、单栏流式版面、极轻边框。
- 继续保持纯白浅色背景、紧凑图标化控件、标题 hover 预览和无 placeholder 搜索，不回退到此前被否掉的浮夸样式。

本轮实施清单：

- [x] 把新的审美规则回写到项目约束，明确“排版优先于装饰”。
- [x] 重构全局 typography、color math、spacing 与 header chrome。
- [x] 收敛 `Home` / `Blog` / `About` / `Article` 到更稳定的单栏阅读流。
- [x] 重做目录预览和文章阅读细节，让它们更像精细出版物而不是普通模板。
- [x] 运行 `npm run check`、`npm run build`，补写 review。

## 2026-03-22 Studio Gateway Pass

目标：

- 让 Studio 不再只是本地文件工具，而是能通过安全网关直连 Notion API。
- 禁止把 Notion integration token 暴露到前端或静态产物；所有 Notion 请求必须通过服务端 gateway。
- 给 Studio 加上网关会话认证，默认锁定远程动作，只有拿到 token 并换取会话后才能导入或推送 Notion 页面。
- 保持现有本地 Markdown 工作流可用，不因为加了远程能力而破坏本地保存和导入。

本轮实施清单：

- [x] 新增独立 Studio gateway，提供会话认证、Notion 搜索、导入、创建和更新接口。
- [x] 让 Studio 支持网关锁定、token 自动认证、Notion 页面搜索、API 导入和 API 推送。
- [x] 增加环境变量、工作流透传和文档，明确 GitHub Pages 与 gateway 的职责边界。
- [x] 运行 `npm run check`、`npm run build`，并补做最基本的 gateway 语法/会话验证。

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
- 2026-03-22 第二轮“收敛修正”已完成：问题不在颜色或字重，而在 `Home` 和 `Blog` 仍然分别扮演“编排页”和“目录工具页”。这一轮已把首页的“最新文章”切换为和 archive 共用的目录组件，包含同一套条目结构、hover/focus 预览、元信息节奏和移动端退化逻辑。
- 首页已明显瘦身：去掉了原先更像首页专属语法的多段重复 rails，把 front page 收敛成 `hero + recent writing directory + one supporting map section`，与 blog 形成“front page / full archive”的关系，而不是两个各说各话的页面。
- 这轮再次验证了 `npm run check` 与 `npm run build`，依旧通过；并且点检了 `dist/index.html` 与 `dist/blog/index.html`，确认首页已经出现 `Recent writing` 目录块、`Open the full archive` 链接和与 archive 同源的 preview 容器，blog 也明确说明它是同一套 front page 语言的完整版归档。
- 2026-03-22 第三轮“交互收紧”已完成：首页和归档页不再共用整套 archive 组件，而是拆成“共享文章列表骨架 + 归档增强层”。首页现在只复用列表语法，不再输出 archive 的搜索 JSON、搜索脚本和 hover-preview 控制逻辑。
- 新增共享组件 `src/components/PostList.astro`，`BlogDirectory.astro` 现在只负责 archive 专属交互；这让 `Home` 是 front page，`Blog` 是 archive，而不是两个大小不同的同页。
- 归档搜索现在保持 icon-first：默认折叠、点击按钮才展开、输入框无 placeholder、Esc 和外部点击都会关闭；构建产物中也已确认首页没有 `blog-search-data`、没有 `data-search-toggle`，blog 的 input 也不再带 placeholder。
- 预览触发已收紧到标题链接本身：构建产物中的 archive 条目已带 `data-directory-link`，不再由整行 hover 激活；同时旧的主题脚本残留 `themeMode/getStoredMode` 也已从 `BaseLayout` 清除。
- 2026-03-22 尾项收口已继续推进：`About` 页已改成与 `Home` / `Blog` 同源的 editorial hero + section rail 结构，不再保留旧的 panel/card 语法；内容被重组为 `Profile / Trajectory / Notes` 三段，语气和版式都回到同一出版物系统内。
- 这一轮再次验证了 `npm run check` 与 `npm run build`，结果仍然是通过；并且额外点检了 `dist/about/index.html`，确认新的 `About` hero、`Profile`、`Trajectory`、`Current questions` 和 GitHub 链接都已进入生产产物。
- 2026-03-22 “高信噪比排版”收口已完成：全局 token 已改成更严格的灰阶系统和单一点缀色，正文与标题改为更克制的系统字体栈、`65ch` 级阅读宽度和更稳定的行距，不再依赖原先偏模板化的字体与组件感。
- `Home`、`Blog`、`About` 和文章页现在都进一步回到单栏阅读流：hero 与 section rail 不再做强烈双栏分割，文章页目录也不再是侧栏，而是回到正文前的内联目录块，更接近高端技术出版物的阅读节奏。
- 目录预览这轮已从“固定右栏”改成真正的悬浮预览：只在 hover/focus 标题时出现，并按视口重新定位；同时搜索、主题按钮和边框细节也继续收紧到更安静的 chrome。
- 旧字体依赖 `@fontsource-variable/manrope` 已移除，社交卡片字体引用也已同步清理，避免新旧审美混用。
- 本轮再次通过了 `npm run check` 和 `npm run build`；并且点检了 `dist/index.html`、`dist/blog/index.html`、`dist/about/index.html` 与文章产物，确认新的文案、搜索状态、归档预览结构和单栏文章布局已经进入构建结果。
- 2026-03-22 Studio gateway 已补齐：新增独立 `gateway/server.mjs`，把 Notion token 留在服务端，通过 `GET/POST/DELETE /api/studio/session` 做会话认证，并提供 Notion 页面搜索、导入、创建和更新接口。
- Studio 页面现在支持 gateway 锁定和自动认证：如果构建时配置了 `PUBLIC_STUDIO_GATEWAY_URL`，页面会默认锁定远程动作；可通过输入 token 或访问 `/studio/#gateway_token=...` 交换成 HttpOnly 会话 cookie，再解锁 Notion 搜索、API 导入和 API 推送。
- 现有本地 Markdown 工作流仍保留：连接本地 `src/content/posts`、打开文件、保存、另存、导出和 Notion zip 导入都没有被远程功能替换掉，而是与 gateway 模式并存。
- GitHub Actions 构建已支持透传 `PUBLIC_STUDIO_GATEWAY_URL` 和 `PUBLIC_SHOW_STUDIO`；根目录新增 `.env.example` 和 README 说明，明确 GitHub Pages 只负责静态站点，真正的 Notion 鉴权和发布动作必须走独立 gateway。
- 这轮验证包含三层：`node --check gateway/server.mjs` 通过，`npm run check` 通过，`npm run build` 通过；另外还做了本地 gateway smoke test，确认未认证访问 `/api/notion/pages` 会返回 `401`，认证成功后会签发 `HttpOnly` 会话 cookie，而未配置 `NOTION_TOKEN` 时远程接口会明确返回 `503`。
- 2026-03-25 推送前再次复核通过：`node --check gateway/server.mjs`、`npm run check`、`npm run build` 均再次通过，当前待发布内容与任务记录一致，可直接提交到 `origin/main`。
- 当前仍未清零的只剩最终浏览器像素级 QA：包括真实 hover/focus、主题切换、不同分辨率、Studio 保存与 Notion 导入的实机回归。当前环境里仍只能做到构建产物和 HTML/脚本级验证。
