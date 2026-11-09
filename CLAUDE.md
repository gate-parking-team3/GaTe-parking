# GaŤe Parking: rules for Claude Code

All team rules live in `AGENTS.md`, shared with every other AI agent. Follow them exactly:

@AGENTS.md

## Slash commands

Use these instead of running the git steps by hand:

| Command                           | Use                                                        |
| --------------------------------- | ---------------------------------------------------------- |
| `/start-task <name>`              | Sync with `main` and create a correctly named branch       |
| `/sync`                           | Bring the latest `main` into your branch                   |
| `/save <message>`                 | Commit your work on your branch (never on `main`)          |
| `/ship`                           | Push your branch and open a pull request                   |
| `/release <version>`              | Maintainers only: tag a release from `main`                |
| `/implement-task <PBS task name>` | Do a whole PBS task: branch, code, tests, docs, checks, PR |
