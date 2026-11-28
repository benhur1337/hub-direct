"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getPathname, Link } from "@/i18n/navigation";
import { api, Brand, Icon, useErrorText } from "./ui";
import { LanguageSwitch } from "./language-switch";

type Mode = "signin" | "signup";

/** A password input with an eye button that shows or hides what was typed. */
function PasswordField({ mode, disabled }: { mode: Mode; disabled: boolean }) {
  const t = useTranslations("auth");
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <label htmlFor="password">{t("password")}</label>
      <div className="password-field">
        <input
          id="password"
          name="password"
          type={shown ? "text" : "password"}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={8}
          maxLength={128}
          disabled={disabled}
          aria-describedby={mode === "signup" ? "password-hint" : undefined}
          // Browsers would otherwise offer to correct or capitalise a visible password.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="reveal"
          aria-controls="password"
          aria-pressed={shown}
          aria-label={shown ? t("hidePassword") : t("showPassword")}
          title={shown ? t("hidePassword") : t("showPassword")}
          onClick={() => setShown(!shown)}
        >
          <Icon name={shown ? "eyeOff" : "eye"} size={20} />
        </button>
      </div>
      {mode === "signup" && <small id="password-hint">{t("passwordHint")}</small>}
    </div>
  );
}

/** The sign-in and sign-up pages: one form, two modes, each with a link to the other. */
export function AuthForm({ mode }: { mode: Mode }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signUp = mode === "signup";
  return (
    <div className="auth-page">
      <header className="auth-header wide">
        <Link className="mast-brand" href="/" aria-label={t("home")}>
          <Brand />
        </Link>
        <LanguageSwitch pathname={signUp ? "/signup" : "/login"} />
      </header>
      <main className="auth-main">
        <form
          className="form-panel auth-panel"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            api({ action: mode, email: data.get("email"), password: data.get("password") })
              // A full load, so the server renders the workspace with the new session cookie.
              .then(() => window.location.assign(getPathname({ href: "/", locale })))
              .catch((err) => {
                setError(errorText(err));
                setBusy(false);
              });
          }}
        >
          <h1>{signUp ? t("signUpTitle") : t("signInTitle")}</h1>
          <p className="lead">{signUp ? t("signUpLead") : t("signInLead")}</p>
          <div className="field">
            <label htmlFor="email">{t("email")}</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              autoFocus
              disabled={busy}
              placeholder={t("emailPlaceholder")}
            />
          </div>
          <PasswordField mode={mode} disabled={busy} />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary auth-submit" disabled={busy}>
            {busy ? (signUp ? t("creating") : t("signingIn")) : signUp ? t("createAccount") : t("signIn")}
            <Icon name="arrow" />
          </button>
          <p className="auth-switch">
            {signUp ? t("haveAccount") : t("noAccount")}{" "}
            <Link href={signUp ? "/login" : "/signup"}>{signUp ? t("toSignIn") : t("toSignUp")}</Link>
          </p>
        </form>
        <Link className="back" href="/">
          <Icon name="back" />
          {t("back")}
        </Link>
      </main>
    </div>
  );
}
