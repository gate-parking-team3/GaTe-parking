import console from "node:console";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const commitlint = "node_modules/@commitlint/cli/cli.js";
if (!existsSync(commitlint)) {
  console.log(
    "commit-msg: run `npm install` first. Skipping the message check.",
  );
  process.exit(0);
}

const messageFile = process.argv[2];
const { status } = spawnSync(
  process.execPath,
  [commitlint, "--edit", messageFile],
  {
    stdio: "inherit",
  },
);
if (status === 0) process.exit(0);

console.error(
  [
    "",
    "Warning: this commit message does not follow the team format.",
    "The commit was made anyway, so nothing is lost. Next time, use one line:",
    "",
    "  <type>(<optional scope>): <lower-case description>",
    "",
    "  feat(vehicles): add plate validation",
    "  fix(auth): reject expired tokens",
    "  docs: update the setup guide",
    "",
    "Types: feat, fix, docs, test, chore, refactor, style, ci.",
    "Start with a lower-case word, no full stop, 72 characters max.",
    "Your PR title must follow this format too: it becomes the commit on main.",
  ].join("\n"),
);
// Warn only: branch commits are squashed away, the PR title is what reaches main.
process.exit(0);
