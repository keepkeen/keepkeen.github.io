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

## GitHub Pages

1. Push the repository to GitHub.
2. In `Settings` -> `Pages`, set the source to `GitHub Actions`.
3. The workflow in `.github/workflows/deploy.yml` will build and publish the site on every push to `main`.
4. If the repo is `your-name.github.io`, the site deploys at the root. If it is a project repo, the Astro config infers the correct base path automatically in GitHub Actions.
5. `site.config.mjs` is the single source of truth for the site's public metadata. Astro reads `siteUrl` from there for canonicals and the sitemap, with a GitHub Actions fallback while the placeholder URL is still present.
6. Update `siteUrl`, social links, email, and personal copy in `site.config.mjs` before going live.
