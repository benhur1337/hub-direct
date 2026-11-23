import { loadEnvConfig } from "@next/env";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import { database } from "../lib/db";
import type { Project } from "../lib/model";
import { projects } from "../lib/schema";
import { copyVerifiedFile } from "../lib/r2";

async function main() {
  loadEnvConfig(process.cwd());
  const root = process.env.HUB_DATA_DIR || join(process.cwd(), ".hub-data");
  const uuid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  const db = database();
  let imported = 0;
  let skipped = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !uuid.test(entry.name)) continue;
    const folder = join(root, entry.name);
    const project: Project = JSON.parse(
      await readFile(join(folder, "project.json"), "utf8"),
    );
    assert.equal(project.id, entry.name);
    assert(
      typeof project.name === "string" &&
        Array.isArray(project.channels) &&
        Array.isArray(project.posts) &&
        Array.isArray(project.assets),
      "Invalid project metadata",
    );
    project.voice = await readFile(join(folder, "brand-voice.md"), "utf8");
    const inserted = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(projects)
        .values(project)
        .onConflictDoNothing()
        .returning({ id: projects.id });
      if (!rows.length) return false;
      for (const asset of project.assets) {
        assert(
          typeof asset.id === "string" && uuid.test(asset.id),
          "Invalid media ID",
        );
        const data = await readFile(join(folder, "media", asset.id));
        await copyVerifiedFile(project.id, asset, data);
      }
      return true;
    });
    if (inserted) imported++;
    else skipped++;
  }
  console.log(
    `Imported ${imported} projects. Skipped ${skipped} existing projects.`,
  );
}

main().catch((error: unknown) => {
  // Drizzle errors can include the query parameters and uploaded media.
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? error.cause
      : error;
  console.error(
    "Import failed.",
    cause instanceof Error ? cause.message : "Unknown error",
  );
  process.exitCode = 1;
});
