import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthPage } from "../../auth-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("metaSignUp"), alternates: { languages: { en: "/en/signup", th: "/th/signup" } } };
}

export default function SignupPage() {
  return <AuthPage mode="signup" />;
}
