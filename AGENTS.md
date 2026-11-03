# GaŤe Parking: rules for AI coding agents

The single source of rules for every AI agent in this repo (Codex, Copilot, Cursor and others; Claude Code loads this file through `CLAUDE.md`). Student team project (team 3) with 11 contributors, many of whom are new to git. Your job is to keep git safe and simple for them while they work. Read `README.md`, `CONTRIBUTING.md`, `docs/PBS.md` and `docs/SCOPE.md` for project context.

## Git rules (always follow)

1. **Never commit or push directly to `main`.** If the current branch is `main`, create a branch first.
2. **Never force-push** (`--force`, `--force-with-lease`) and never `git reset --hard`, `git clean -fd`, `git checkout .` or delete branches/files the user did not ask about. If a git problem seems to need one of these, stop and explain the situation in plain language first.
3. **One person, one branch, one topic.** Branch names: `<type>/<short-description>` with type `feat`, `fix`, `docs`, `test` or `chore` (e.g. `feat/vehicle-registration`).
4. **Sync before you start and before you push**: fetch, then merge `origin/main` into the branch. Resolve conflicts with the user, never by discarding their or a teammate's changes.
5. **Only touch your own area.** Stay inside the files needed for the user's PBS task. Do not reformat, rename or reorganize other people's code, and do not change shared contracts (API shapes, DB schema, data model) unless the task says so. If a change is needed outside the task, tell the user to talk to the team first.
6. **Never commit secrets**: `.env`, keys, credentials, tokens. Use `.env.example` for new variables. Only stage files that belong to the task, never build output.
7. **Changes reach `main` only through a pull request** (rules: `CONTRIBUTING.md`). Never approve a PR on the user's behalf, and never merge a PR that is red or has unresolved conversations. Merge an unreviewed PR only when the user asks and has the Admin or Maintain role on the repo (check: `gh api repos/{owner}/{repo} --jq .permissions.maintain` is `true`); GitHub lets these roles bypass the review rule. Everyone else needs a teammate's approval first. Keep PRs to one topic and under ~1000 changed lines of code (tests, docs and `package-lock.json` do not count).
8. **Commit only when the user asks** (or through the Claude Code slash commands in `CLAUDE.md`).

## Commit and PR title format

Conventional Commits, **a single line, no body**:

```
<type>(<optional scope>): <description>
feat(vehicles): add plate validation
```

- Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `style`, `ci`.
- The description starts with a lower-case word, is imperative, has no full stop, and the whole line is at most 72 characters.
- Names and acronyms later in the line are fine (`add JWT login`).
- Nothing may follow the line: no body and no AI attribution (`Co-Authored-By`, session links). The same goes for PR descriptions.
- The PR title follows the same format, because a squash merge (the default) uses it as the commit on `main`. CI checks the PR title and the `.githooks/commit-msg` hook checks each commit locally; both only warn, so get it right yourself.

## Everyday git steps

| Step                 | Commands                                                                 |
| -------------------- | ------------------------------------------------------------------------ |
| Start a task         | `git switch main && git pull --ff-only && git switch -c feat/short-name` |
| Commit               | `git add <files> && git commit -m "feat(x): add something"`              |
| Bring in teammates   | `git fetch origin && git merge origin/main`                              |
| Push and open the PR | `git push -u origin <branch>` then `gh pr create` using the PR template  |

## Talking to the user

Assume the user does not know git. Explain what you are about to do in one plain sentence, and what happened afterwards. Do not use jargon without a short explanation. When something goes wrong, say what state their work is in (it is safe / it is not committed yet) before proposing a fix.

## Project layout

- `backend/`: backend app, DB migrations, backend tests
- `frontend/`: frontend app and tests
- `docs/`: PBS, scope, API docs, business model, wireframes, test reports

Stack: React + TypeScript (Vite) frontend, Node.js + Express + TypeScript backend, MongoDB (Mongoose). npm workspaces; run `npm run check` (format, lint, types, tests, build) before committing or opening a PR; it must pass. Do not introduce other frameworks or dependency managers without team agreement. New contributors follow `CONTRIBUTING.md`.

## Domain reminders

- Roles: signed-in user and administrator. Admins can edit and delete any reservation; users only their own.
- Vehicles have a license plate, engine type (combustion / electric) and size (small / standard / large).
- Spots have a type (standard / disabled / EV), a size and a status (free / reserved / occupied).
- Scope is decided in `docs/SCOPE.md`: the 11 user stories are the MVP; gate hardware, live charger status/tariffs and analytics are stretch. Check it before building something that is not in a user story.

## CI and Docker integrity

Never make CI pass by weakening it. Do not skip, delete or loosen tests, add `eslint-disable` / `@ts-ignore` / `continue-on-error`, lower coverage thresholds, or edit `.github/`, Dockerfiles, `docker-compose.yml`, `eslint.config.js`, root `package.json`, `.claude/`, `CLAUDE.md` or this file unless the user's task is about them (these need maintainer approval, see `.github/CODEOWNERS`). If a check fails, fix the cause or explain it to the user. Keep every Docker `HEALTHCHECK` and the `/api/health` endpoint working.

## Quality

Keep changes small and match the surrounding code style (`.editorconfig`). Add or update tests and docs for what you change. Do not leave debug code, commented-out blocks or stray files.
