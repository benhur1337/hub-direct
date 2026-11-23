CREATE TABLE "connections" (
	"project_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"account_id" text NOT NULL,
	"token" text NOT NULL,
	CONSTRAINT "connections_project_id_platform_pk" PRIMARY KEY("project_id","platform")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "linked" jsonb;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;