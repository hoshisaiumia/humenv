import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildContent,
  createEnvFiles,
  existingKeys,
  gitignoreRule,
  parseList,
  updateGitignore,
} from "../src/lib.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "envgen-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("parseList", () => {
  it("trims spaces and removes empty and duplicate items", () => {
    expect(parseList(" web, database ,, web ")).toEqual(["web", "database"]);
  });
});

describe("buildContent", () => {
  it("generates one line per variable", () => {
    expect(buildContent(["A", "B"], "x")).toBe("A=x\nB=x\n");
  });

  it("returns an empty string when there are no variables", () => {
    expect(buildContent([], "x")).toBe("");
  });
});

describe("existingKeys", () => {
  it("finds variables and ignores comments", () => {
    const content = "PORT=3000\nexport API_URL=x\n# DEBUG=1\n";
    expect([...existingKeys(content)]).toEqual(["PORT", "API_URL"]);
  });
});

describe("createEnvFiles", () => {
  it("creates the 3 files with the right values", async () => {
    await createEnvFiles(dir, "web", ["PORT"]);
    expect(await readFile(join(dir, "web.env"), "utf8")).toBe("PORT=\n");
    expect(await readFile(join(dir, "web.local.env"), "utf8")).toBe("PORT=\n");
    expect(await readFile(join(dir, "web.env.example"), "utf8")).toBe(
      "PORT=change_this_to_your_variable\n",
    );
  });

  it("appends only the missing variables and keeps existing values", async () => {
    await writeFile(join(dir, "web.env"), "PORT=3000");
    await createEnvFiles(dir, "web", ["PORT", "API_URL"]);
    expect(await readFile(join(dir, "web.env"), "utf8")).toBe(
      "PORT=3000\nAPI_URL=\n",
    );
  });

  it("is idempotent", async () => {
    await createEnvFiles(dir, "web", ["PORT"]);
    const results = await createEnvFiles(dir, "web", ["PORT"]);
    expect(results.every((r) => r.status === "unchanged")).toBe(true);
  });

  it("creates empty files when there are no variables", async () => {
    const results = await createEnvFiles(dir, "web", []);
    expect(results.every((r) => r.status === "created")).toBe(true);
    expect(await readFile(join(dir, "web.env"), "utf8")).toBe("");
  });
});

describe("gitignoreRule", () => {
  it("builds the rule according to the directory", () => {
    expect(gitignoreRule(".", "/proj")).toBe("*.env");
    expect(gitignoreRule("env", "/proj")).toBe("env/*.env");
    expect(gitignoreRule("a/b", "/proj")).toBe("a/b/*.env");
  });

  it("returns null for a directory outside the project", () => {
    expect(gitignoreRule("../outside", "/proj")).toBeNull();
  });
});

describe("updateGitignore", () => {
  it("creates the file and does not duplicate the rule", async () => {
    const path = join(dir, ".gitignore");
    await updateGitignore(path, "env/*.env");
    await updateGitignore(path, "env/*.env");
    expect(await readFile(path, "utf8")).toBe("env/*.env\n");
  });

  it("appends without gluing onto the last line", async () => {
    const path = join(dir, ".gitignore");
    await writeFile(path, "node_modules");
    await updateGitignore(path, "env/*.env");
    expect(await readFile(path, "utf8")).toBe("node_modules\nenv/*.env\n");
  });
});
