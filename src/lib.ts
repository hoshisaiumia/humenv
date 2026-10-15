import { existsSync } from "node:fs";
import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export const DEFAULT_VALUE = "change_this_to_your_variable";
export const VAR_NAME = /^[A-Z_][A-Z0-9_]*$/;

const KEY_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;
const SAFE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ENV_FILE_NAME = /^(.+?)(?:\.local\.env|\.env\.example|\.env)$/;

const ENV_FILES = [
  { suffix: ".local.env", value: "" },
  { suffix: ".env", value: "" },
  { suffix: ".env.example", value: DEFAULT_VALUE },
] as const;

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

export function parseKeys(input: string): string[] {
  return [...new Set(parseList(input).map((k) => k.toUpperCase()))];
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

  const results: FileResult[] = [];
  for (const { suffix, value } of ENV_FILES) {
    const path = join(dir, `${name}${suffix}`);
    results.push({ path, status: await syncEnvFile(path, keys, value) });
  }
  return results;
}

/** Lists the env names found in a directory (web.env, web.local.env and web.env.example -> "web"). */
export async function listEnvNames(dir: string): Promise<string[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const names = new Set<string>();
  for (const file of files) {
    const match = ENV_FILE_NAME.exec(file);
    if (match?.[1]) names.add(match[1]);
  }
  return [...names].sort();
}

/** Variables of an env across its files, without duplicates (the .example file comes first). */
export async function readEnvKeys(
  dir: string,
  name: string,
): Promise<string[]> {
  const keys = new Set<string>();
  for (const { suffix } of [...ENV_FILES].reverse()) {
    const path = join(dir, `${name}${suffix}`);
    if (!existsSync(path)) continue;
    for (const key of existingKeys(await readFile(path, "utf8"))) keys.add(key);
  }
  return [...keys];
}

/** Removes the given variables from every existing file of an env. Other lines are kept. */
export async function removeKeys(
  dir: string,
  name: string,
  keys: string[],
): Promise<FileResult[]> {
  const toRemove = new Set(keys);
  const results: FileResult[] = [];

  for (const { suffix } of ENV_FILES) {
    const path = join(dir, `${name}${suffix}`);
    if (!existsSync(path)) continue;

    const content = await readFile(path, "utf8");
    const next = content
      .split("\n")
      .filter((line) => {
        const key = KEY_LINE.exec(line)?.[1];
        return !key || !toRemove.has(key);
      })
      .join("\n");

    if (next === content) {
      results.push({ path, status: "unchanged" });
    } else {
      await writeFile(path, next);
      results.push({ path, status: "updated" });
    }
  }
  return results;
}

/** Renames a variable in every existing file of an env, keeping its value. */
export async function renameKey(
  dir: string,
  name: string,
  from: string,
  to: string,
): Promise<FileResult[]> {
  if (!SAFE_KEY.test(from) || !SAFE_KEY.test(to)) {
    throw new Error("Invalid variable name.");
  }

  const pattern = new RegExp(`^(\\s*(?:export\\s+)?)${from}(\\s*=)`);
  const pending: { path: string; content: string; next: string }[] = [];

  // First pass: read everything and check for conflicts before writing anything.
  for (const { suffix } of ENV_FILES) {
    const path = join(dir, `${name}${suffix}`);
    if (!existsSync(path)) continue;

    const content = await readFile(path, "utf8");
    if (existingKeys(content).has(to)) {
      throw new Error(`${to} already exists in ${path}.`);
    }
    const next = content
      .split("\n")
      .map((line) => line.replace(pattern, `$1${to}$2`))
      .join("\n");
    pending.push({ path, content, next });
  }

  const results: FileResult[] = [];
  for (const { path, content, next } of pending) {
    if (next === content) {
      results.push({ path, status: "unchanged" });
    } else {
      await writeFile(path, next);
      results.push({ path, status: "updated" });
    }
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
