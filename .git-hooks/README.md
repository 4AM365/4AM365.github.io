# Git hooks

Custom hooks for this repo. To activate them locally:

```bash
git config core.hooksPath .git-hooks
```

Run this once after cloning.

## Hooks

- **pre-commit** — refuses commits that contain any forbidden term listed in `.git-hooks/.forbidden-terms` (gitignored, set up locally per [CONTRIBUTING.md](../CONTRIBUTING.md)).
