# Contributing (notes-to-self)

Mostly a note for me so the rules of the road stay visible while I'm writing.

## Confidentiality guardrail

This repo is public. Some of what I work on is not. **Never publish anything that names or details a private project — by name, internals, file references, screenshots, or specific terminology.**

What's fine:
- Writing *generically* about working on "an automation project" or "an agent project I'm building."
- Lessons learned at the level of "I learned X while building Y" without naming or technically describing the project.

What's not fine:
- Any literal project name that's meant to stay private.
- Architecture documents, code snippets, file paths, or internal terminology from a private repo.

When in doubt, hold it back. Easy to publish later, hard to un-publish.

## Pre-commit hook

There's a hook at [.git-hooks/pre-commit](.git-hooks/pre-commit) that scans staged changes for forbidden terms and blocks the commit if any are present. The list of forbidden terms is **not** stored in this repo (storing them here would defeat the point). It lives in `.git-hooks/.forbidden-terms`, which is gitignored.

### One-time setup after cloning

```bash
git config core.hooksPath .git-hooks
echo "your-private-project-name" > .git-hooks/.forbidden-terms
# add more terms, one per line
```

Lines starting with `#` are comments. The hook matches case-insensitively as a regex alternation.

## Writing style

- First-person, conversational, no buzzwords.
- It's fine to publish things that aren't finished. Mark them `status: seedling` or `status: growing` in frontmatter.
- Cross-link liberally with `[[wiki-links]]` — the graph is the point.
- Don't preach the [principles](content/principles.md). Let them show up implicitly in what I build.

## Adding a note

1. New file under `content/<topic>/<slug>.md`.
2. Frontmatter:
   ```yaml
   ---
   title: Human-readable title
   tags: [optional, tags]
   status: seedling | growing | evergreen
   ---
   ```
3. Write.
4. Preview locally: `npx quartz build --serve`.
5. Commit and push.

## Adding images

Image bins live next to the content they belong to. Drop photos in the matching folder:

| Page                          | Drop photos in                           |
| ----------------------------- | ---------------------------------------- |
| `cars/fj80.md`                | `cars/images/fj80/`                      |
| `cars/supra.md`               | `cars/images/supra/`                     |
| `cars/datsun-510.md`          | `cars/images/datsun-510/`                |
| `scanning/grabcad.md`         | `scanning/images/grabcad/`               |
| Scan examples / process       | `scanning/images/scans/`                 |
| `fsae/*`                      | `fsae/images/`                           |
| `code/trailer-controller.md`  | `code/images/trailer-controller/`        |
| `code/health-dashboard.md`    | `code/images/health-dashboard/`          |
| `forensics/*`                 | `forensics/images/` (general only)       |
| `making/guitar-pedals.md`     | `making/images/guitar-pedals/`           |
| `making/midi-controller.md`   | `making/images/midi-controller/`         |
| `making/bolt-counter.md`      | `making/images/bolt-counter/`            |

Use descriptive filenames (`turbo-install-trial-fit.jpg` beats `IMG_2384.jpg`). Spaces or capitals are fine; Quartz handles them.

**The `images/` folders themselves are excluded from page generation** (see `ignorePatterns` in `quartz.config.ts`) so dropping in an image won't accidentally create a public folder page. Images only appear publicly once they're explicitly referenced from a markdown file like this:

```markdown
![Turbo trial fit on the 1FZ-FE](images/fj80/turbo-install-trial-fit.jpg)
```

When you've dropped photos in a bin, tell me what each one is and I'll arrange them into the right pages with captions.
