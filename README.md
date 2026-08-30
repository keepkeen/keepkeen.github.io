# Liuliming Blog

An editorial Astro blog for long-form writing on AI, software, markets, and life.

## Stack

- Astro for static generation and routing.
- Markdown and MDX content collections for essays.
- KaTeX for LaTeX math rendering, loaded only on pages that need it.
- Shiki for code highlighting.
- A hardened Studio gateway for optional Notion sync.
- GitHub Actions for typecheck, build, and GitHub Pages deployment.

## Local Development

```bash
npm install
npm run dev
```

## Project Structure

- `site.config.mjs`: personal details, homepage copy, principles, and social links.
- `src/site.config.ts`: typed frontend re-export of the shared site config.
- `src/content/posts`: long-form posts in Markdown or MDX.
- `src/pages`: homepage, archive, about page, and post routes.
- `src/styles/global.css`: the visual system and editorial layout.

## Writing Posts

Add a new file to `src/content/posts` with frontmatter like this:

```md
---
title: "A New Essay"
description: "What the piece is about."
date: 2026-03-22
tags:
  - ai
  - notes
featured: false
draft: false
lang: en
---
```

Markdown posts support:

- fenced code blocks
- inline code
- LaTeX math via `$$ ... $$`
- tags, dates, featured flags, and optional `lang` (`en`, `zh-CN`, …)
- automatic tag archive pages under `/blog/tags/<tag>/`
- per-post Open Graph cards under `/og/<slug>.svg`

## Studio

`/studio/` is a local-first writing interface for Markdown and MDX drafts.

- `Open posts folder` connects the editor to `src/content/posts` in Chromium-based browsers.
- `Open file` loads an existing `.md` or `.mdx` file.
- `Save` writes back to the connected folder or file handle.
- `Import Notion export` accepts a Notion Markdown zip, plain Markdown, or MDX file.

## Secure Notion Gateway

Secure Notion API access does **not** run on GitHub Pages itself. The public site stays static, while a separate gateway process keeps the Notion token on the server and issues an authenticated Studio session.

1. Copy `.env.example` to `.env` or export the same variables in your host.
2. Set:
   - `STUDIO_GATEWAY_TOKEN`
   - `STUDIO_SESSION_SECRET`
   - `NOTION_TOKEN`
   - `NOTION_PARENT_ID`
   - `NOTION_PARENT_TYPE=page` or `data_source`
3. Start the gateway locally:

```bash
# generate secrets first, e.g. openssl rand -base64 32
npm run studio:gateway
```

Gateway hardening defaults:

- request body size limit
- auth + API rate limits
- Notion request timeouts
- signed sessions with `jti`
- local HTTP cookies without forced `Secure` on `127.0.0.1`

4. Build the site with `PUBLIC_STUDIO_GATEWAY_URL` pointed at that gateway.
5. Open `/studio/` and authenticate once with the gateway token, or visit it with `#gateway_token=YOUR_TOKEN`.
6. Studio Markdown previews are sanitized with DOMPurify before render.

The gateway exposes:

- `GET/POST/DELETE /api/studio/session` for Studio auth
- `GET /api/notion/pages` to search pages
- `GET /api/notion/pages/:id` to import a page as markdown
- `POST /api/notion/pages` to create a page
- `PATCH /api/notion/pages/:id` to update a page

If your Notion parent is a data source, optional `NOTION_PROP_*` environment variables let the gateway map Studio fields like title, description, slug, tags, dates, draft, and featured to Notion properties.

## GitHub Pages

1. Push the repository to GitHub.
2. In `Settings` -> `Pages`, set the source to `GitHub Actions`.
3. The workflow in `.github/workflows/deploy.yml` will build and publish the site on every push to `main`.
4. If the repo is `your-name.github.io`, the site deploys at the root. If it is a project repo, the Astro config infers the correct base path automatically in GitHub Actions.
5. `site.config.mjs` is the single source of truth for the site's public metadata. Astro reads `siteUrl` from there for canonicals and the sitemap, with a GitHub Actions fallback while the placeholder URL is still present.
6. Update `siteUrl`, social links, email, and personal copy in `site.config.mjs` before going live.
7. If you want the deployed Studio to talk to the gateway, add a repository variable named `PUBLIC_STUDIO_GATEWAY_URL`. The workflow already forwards it into the Astro build.

## Kindle Reader

The site also builds a lightweight reader under `/kindle/` for e-ink browsers. It reuses the same content collection while avoiding client-side JavaScript, web fonts, search indexes, sticky layouts, and dark-mode assets. `/kindle/archive/` lists every published post, and `/kindle/<slug>/` renders the corresponding article with simplified typography and navigation.

For offline reading, every non-draft post is also built as an EPUB 3 book with native
MathML. `series` and `seriesOrder` in post frontmatter determine the numbered KOReader
subdirectory, filename, EPUB collection metadata, and per-series OPDS feed. A normal push
to `main` runs the complete conversion and validation pipeline in GitHub Actions and
publishes:

- `/opds.xml`: the root OPDS navigation catalog;
- `/opds/<series>.xml`: one acquisition catalog per series;
- `/ebooks/library.json`: the checksum-addressed incremental-sync manifest;
- `/ebooks/KeepKeen-Blog-library.zip`: an exact full-library bundle for USB installation.

The KOReader plugin source is in `kindle/keepkeensync.koplugin`. Once installed, it checks
`library.json` after KOReader comes online, downloads only EPUB files whose byte count or
SHA-256 differs, and stores them below `documents/KeepKeen Blog/<numbered series>/`. It
checks at most once per day after a successful run and retries failed runs after one hour.
The built-in OPDS client remains available as a manual fallback.
