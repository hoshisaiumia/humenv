#!/usr/bin/env node
import { createInterface, type Interface } from "node:readline/promises";
import { parseArgs } from "node:util";
import {
  VAR_NAME,
  createEnvFiles,
  gitignoreRule,
  parseList,
  updateGitignore,
} from "./lib.js";

const HELP = `Usage: envgen [options]

Options:
  -d, --dir <path>   Directory for the env files (default: env)
  -a, --avoid        Don't ask for variable names (files are created empty)
  -h, --help         Show this help`;

function readArgs() {
  try {
    return parseArgs({
      options: {
        dir: { type: "string", short: "d" },
        avoid: { type: "boolean", short: "a" },
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
    const keys = parseList(answer).map((k) => k.toUpperCase());
    const invalid = keys.filter((k) => !VAR_NAME.test(k));
    if (invalid.length === 0) return keys;
    console.error(
      `Invalid variable names: ${invalid.join(", ")}. Use letters, numbers and _.`,
    );
  }
}

async function main(): Promise<void> {
  const args = readArgs();
  if (args.help) {
    console.log(HELP);
    return;
  }

  const dir = args.dir ?? "env";
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const names = await askNames(rl);
    if (names.length === 0) {
      console.error("No names provided.");
      process.exitCode = 1;
      return;
    }

    for (const name of names) {
      const keys = args.avoid ? [] : await askVariables(rl, name);
      const results = await createEnvFiles(dir, name, keys);
      for (const r of results) console.log(`${r.status}: ${r.path}`);
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

await main();
