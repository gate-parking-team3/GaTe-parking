# GaŤe Parking: rules for AI coding agents

For Codex and any other AI agent working in this repo (Claude Code reads `CLAUDE.md`, which has the same rules). The team is 11 students and several are new to git: keep git safe and simple, and explain what you do in plain language. Full workflow: `CONTRIBUTING.md`. Scope: `docs/SCOPE.md`. Plan: `docs/PBS.md`.

## Git rules (always)

1. **Never commit or push directly to `main`.** If you are on `main`, create a branch first.
2. **Never force-push**, and never run `git reset --hard`, `git clean`, `git checkout .` or delete branches or files the user did not ask about. If a git problem seems to need one, stop and explain.
3. **One person, one branch, one topic.** Branch names: `<type>/<short-description>`, type `feat`, `fix`, `docs`, `test` or `chore` (e.g. `feat/vehicle-registration`).
4. **Sync before you start and before you push:** `git fetch`, then `git merge origin/main`. Resolve conflicts with the user, keeping both sides' work.
5. **Stay inside the user's task.** Do not reformat, rename or reorganize other people's code, and do not change shared contracts (API shapes, DB schema, data model) unless the task says so.
6. **Never commit secrets** (`.env`, keys, tokens). New variables go in `.env.example`.
7. **Changes reach `main` only through a pull request** reviewed by a teammate. Never approve a PR for the user and never merge one that is unreviewed, red or has unresolved conversations. One topic per PR, under about 400 changed lines.

## Commit and PR title format (CI rejects anything else)

Conventional Commits, **a single line, no body**:

```
<type>(<optional scope>): <description>
feat(vehicles): add plate validation
```

- Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `style`, `ci`.
- The description starts with a lower-case word, is imperative, has no full stop, and the whole line is at most 72 characters.
- Names and acronyms later in the line are fine (`add JWT login`).
- The PR title follows the same format, because squash merging uses it as the commit on `main`.
- Commit only when the user asks.

## Equivalent of the Claude slash commands

| Step                 | Commands                                                                 |
| -------------------- | ------------------------------------------------------------------------ |
| Start a task         | `git switch main && git pull --ff-only && git switch -c feat/short-name` |
| Commit               | `git add <files> && git commit -m "feat(x): add something"`              |
| Bring in teammates   | `git fetch origin && git merge origin/main`                              |
| Push and open the PR | `git push -u origin <branch>` then `gh pr create` using the PR template  |

Only stage files that belong to the task, never `.env` or build output.

## Stack and checks

React + TypeScript (Vite) frontend, Node.js + Express + TypeScript backend, MongoDB (Mongoose), npm workspaces. Run `npm run check` (format, lint, types, tests, build) before committing or opening a PR; it must pass. Do not add other frameworks or dependency managers without team agreement.

**Never make CI pass by weakening it:** no skipped or deleted tests, no `eslint-disable` or `@ts-ignore` to hide problems, no lowered coverage thresholds, no `continue-on-error`. Do not edit `.github/`, Dockerfiles, `docker-compose.yml`, `eslint.config.js`, root `package.json`, `.claude/`, `CLAUDE.md` or this file unless the task is about them; a maintainer must approve those. Keep every Docker `HEALTHCHECK` and the `GET /api/health` endpoint working.
