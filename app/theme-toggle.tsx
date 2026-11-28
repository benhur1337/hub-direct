"use client";
import { useSyncExternalStore } from "react";
import { Icon } from "./ui";

const systemDark = "(prefers-color-scheme: dark)";
// A saved choice (data-theme, set by the script in layout.tsx) wins over the system setting.
function isDark() {
  const theme = document.documentElement.dataset.theme;
  return theme ? theme === "dark" : matchMedia(systemDark).matches;
}
function subscribe(update: () => void) {
  const query = matchMedia(systemDark);
  const observer = new MutationObserver(update);
  query.addEventListener("change", update);
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  return () => {
    query.removeEventListener("change", update);
    observer.disconnect();
  };
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const theme = dark ? "light" : "dark";
        document.documentElement.dataset.theme = theme;
        try {
          localStorage.setItem("theme", theme);
        } catch {} // Private mode: the choice lasts until reload.
      }}
    >
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}
