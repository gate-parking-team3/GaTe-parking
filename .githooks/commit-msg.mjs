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
    "The commit was NOT made. Your changes are safe and still staged.",
    "The message must be one line in the team format:",
    "",
    "  <type>(<optional scope>): <lower-case description>",
    "",
    "  feat(vehicles): add plate validation",
    "  fix(auth): reject expired tokens",
    "  docs: update the setup guide",
    "",
    "Types: feat, fix, docs, test, chore, refactor, style, ci.",
    "Start with a lower-case word, no full stop, 72 characters max.",
    'Try again, e.g.: git commit -m "fix(auth): reject expired tokens"',
  ].join("\n"),
);
process.exit(1);
