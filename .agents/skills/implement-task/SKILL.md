---
name: implement-task
description: Implement one PBS task end to end (branch, code, tests, docs, checks, commit, pull request) following the team rules. Use when a teammate asks to implement a PBS task by its name, e.g. "Implement administrator employee and access-management endpoints".
---

# Implement a PBS task

The user gives the name of one PBS task, for example `Implement administrator employee and access-management endpoints`. Take it from an empty idea to an open pull request. The user may not know git: they should only have to answer the few questions below. Every rule in `AGENTS.md` applies; read it first if it is not already loaded.

Talk to the user in plain language. Before each step say in one sentence what you are about to do, and afterwards what happened. If anything goes wrong, first say whether their work is safe (committed or not) and then propose the fix.

## 1. Understand the task

1. If no task name was given, ask for it (the exact text from the PBS spreadsheet) and stop until you have it.
2. Read `docs/PBS.md`, `docs/SCOPE.md`, the user stories in `README.md` and the related docs in `docs/api/`. Find which PBS area and user story (US 1-11) the task belongs to.
3. Check the scope. If `docs/SCOPE.md` marks the area as stretch or simulated (gate hardware, live charger status and tariffs, analytics), tell the user and ask whether the team agreed to build it now. Stop if they are not sure.
4. Check that nobody has done it already:
   - search the code on `main` for the feature (routes, models, pages, tests);
   - `gh pr list --state all --search "<keywords>"` and `git branch -r` for an open or merged PR or a branch for the same work.

   If it is already done, show the user where (files, tests, docs, PR) and stop. If someone else has an open PR or branch for it, stop and tell the user to talk to that person.

5. Check ownership in the "Sprint 1 ownership" table of `docs/PBS.md` (the spreadsheet is the source of truth for later sprints). If the task is assigned to someone other than the user, ask them to confirm they are taking it over.

## 2. Plan and confirm (the only approval step)

Show the user a short plan:

- what will be built, in 2-4 bullets, tied to the user story's scenarios;
- the files to create or change;
- the tests and docs to add;
- the branch name and the PR title (rules in step 3 and 7).

Stop and ask the user to confirm. Do not start before they say yes.

If the task needs a change outside its own area, stop and tell the user to agree it with the owner or the team first: a shared contract (an existing API shape, the DB schema or a data model someone else owns), another person's files, a new dependency or framework, or anything under the files `.github/CODEOWNERS` lists (CI, Docker, ESLint, root `package.json`, `.claude/`, `.agents/`, `AGENTS.md`, `CLAUDE.md`). New models and endpoints that only this task uses are fine.

## 3. Start a branch

1. `git status`. If there are uncommitted changes, stop: explain them and offer to commit them on their current branch first. Never discard anything.
2. `git fetch origin`, `git switch main`, `git pull --ff-only origin main`.
3. `git switch -c <type>/<short-description>`: type `feat` for new behaviour, `fix`, `docs`, `test` or `chore` otherwise; lowercase words joined by hyphens, e.g. `feat/admin-employee-endpoints`. If the branch already exists, ask whether to continue on it instead.

## 4. Implement

Match the existing code. Look at a similar finished feature before writing anything:

- Backend (`backend/src/<feature>/`): Express routers created by a function, Mongoose models guarded with `mongoose.models.X ??`, input validation in its own file, an in-memory store or repository so tests run without MongoDB, errors as `{ "error": "<message>" }`. Examples: `backend/src/vehicles/`, `backend/src/admin/`, `backend/src/auth/`.
- Protect endpoints with `requireAuth` and, for admin-only ones, `requireRole("admin")` from `backend/src/auth/middleware.ts`. Users may only see and change their own data; admins may change anyone's (see `AGENTS.md`).
- Mount new routers in `backend/src/app.ts` next to the existing ones, without changing the others. Keep `/api/health` working.
- Frontend (`frontend/src/`): pages in `pages/`, shared pieces in `components/`, API calls through the client in `api/`. Handle loading and error states.
- Tests next to the code (`*.test.ts` / `*.test.tsx`, Vitest; `supertest` against `createApp` for endpoints, see `backend/src/admin/employees.test.ts`). Cover the happy path, validation errors, 401 when signed out, 403 for the wrong role or someone else's data, and 404.
- Docs: add or update the endpoint description in `docs/api/` (same format as `docs/api/auth.md`), and `README.md` or `.env.example` if setup changes. New environment variables go only in `.env.example`, never real values.

Keep the change to this one task and under ~1000 changed lines of code (tests, docs and `package-lock.json` do not count). If it grows past that, stop, tell the user and propose splitting it into several PRs. Do not reformat or rename unrelated code, and leave no debug output, commented-out code or stray files.

## 5. Check

Run `npm run check` (format, lint, types, tests, build). It must pass. If formatting fails, run `npm run format` and check again. If anything else fails, fix the cause. Never weaken a check: no skipped or deleted tests, no `eslint-disable`, `@ts-ignore` or `any` casts to silence errors, no lowered thresholds, no edits to CI or config files.

If you cannot make it pass, stop, explain the failure in plain language and leave the work uncommitted for the user.

## 6. Commit

1. `git status` and `git diff`. Stage only the files of this task, by name. Never stage `.env` files, secrets, `node_modules`, `dist`, coverage or unrelated files.
2. Commit with one line and nothing else: `<type>(<scope>): <description>`. The description starts with a lower-case imperative verb, has no full stop, and the whole line is at most 72 characters, e.g. `feat(admin): add employee access management endpoints`. No body, no `Co-Authored-By` or any other AI attribution.
3. Several small commits are fine; each follows the same format.

## 7. Open the pull request

1. `git fetch origin` and `git merge origin/main`. If there are conflicts, show the user each conflicted file and resolve it together with them, keeping both their work and their teammates' work. Run `npm run check` again after the merge.
2. `git push -u origin <branch>`. Never force-push and never push to `main`. If the push is rejected, explain why and stop.
3. `gh pr create --base main` with:
   - title: the same single-line Conventional Commit format (the squash merge uses it as the commit on `main`);
   - body: `.github/pull_request_template.md` filled in: What, Why (the exact PBS task name and the user story, e.g. "PBS: Implement administrator employee and access-management endpoints, US 5"), How to test (concrete steps or requests) and the checklist with only the items that are really done ticked. No AI attribution or session links.

   If `gh` is missing or not logged in, give the user the GitHub link to open the PR in the browser and the title and body to paste.

4. Wait for the checks (`gh pr checks <number> --watch`). If one fails, fix the cause on the same branch, commit, push and check again.

## 8. Hand over

Tell the user in a few plain sentences:

- what was built and where (main files, endpoints or pages);
- the tests and docs that were added;
- the PR link, and whether the checks are green;
- that a teammate must review it before it is merged. Never approve or merge it yourself.
