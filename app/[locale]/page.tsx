import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { workspace } from "@/lib/store";
import { sessionCookie, sessionUser } from "@/lib/auth";
import { Desk } from "../workspace";
import { Brand, Spinner } from "../ui";

async function LocalWorkspace({ searchParams }: { searchParams: PageProps<"/[locale]">["searchParams"] }) {
  const { project, meta, view } = await searchParams;
  const token = (await cookies()).get(sessionCookie)?.value;
  if (token) await connection(); // session expiry reads the clock
  const user = sessionUser(token);
  return (
    <Desk
      signedIn={!!user}
      initialProjects={user ? await workspace(user) : []}
      metaReturn={
        typeof project === "string" && typeof meta === "string" ? { project, result: meta } : undefined
      }
      reopen={typeof project === "string" && typeof view === "string" ? { project, view } : undefined}
    />
  );
}
export default async function Home({ searchParams }: PageProps<"/[locale]">) {
  const t = await getTranslations("workspace");
  return (
    <Suspense
      fallback={
        <main className="loading">
          <Brand />
          <p><Spinner /> {t("opening")}</p>
        </main>
      }
    >
      <LocalWorkspace searchParams={searchParams} />
    </Suspense>
  );
}
