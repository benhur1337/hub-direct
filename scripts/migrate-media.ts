import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { database } from "../lib/db";
import { copyVerifiedFile } from "../lib/r2";
import { media, projects } from "../lib/schema";

async function main() {
  loadEnvConfig(process.cwd());
  const db = database();
  const rows = await db
    .select({ id: media.id, projectId: media.projectId })
    .from(media);
  for (const { id, projectId } of rows) {
    const [row] = await db
      .select({ data: media.data, assets: projects.assets })
      .from(media)
      .innerJoin(projects, eq(projects.id, media.projectId))
      .where(eq(media.id, id));
    const asset = row?.assets.find((item) => item.id === id);
    if (!asset) throw new Error(`Missing metadata for attachment ${id}.`);
    await copyVerifiedFile(projectId, asset, row.data);
  }
  console.log(`Verified ${rows.length} legacy attachments in R2.`);
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Media migration failed.",
  );
  process.exitCode = 1;
});
