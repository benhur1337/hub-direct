import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthPage } from "../../auth-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("metaSignIn"), alternates: { languages: { en: "/en/login", th: "/th/login" } } };
}

export default function LoginPage() {
  return <AuthPage mode="signin" />;
}
