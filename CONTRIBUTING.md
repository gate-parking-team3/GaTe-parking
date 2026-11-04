# Contributing

Everything a team member needs to work on GaŤe Parking: setup, daily workflow, rules for commits and pull requests, CI, and releases. Read it once, top to bottom, before your first change.

## Cheat sheet

```
git switch main && git pull --ff-only     # get the latest main
git switch -c feat/short-name             # new branch for your task
npm run check                             # must pass before you commit
git add <your files>                      # never .env, never `git add .` blindly
git commit -m "feat(vehicles): add plate validation"
git fetch origin && git merge origin/main # bring in teammates' work
git push -u origin feat/short-name        # then open the PR on GitHub
```

- **PR title** = one line, `<type>(<optional scope>): <lower-case description>`. Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `style`, `ci`.
- Good: `fix(auth): reject expired tokens`. Bad: `Fixed stuff`, `WIP`, `Update README.md.`
- Wrong PR title? The `PR title` check shows a warning and a bot comment explains the fix: click **Edit** next to the title on GitHub. No git needed.
- `npm install` turns on git hooks that format your files and warn you when a commit message does not follow the format. If a commit is refused, your changes are safe; read the message, fix it and commit again.
- Use VS Code and install the recommended extensions it suggests: files are formatted every time you save.

## 1. Setup (once)

