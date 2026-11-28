import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Picks the language from the address, then the saved choice (NEXT_LOCALE cookie), then the browser.
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals and files such as icon.svg.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
