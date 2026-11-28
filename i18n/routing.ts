import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "th"],
  defaultLocale: "en",
  // Every page carries its language (/en, /th); "/" and Meta's return link redirect by saved choice,
  // then browser language. "as-needed" would serve English at "/" through a rewrite, and Next turns
  // that rewrite into an external fetch that loops when the server binds --hostname 127.0.0.1.
  localePrefix: "always",
});
