import console from "node:console";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const prettier = "node_modules/prettier/bin/prettier.cjs";
if (!existsSync(prettier)) {
  console.log("pre-commit: run `npm install` first. Skipping auto-formatting.");
  process.exit(0);
}

const gitFiles = (args) =>
  execFileSync("git", args, { encoding: "utf8" }).split("\0").filter(Boolean);
const runPrettier = (mode, files) =>
  spawnSync(
    process.execPath,
    [prettier, mode, "--ignore-unknown", "--log-level", "warn", "--", ...files],
    { stdio: "inherit" },
  ).status;

const staged = gitFiles([
  "diff",
  "--cached",
  "--name-only",
  "-z",
  "--diff-filter=ACMR",
]);
const notStaged = new Set(gitFiles(["diff", "--name-only", "-z"]));

// Files staged as a whole are formatted and staged again, so the commit contains the formatted version.
const whole = staged.filter((file) => !notStaged.has(file));
if (whole.length > 0) {
  if (runPrettier("--write", whole) !== 0) process.exit(1);
  execFileSync("git", ["add", "--", ...whole]);
}

// Files with only some changes staged are checked, not rewritten, so unstaged work is never committed by accident.
const partial = staged.filter((file) => notStaged.has(file));
if (partial.length > 0 && runPrettier("--check", partial) !== 0) {
  console.error(
    [
      "",
      "The commit was NOT made. Your changes are safe.",
      "The files listed above are not formatted, and only part of them is staged,",
      "so they could not be fixed automatically. Run `npm run format`,",
      "then `git add` those files and commit again.",
    ].join("\n"),
  );
  process.exit(1);
}
