# Liuliming Blog

An editorial Astro blog for long-form writing on AI, software, markets, and life.

## Stack

- Astro for static generation and routing.
- Markdown and MDX content collections for essays.
- KaTeX for LaTeX math rendering.
- Shiki for code highlighting.
- A GitHub Actions workflow for GitHub Pages deployment.

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
---
```

Markdown posts support:

- fenced code blocks
- inline code
- LaTeX math via `$$ ... $$`
- tags and dates for archive sorting

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
npm run studio:gateway
```

4. Build the site with `PUBLIC_STUDIO_GATEWAY_URL` pointed at that gateway.
5. Open `/studio/` and authenticate once with the gateway token, or visit it with `#gateway_token=YOUR_TOKEN`.

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
