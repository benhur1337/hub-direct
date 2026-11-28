"use client";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** Each language's name in its own script, so a reader finds theirs whatever the page language. */
const names = { en: "EN", th: "ไทย" } as const;
const fullNames = { en: "English", th: "ภาษาไทย" } as const;

/**
 * Switches between English (/en) and Thai (/th) on the same page. The choice is saved in the
 * NEXT_LOCALE cookie, so later visits open in the same language. `query` reopens the same screen.
 */
export function LanguageSwitch({ query, pathname = "/" }: { query?: Record<string, string>; pathname?: "/" | "/login" | "/signup" | "/privacy" | "/terms" }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="language-switch" role="group" aria-label={t("language")}>
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-label={fullNames[l]}
          aria-pressed={l === locale}
          disabled={pending}
          onClick={() => {
            if (l === locale) return;
            start(() => router.replace({ pathname, query }, { locale: l, scroll: false }));
          }}
        >
          {names[l]}
        </button>
      ))}
    </div>
  );
}
