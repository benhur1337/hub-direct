import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { workspace } from "@/lib/store";
import { sessionCookie, sessionUser } from "@/lib/auth";
import { Desk } from "./workspace";
import { Brand } from "./ui";

async function LocalWorkspace({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const { project, meta } = await searchParams;
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
    />
  );
}
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense
      fallback={
        <main className="loading">
          <Brand />
          <p>Opening workspace…</p>
        </main>
      }
    >
      <LocalWorkspace searchParams={searchParams} />
    </Suspense>
  );
}