| Tool                                                              | Why                             | Check                   |
| ----------------------------------------------------------------- | ------------------------------- | ----------------------- |
| [Git](https://git-scm.com)                                        | Version control                 | `git --version`         |
| [Node.js 22](https://nodejs.org)                                  | Runs frontend and backend       | `node -v` (22 or newer) |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Local MongoDB                   | `docker --version`      |
| [GitHub CLI](https://cli.github.com)                              | Lets `/ship` open pull requests | `gh --version`          |
| [Claude Code](https://claude.com/claude-code)                     | Handles git for you             | `claude --version`      |

- Log in once: `gh auth login` (GitHub.com, HTTPS, browser).
- Claim your free Copilot via [GitHub Education](https://education.github.com/pack) so Copilot can review your PRs.
- Tell git who you are:
  ```
  git config --global user.name "Your Name"
  git config --global user.email "your-github-email@example.com"
  ```
- Ask a maintainer to add you as a collaborator on the repo (Write role).

Get the project and start it:

```
git clone https://github.com/gate-parking-team3/GaTe-parking.git
cd GaTe-parking
npm install
cp .env.example .env
docker compose up -d mongo
npm run dev
```

Frontend: http://localhost:3000. Backend health: http://localhost:8080/api/health. Then open Claude Code in the folder with `claude`; it reads `CLAUDE.md` and knows the team rules.

`npm install` also switches on the team's git hooks (in `.githooks/`): every commit is auto-formatted with Prettier and you get a warning if its message does not follow the format. In VS Code, accept the recommended extensions (Prettier, ESLint, EditorConfig) so files are formatted on save.

## 2. Daily workflow

1. Pick your task (your user story in the README, or `docs/PBS.md`). Work only on your own task.
2. `/start-task feat/short-name` creates your branch from the latest `main`.
3. Write code (ask Claude for help). Stay inside your task.
4. `npm run check` must pass (format, lint, types, tests, build).
5. `/save` commits. `/sync` brings in your teammates' changes (do it daily and before shipping).
6. `/ship` pushes the branch and opens a pull request.
7. Fix review feedback with `/save` then `/ship`. After the merge, start the next task with a fresh `/start-task`.

Other commands: `npm run dev` (start everything), `npm run format` (auto-format), `npm run lint:fix`, `docker compose up --build` (full stack in containers).

Rules that keep us from colliding:

- **Never work on `main`.** One task, one branch, one pull request.
- **Do not edit other people's files or shared contracts** (API shapes, DB schema, data model) without talking to the team first. Backend changes that affect the API need `docs/api/` updated.
- **Never commit `.env` or any secret.** New variables go in `.env.example` with empty or placeholder values.
- **If git looks scary, stop and ask Claude** to explain. Your work is almost always safe. Never use `--force` or "reset" on your own.
- Scope is decided in `docs/SCOPE.md`.

Branch names: `<type>/<short-description>` with type `feat`, `fix`, `docs`, `test` or `chore` (e.g. `feat/vehicle-registration`).

## 3. Commits

[Conventional Commits](https://www.conventionalcommits.org), **one line only**, no body:

```
<type>(<optional scope>): <short description starting with a lower-case word>
feat(reservations): add time window validation
```

- Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `style`, `ci`.
- Imperative, starting with a lower-case word (names and acronyms later in the line are fine: `add JWT login`, `show GaŤe name`), no full stop, 72 characters max. One logical change per commit.
- Good: `fix(auth): reject expired tokens`. Bad: `Fixed stuff`, `WIP`, `Update README.md.`
- No AI tools or bots as commit authors or `Co-Authored-By` lines (GitHub would list them as contributors). The team's Claude Code settings turn them off, and the `No AI attribution` check blocks PRs that still have them. Dependabot is allowed.
- Dependabot's `chore(deps): ...` commits are exempt.

The `commit-msg` hook checks the message on your computer when you commit: if it is wrong, you get a warning showing the right format, but the commit is still made, because branch commit messages never reach `main`. `/save` writes a valid message for you. What matters is the PR title, because a squash merge (the default) turns it into the single commit on `main`. If a PR is merged with a merge commit or rebase instead, every commit lands on `main`, so keep the messages valid.

## 3b. Without Claude Code (plain git)

Any AI agent or editor works too. Codex and other agents read `AGENTS.md`; the Claude commands above are just shortcuts for these plain steps:

```
# start a task (from the latest main)
git switch main && git pull --ff-only
git switch -c feat/short-name

# save your work (one-line Conventional Commit, see section 3)
git add <the files you changed>
git commit -m "feat(vehicles): add plate validation"

# bring in your teammates' changes (daily, and before pushing)
git fetch origin
git merge origin/main

# publish and open the pull request
git push -u origin feat/short-name
gh pr create --title "feat(vehicles): add plate validation"
```

- Add only the files that belong to your task, never `.env`. Do not use `git add .` blindly.
- If the PR title is wrong, the `PR title` check shows a warning and a comment on the PR explains it: edit the title on GitHub, nothing else. Never force-push.
- Not using `gh`? Open the PR on the repo page after the push; GitHub shows a "Compare & pull request" button.

## 4. Pull requests

Developers never push to `main`. Everything goes through a pull request (PR) with a review, green CI and, by default, a squash merge. GitHub enforces this through the rulesets in `.github/rulesets/` (see [roles](#8-maintainer-setup-once-in-github-settings)). Maintainers may push to `main` directly, but should still use PRs for anything that deserves a second pair of eyes.

**Opening (`/ship` does it):**

- Title is a Conventional Commit, e.g. `feat(reservations): add time window validation`. A squash merge (the default) makes the title the commit on `main`.
- Fill in the template: what, why (link the user story or PBS task, e.g. `US 5`), how to test, checklist.
- One topic only, under about 1000 changed lines of code. Tests, docs and `package-lock.json` do not count. Bigger? Split it. No drive-by refactors or reformatting of other people's files.
- Open as a draft while unfinished; mark it ready when CI is green and you reviewed your own diff. Add a screenshot for UI changes.

**Review (enforced):**

- One approval from a teammate. Reviewers: if the author pushes big changes after you approved, take another look.
- Check the PR title too: a wrong title only warns, so get it fixed before merging (the merger can also correct it in the merge dialog).
- All review conversations must be resolved. Copilot reviews every PR and again after each push; treat its comments as a free first review and fix them or reply why not.
- Changes to CI, Docker, tooling and Claude rules also need the project lead's approval (Jan, see `.github/CODEOWNERS`), not just any teammate's.
- Reviewers: read the diff, run the branch if the change is non-trivial, check it against the user story. Be specific and kind. Review within one working day. Approve only what you read.

**Merging (enforced):** `Check`, `PR title`, `Docker build` and `Smoke test` green (fix any PR title warning before merging). Use **squash merge** unless there is a reason to keep the individual commits; merge commits and rebase are allowed too, but never rewrite a branch other people use. If GitHub says your branch conflicts with `main`, run `/sync`. The author merges their own approved PR. Never merge a red or conflicted PR and never bypass the rules, not even for a tiny fix.

## 5. CI and Docker

- **Never weaken the checks to get a PR through.** No skipped or deleted tests, no `eslint-disable` / `@ts-ignore` to hide real problems, no lowered coverage thresholds (50% minimum for now, we will raise it as the code grows), no `continue-on-error`, no editing workflows to bypass a failure. Fix the cause.
- CI jobs: `Check` (format, lint, types, tests, build), `PR title` (Conventional Commit; a wrong title gives a warning and a help comment, it does not block the merge), `Docker build`, `Smoke test` (the full stack starts and `/api/health` answers). `npm audit` and CodeQL run too.
- Files that control CI, Docker, tooling and Claude rules (`.github/`, Dockerfiles, `docker-compose.yml`, `eslint.config.js`, root `package.json`, `.claude/`, `CLAUDE.md`, `AGENTS.md`) are in `.github/CODEOWNERS`; only the project lead (Jan) can approve changes to them.
- Docker: only `backend/Dockerfile`, `frontend/Dockerfile` and `docker-compose.yml` define images and the local stack. Images build from the repo root with `npm ci`, run as non-root, contain no dev dependencies or secrets, and keep their `HEALTHCHECK`. Compose waits for healthy dependencies.
- `GET /api/health` returns 200 `{status:"ok",db:"up"}`, or 503 when MongoDB is down. Keep it working.

## 6. Releases

A release is a version tag on `main` plus a GitHub release and two Docker images on `ghcr.io`. Done once per sprint, by maintainers only (the `maintainers` team or the Admin; the workflow refuses everyone else).

| Version  | When                                |
| -------- | ----------------------------------- |
| `v0.1.0` | Sprint 1 review (before the demo)   |
| `v0.2.0` | Sprint 2 review                     |
| `v0.3.0` | Sprint 3 review                     |
| `v1.0.0` | Final submission                    |
| `v0.x.1` | Hotfix between sprints (patch bump) |

**How:** repo, Actions, **Release**, Run workflow, type the version. (Or `/release v0.1.0` in Claude Code, or push the tag by hand: `git tag -a v0.1.0 -m v0.1.0 && git push origin v0.1.0`.) The workflow checks the version format and that it is new, that you are a maintainer, that the tag is on `main`, and that `main` is green. Then it publishes the images and the release (`0.x` as pre-release). Release notes are generated from merged PR titles.

**If something goes wrong:** never delete or move a tag or release and never reuse a version; publish the next patch (`v0.1.1`). If the workflow failed before creating the tag, fix the cause and run it again.

## 7. Project layout

| Folder      | Purpose                                                           |
| ----------- | ----------------------------------------------------------------- |
| `backend/`  | Node.js + Express + MongoDB API and tests                         |
| `frontend/` | React + TypeScript app and tests                                  |
| `docs/`     | `SCOPE.md`, `PBS.md`, API docs, wireframes, business model, tests |

## 8. Maintainer setup (once, in GitHub settings)

- Settings, Rules, Rulesets: import `.github/rulesets/main-protection.json`, `main-integrity.json` and `tag-protection.json`. Enable the Copilot code review rule there.
- Settings, General, Pull Requests: allow squash (the default choice), merge commit and rebase, default message "Pull request title", auto-delete head branches.
- Settings, Collaborators: roles decide who can do what on `main`. Rulesets treat people by role, so keep each role to the people who need it.

  | GitHub role  | Who                | Push to `main` / merge without review | Force-push or delete `main`, change rules and access |
  | ------------ | ------------------ | ------------------------------------- | ---------------------------------------------------- |
  | **Admin**    | Jan only           | Yes                                   | Yes                                                  |
  | **Maintain** | `maintainers` team | Yes (`Protect main` bypass)           | No (`main-integrity` is Admin-only)                  |
  | **Write**    | `developers` team  | No: PR, one approval, green CI        | No                                                   |

  To make someone a maintainer, move them from the `developers` to the `maintainers` team (organisation → Teams). Members can then approve and merge normal PRs and publish releases. They cannot approve the protected files in `.github/CODEOWNERS` (CI, Docker, AI rules): those need the project lead.

- Secrets: never commit `.env`, keys or credentials. Bugs: use the bug report issue template and link the requirement or user story.
