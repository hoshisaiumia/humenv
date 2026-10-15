#!/usr/bin/env node
import * as p from "@clack/prompts";
import { createInterface, type Interface } from "node:readline/promises";
import { parseArgs } from "node:util";
import {
  VAR_NAME,
  createEnvFiles,
  gitignoreRule,
  listEnvNames,
  parseKeys,
  parseList,
  readEnvKeys,
  removeKeys,
  renameKey,
  updateGitignore,
  type FileResult,
} from "./lib.js";

const HELP = `Usage: humenv [options]

Options:
  -d, --dir <path>   Directory for the env files (default: env)
  -a, --avoid        Don't ask for variable names (files are created empty)
  -e, --edit         Edit existing envs (add, remove or rename variables)
  -h, --help         Show this help`;

function readArgs() {
  try {
    return parseArgs({
      options: {
        dir: { type: "string", short: "d" },
        avoid: { type: "boolean", short: "a" },
        edit: { type: "boolean", short: "e" },
        help: { type: "boolean", short: "h" },
      },
      strict: true,
    }).values;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(`\n${HELP}`);
    process.exit(1);
  }
}

function formatResults(results: FileResult[]): string {
  return results.map((r) => `${r.status}: ${r.path}`).join("\n");
}

function validateKeys(value: string | undefined): string | undefined {
  const keys = parseKeys(value ?? "");
  if (keys.length === 0) return "Enter at least one variable.";
  const invalid = keys.filter((k) => !VAR_NAME.test(k));
  if (invalid.length > 0)
    return `Invalid names: ${invalid.join(", ")}. Use letters, numbers and _.`;
  return undefined;
}

async function askNames(rl: Interface): Promise<string[]> {
  const answer = await rl.question(
    "Envs to be created (separate with comma): ",
  );
  return parseList(answer).map((n) => n.toLowerCase());
}

async function askVariables(rl: Interface, name: string): Promise<string[]> {
  while (true) {
    const answer = await rl.question(
      `Variables for ${name} (separate with comma): `,
    );
    const error = validateKeys(answer);
    if (!error) return parseKeys(answer);
    console.error(error);
  }
}

async function createMode(dir: string, avoid: boolean): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const names = await askNames(rl);
    if (names.length === 0) {
      console.error("No names provided.");
      process.exitCode = 1;
      return;
    }

    for (const name of names) {
      const keys = avoid ? [] : await askVariables(rl, name);
      console.log(formatResults(await createEnvFiles(dir, name, keys)));
    }

    const rule = gitignoreRule(dir);
    if (rule) await updateGitignore(".gitignore", rule);
    else
      console.warn(
        "Directory is outside the current folder; .gitignore was not updated.",
      );
  } finally {
    rl.close();
  }
}

async function editMode(dir: string): Promise<void> {
  if (!process.stdin.isTTY) {
    console.error("--edit needs an interactive terminal.");
    process.exitCode = 1;
    return;
  }

  const names = await listEnvNames(dir);
  if (names.length === 0) {
    console.error(`No env files found in ${dir}.`);
    process.exitCode = 1;
    return;
  }

  p.intro("humenv");

  const name = await p.select({
    message: "Which env do you want to edit?",
    options: names.map((n) => ({ value: n, label: n })),
  });
  if (p.isCancel(name)) return void p.cancel("Cancelled.");

  const action = await p.select({
    message: `What do you want to do with "${name}"?`,
    options: [
      { value: "add" as const, label: "Add variables" },
      { value: "remove" as const, label: "Remove variables" },
      { value: "rename" as const, label: "Rename a variable" },
    ],
  });
  if (p.isCancel(action)) return void p.cancel("Cancelled.");

  const current = await readEnvKeys(dir, name);

  if (action === "add") {
    const input = await p.text({
      message: "Variables to add (separate with comma)",
      validate: validateKeys,
    });
    if (p.isCancel(input)) return void p.cancel("Cancelled.");

    p.log.success(
      formatResults(await createEnvFiles(dir, name, parseKeys(input))),
    );
  }

  if (action === "remove") {
    if (current.length === 0)
      return void p.outro(`"${name}" has no variables.`);

    const selected = await p.multiselect({
      message:
        "Select the variables to remove (space to select, enter to confirm)",
      options: current.map((k) => ({ value: k, label: k })),
      required: true,
    });
    if (p.isCancel(selected)) return void p.cancel("Cancelled.");

    const confirmed = await p.confirm({
      message: `Remove ${selected.join(", ")} from all "${name}" files? Their values will be lost.`,
      initialValue: false,
    });
    if (p.isCancel(confirmed) || !confirmed)
      return void p.cancel("Nothing changed.");

    p.log.success(formatResults(await removeKeys(dir, name, selected)));
  }

  if (action === "rename") {
    if (current.length === 0)
      return void p.outro(`"${name}" has no variables.`);

    const from = await p.select({
      message: "Which variable do you want to rename?",
      options: current.map((k) => ({ value: k, label: k })),
    });
    if (p.isCancel(from)) return void p.cancel("Cancelled.");

    const to = await p.text({
      message: `New name for ${from}`,
      validate: (value) => {
        const key = (value ?? "").trim().toUpperCase();
        if (!VAR_NAME.test(key))
          return "Use letters, numbers and _ (cannot start with a number).";
        if (current.includes(key)) return `${key} already exists.`;
        return undefined;
      },
    });
    if (p.isCancel(to)) return void p.cancel("Cancelled.");

    p.log.success(
      formatResults(await renameKey(dir, name, from, to.trim().toUpperCase())),
    );
  }

  p.outro("Done.");
}

async function main(): Promise<void> {
  const args = readArgs();
  if (args.help) {
    console.log(HELP);
    return;
  }

  const dir = args.dir ?? "env";
  if (args.edit) await editMode(dir);
  else await createMode(dir, args.avoid ?? false);
}

await main();
