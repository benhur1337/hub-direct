import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "../../legal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: t("terms") + " — Hub Direct", alternates: { languages: { en: "/en/terms", th: "/th/terms" } } };
}

export default function TermsPage() {
  return <LegalPage kind="terms" />;
}
