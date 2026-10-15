import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export const DEFAULT_VALUE = "change_this_to_your_variable";
export const VAR_NAME = /^[A-Z_][A-Z0-9_]*$/;

const KEY_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;

export type FileStatus = "created" | "updated" | "unchanged";
export type FileResult = { path: string; status: FileStatus };

export function parseList(input: string): string[] {
  return [
    ...new Set(
      input
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

export function buildContent(keys: string[], value: string): string {
  return keys.length === 0
    ? ""
    : keys.map((k) => `${k}=${value}`).join("\n") + "\n";
}

export function existingKeys(content: string): Set<string> {
  const keys = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const match = KEY_LINE.exec(line);
    if (match?.[1]) keys.add(match[1]);
  }
  return keys;
}

export async function syncEnvFile(
  path: string,
  keys: string[],
  value: string,
): Promise<FileStatus> {
  if (!existsSync(path)) {
    await writeFile(path, buildContent(keys, value));
    return "created";
  }

  const content = await readFile(path, "utf8");
  const present = existingKeys(content);
  const missing = keys.filter((k) => !present.has(k));
  if (missing.length === 0) return "unchanged";

  const prefix = content && !content.endsWith("\n") ? "\n" : "";
  await appendFile(path, prefix + buildContent(missing, value));
  return "updated";
}

export async function createEnvFiles(
  dir: string,
  name: string,
  keys: string[],
): Promise<FileResult[]> {
  await mkdir(dir, { recursive: true });

  const files: [string, string][] = [
    [`${name}.local.env`, ""],
    [`${name}.env`, ""],
    [`${name}.env.example`, DEFAULT_VALUE],
  ];

  const results: FileResult[] = [];
  for (const [file, value] of files) {
    const path = join(dir, file);
    results.push({ path, status: await syncEnvFile(path, keys, value) });
  }
  return results;
}

export function gitignoreRule(
  dir: string,
  cwd: string = process.cwd(),
): string | null {
  const rel = relative(cwd, resolve(cwd, dir));
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel))
    return null;
  const posix = rel.split(sep).join("/");
  return posix ? `${posix}/*.env` : "*.env";
}

export async function updateGitignore(
  gitignorePath: string,
  rule: string,
): Promise<void> {
  const current = existsSync(gitignorePath)
    ? await readFile(gitignorePath, "utf8")
    : "";
  if (current.split(/\r?\n/).includes(rule)) return;
  const prefix = current && !current.endsWith("\n") ? "\n" : "";
  await appendFile(gitignorePath, `${prefix}${rule}\n`);
}
