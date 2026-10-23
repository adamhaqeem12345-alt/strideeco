<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shared repository workflow

- GitHub `adamhaqeem12345-alt/strideeco`, branch `main`, is the shared source of truth. Fetch its current state before starting work and preserve collaborators' commits and local changes.
- This checkout's `github` remote points to GitHub; `origin` is a historical local bundle. Use the verified GitHub remote for pushes.
- Push completed changes to a feature branch and use a pull request to integrate them into `main`. A branch push alone does not update collaborators who use `main`.
- Before reporting that collaborators can pull the latest release, verify the pull request is merged and its release commit is an ancestor of GitHub `main`.
- Preserve history. Do not force-push or reset collaborators' work to synchronize branches.
