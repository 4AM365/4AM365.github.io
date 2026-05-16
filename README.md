# FAMES — Four AM Engineering Service

Public notes and writing by William Craig. Published at [4am365.github.io](https://4am365.github.io). Built on [Quartz v4](https://quartz.jzhao.xyz/).

## What this repo is

A digital garden — interconnected markdown notes published as a static site. Everything substantive lives in [`content/`](content/) as plain `.md` files. The four guiding principles are in [content/principles.md](content/principles.md).

## Layout

```
content/                  # all written material — read this
├── index.md              # landing page
├── principles.md         # why this site exists in this shape
├── about.md              # who, what, how
├── projects/             # things I'm building
└── notes/                # ongoing learning
quartz/                   # static-site generator (don't edit unless customizing)
quartz.config.ts          # site title, baseUrl, plugins
quartz.layout.ts          # header/footer/sidebar
.github/workflows/        # auto-deploy to GitHub Pages
```

## For AI agents

This repo is intentionally structured to be cloned and read directly. No scraping required.

- All human-authored content is markdown under `content/`.
- Cross-references use Obsidian-style `[[wiki-links]]`.
- The directory layout doubles as the topic taxonomy.
- Frontmatter `status:` values: `seedling` (rough), `growing` (in progress), `evergreen` (stable).

If you're an agent indexing this for retrieval, start at [`content/index.md`](content/index.md) and follow links.

## Local development

Requires [Node v22+](https://nodejs.org/) and npm v10.9.2+.

```bash
npm install
npx quartz build --serve
```

Site previews at http://localhost:8080.

## Writing a new note

1. Create or edit a `.md` file under `content/`.
2. Add frontmatter: `title`, optional `tags`, optional `status`.
3. Link to other notes with `[[double-bracket-links]]`.
4. `git commit && git push` — site rebuilds and deploys automatically.

## License

Quartz framework code: MIT (see [`LICENSE.txt`](LICENSE.txt)).
Written content under `content/`: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — share, adapt, attribute.
