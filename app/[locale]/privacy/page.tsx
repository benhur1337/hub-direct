import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "../../legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: t("privacy") + " — Hub Direct", alternates: { languages: { en: "/en/privacy", th: "/th/privacy" } } };
}

export default function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}
