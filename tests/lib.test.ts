import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildContent,
  createEnvFiles,
  existingKeys,
  gitignoreRule,
  listEnvNames,
  parseKeys,
  parseList,
  readEnvKeys,
  removeKeys,
  renameKey,
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

describe("parseKeys", () => {
  it("uppercases names and removes duplicates", () => {
    expect(parseKeys("port, Port, api_url")).toEqual(["PORT", "API_URL"]);
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

describe("listEnvNames", () => {
  it("groups the three files of each env under one name", async () => {
    await createEnvFiles(dir, "web", []);
    await createEnvFiles(dir, "database", []);
    await writeFile(join(dir, "notes.txt"), "");
    await writeFile(join(dir, ".env"), "");
    expect(await listEnvNames(dir)).toEqual(["database", "web"]);
  });

  it("returns an empty list when the directory does not exist", async () => {
    expect(await listEnvNames(join(dir, "missing"))).toEqual([]);
  });
});

describe("readEnvKeys", () => {
  it("merges the variables of all files without duplicates", async () => {
    await createEnvFiles(dir, "web", ["PORT"]);
    await writeFile(join(dir, "web.env"), "PORT=3000\nSECRET=abc\n");
    expect(await readEnvKeys(dir, "web")).toEqual(["PORT", "SECRET"]);
  });
});

describe("removeKeys", () => {
  it("removes the variables from every file and keeps the rest", async () => {
    await createEnvFiles(dir, "web", ["PORT", "API_URL"]);
    await writeFile(join(dir, "web.env"), "# comment\nPORT=3000\nAPI_URL=x\n");
    const results = await removeKeys(dir, "web", ["API_URL"]);
    expect(results.every((r) => r.status === "updated")).toBe(true);
    expect(await readFile(join(dir, "web.env"), "utf8")).toBe(
      "# comment\nPORT=3000\n",
    );
    expect(await readFile(join(dir, "web.env.example"), "utf8")).toBe(
      "PORT=change_this_to_your_variable\n",
    );
  });

  it("reports unchanged files and skips missing ones", async () => {
    await writeFile(join(dir, "web.env"), "PORT=3000\n");
    const results = await removeKeys(dir, "web", ["OTHER"]);
    expect(results).toEqual([
      { path: join(dir, "web.env"), status: "unchanged" },
    ]);
  });
});

describe("renameKey", () => {
  it("renames the variable in every file and keeps its value", async () => {
    await createEnvFiles(dir, "web", ["PORT"]);
    await writeFile(join(dir, "web.env"), "export PORT=3000\nOTHER_PORT=1\n");
    await renameKey(dir, "web", "PORT", "HTTP_PORT");
    expect(await readFile(join(dir, "web.env"), "utf8")).toBe(
      "export HTTP_PORT=3000\nOTHER_PORT=1\n",
    );
    expect(await readFile(join(dir, "web.env.example"), "utf8")).toBe(
      "HTTP_PORT=change_this_to_your_variable\n",
    );
  });

  it("refuses to rename onto a variable that already exists and writes nothing", async () => {
    await createEnvFiles(dir, "web", ["PORT"]);
    await writeFile(join(dir, "web.env"), "PORT=3000\nHTTP_PORT=1\n");
    await expect(renameKey(dir, "web", "PORT", "HTTP_PORT")).rejects.toThrow(
      "already exists",
    );
    expect(await readFile(join(dir, "web.env.example"), "utf8")).toBe(
      "PORT=change_this_to_your_variable\n",
    );
  });

  it("rejects invalid names", async () => {
    await expect(renameKey(dir, "web", "PORT", "my-var")).rejects.toThrow(
      "Invalid",
    );
  });
});
