/// <reference types="node" />
// Guards the design system (docs/design-system.md): colours live only in
// tokens.css, and every var(--token) in the shared styles exists.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(import.meta.dirname, "..");

// Files written before the design system. Remove a file from this list when
// you move it onto the tokens; never add new files here.
const LEGACY: string[] = [];
const TOKENS = "styles/tokens.css";

const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(css|tsx?)$/.test(entry.name) && !/\.test\./.test(entry.name)
      ? [relative(SRC, path).split("\\").join("/")]
      : [];
  });
}

const read = (file: string) => readFileSync(join(SRC, file), "utf8");
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("design tokens", () => {
  it("finds the stylesheets", () => {
    const files = sourceFiles(SRC);
    expect(files).toContain(TOKENS);
    expect(files).toContain("styles/components.css");
  });

  it("keeps raw colours out of everything but tokens.css", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => file !== TOKENS && !LEGACY.includes(file))
      .flatMap((file) =>
        read(file)
          .split("\n")
          .map((line, i) => ({ line, n: i + 1 }))
          .filter(({ line }) => RAW_COLOUR.test(line))
          .map(({ n, line }) => `${file}:${n}  ${line.trim()}`),
      );
    expect(offenders).toEqual([]);
  });

  it("only uses tokens that tokens.css defines", () => {
    const defined = new Set(
      [...read(TOKENS).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]),
    );
    const used = [
      ...stripComments(read("styles/components.css")).matchAll(
        /var\((--[\w-]+)/g,
      ),
    ].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    const missing = [...new Set(used)].filter((name) => !defined.has(name));
    expect(missing).toEqual([]);
  });
});
