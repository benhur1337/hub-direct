import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { sessionCookie, sessionUser } from "@/lib/auth";
import { AuthForm } from "./auth-form";

/** Someone already signed in goes straight to the workspace. */
async function SignedInRedirect() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  await connection(); // session expiry reads the clock
  if (sessionUser(token)) redirect({ href: "/", locale: await getLocale() });
  return null;
}

/** The form is static; only the signed-in check waits for the request. */
export function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  return (
    <>
      <Suspense fallback={null}>
        <SignedInRedirect />
      </Suspense>
      <AuthForm mode={mode} />
    </>
  );
}
