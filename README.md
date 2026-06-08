# FAMES — Four AM Engineering Service

Notes by William Craig. Published at [4am365.github.io](https://4am365.github.io). Built on [Quartz v4](https://quartz.jzhao.xyz/).

## Layout

```
content/                  # markdown source
├── index.md              # landing
├── about.md              # bio
├── tuning/               # EMU Black tuning
├── cars/                 # build pages
├── code/                 # software projects
├── forensics/            # forensic engineering
├── making/               # hardware projects
├── scanning/             # 3D scanning
├── kitchen/              # recipes / calculators
└── notes/                # other notes
quartz/                   # static-site generator
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
