import { customType, jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import type { Platform, Project } from "./model";

export const users = pgTable("users", {
  id: uuid().primaryKey(),
  email: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
});

export const projects = pgTable("projects", {
  id: uuid().primaryKey(),
  // Null only for projects created before accounts; the first signup claims them.
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text().notNull(),
  voice: text().notNull(),
  brand: jsonb().$type<NonNullable<Project["brand"]>>(),
  channels: jsonb().$type<Project["channels"]>().notNull(),
  linked: jsonb().$type<NonNullable<Project["linked"]>>(),
  assets: jsonb().$type<Project["assets"]>().notNull(),
  posts: jsonb().$type<Project["posts"]>().notNull(),
});

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
export const media = pgTable("media", {
  id: uuid().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  data: bytea().notNull(),
});

// Kept out of projects because whole project rows are sent to the browser.
export const connections = pgTable(
  "connections",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    platform: text().$type<Platform>().notNull(),
    accountId: text("account_id").notNull(),
    /** AES-GCM sealed with TOKEN_KEY. */
    token: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.platform] })],
);
