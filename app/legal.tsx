import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Brand, Icon, supportEmail } from "./ui";
import { LanguageSwitch } from "./language-switch";

const developerEmail = "benhur.cimafranca@outlook.com";
const updated = "28 November 2026";
const mail = (address: string) => <a href={"mailto:" + address}>{address}</a>;

const contact = (
  <>
    <h2>Contact</h2>
    <p>
      Support, privacy and account requests: {mail(supportEmail)}. Technical questions about the app: {mail(developerEmail)}.
    </p>
  </>
);

/** Privacy Policy and Terms share one layout; the text is English in both languages. */
export async function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const t = await getTranslations("legal");
  const locale = await getLocale();
  return (
    <div className="auth-page">
      <header className="auth-header wide">
        <Link className="mast-brand" href="/" aria-label={t("home")}>
          <Brand />
        </Link>
        <LanguageSwitch pathname={kind === "privacy" ? "/privacy" : "/terms"} />
      </header>
      <main className="legal wide">
        {locale !== "en" && <p className="legal-note">{t("englishOnly")}</p>}
        <article lang="en">
          <h1>{kind === "privacy" ? "Privacy Policy" : "Terms of Service"}</h1>
          <p className="muted">Last updated {updated}</p>
          {kind === "privacy" ? privacy : terms}
          {contact}
        </article>
        <Link className="back" href="/">
          <Icon name="back" />
          {t("back")}
        </Link>
      </main>
    </div>
  );
}

const privacy: ReactNode = (
  <>
    <p>
      Hub Direct (“we”, “us”) is a web workspace for planning, writing and scheduling social media posts for brands. This policy
      explains what we collect when you use it, why, and the choices you have.
    </p>

    <h2>What we collect</h2>
    <ul>
      <li>
        <strong>Account details:</strong> your email address and a password, which we store only as a salted scrypt hash.
      </li>
      <li>
        <strong>What you add to the workspace:</strong> brand profiles and voice, editorial notes, post briefs, captions, schedules,
        calendar suggestions you request, and the photos, videos and PDFs you upload.
      </li>
      <li>
        <strong>Connected social accounts:</strong> when you connect Facebook, Instagram or TikTok, we keep the account or Page name
        and ID and an access token, encrypted (AES-GCM), so we can publish the posts you schedule.
      </li>
      <li>
        <strong>Technical data:</strong> a sign-in cookie, your language choice, and your IP address, which we hold in server memory
        only to limit repeated sign-in attempts. Our hosting provider keeps standard server logs.
      </li>
    </ul>
    <p>We do not use advertising or analytics trackers, and we do not sell or rent your data.</p>

    <h2>How we use it</h2>
    <ul>
      <li>To run your workspace: save your projects, show your schedule and keep you signed in.</li>
      <li>To generate captions and brand calendar suggestions with AI, using your brand profile, briefs and notes.</li>
      <li>To publish the posts you schedule, at the time you chose, to the accounts you connected.</li>
      <li>To keep the service secure and to answer your support requests.</li>
    </ul>

    <h2>Who we share it with</h2>
    <p>Only the services that run Hub Direct, each for the purpose listed:</p>
    <ul>
      <li>
        <strong>Anthropic (Claude):</strong> your brand profile, editorial notes, briefs and media descriptions, to write captions and
        calendar suggestions. Under Anthropic’s commercial terms, this data is not used to train its models.
      </li>
      <li>
        <strong>Meta (Facebook and Instagram) and TikTok:</strong> the captions and media of posts you schedule to those accounts.
        Their own privacy policies apply once a post is published.
      </li>
      <li>
        <strong>Cloudflare R2:</strong> storage for your uploaded files, in a private bucket.
      </li>
      <li>
        <strong>Neon:</strong> the database that holds your account and projects.
      </li>
      <li>
        <strong>Vercel:</strong> hosting for the website and the scheduled publisher.
      </li>
    </ul>
    <p>We may also disclose data if the law requires it.</p>

    <h2>Cookies and browser storage</h2>
    <p>
      We set a sign-in cookie (it lasts 30 days, or until you sign out) and a cookie that remembers your language. Drafts in the
      weekly planner and calendar suggestions are kept in your browser’s session storage until you close the tab. We use no other
      cookies.
    </p>

    <h2>How long we keep it</h2>
    <p>
      We keep your data while your account exists. Deleting a project deletes its brand profile, posts, notes and uploaded files.
      Disconnecting a channel deletes its stored access token. When you ask us to delete your account, we delete it and everything
      in it within 30 days.
    </p>

    <h2>Deleting your data</h2>
    <ol>
      <li>To remove one brand, open the project and choose Delete project.</li>
      <li>To stop us accessing a social account, open Channels and choose Disconnect. You can also remove Hub Direct from your Facebook or TikTok app settings.</li>
      <li>To delete your whole account, email {mail(supportEmail)} from the address you signed up with.</li>
    </ol>

    <h2>Your rights</h2>
    <p>
      You can ask us for a copy of your data, to correct it, or to delete it, by emailing {mail(supportEmail)}. We reply within 30
      days.
    </p>

    <h2>Security</h2>
    <p>
      Passwords are hashed, access tokens are encrypted, uploaded files are private and shared with social platforms only through
      short-lived signed links, and every connection uses HTTPS. No system is perfectly secure, so please use a strong, unique
      password.
    </p>

    <h2>Children</h2>
    <p>Hub Direct is for businesses and is not intended for anyone under 18.</p>

    <h2>Changes</h2>
    <p>If we change this policy, we will update the date above, and tell you by email when the change is significant.</p>
  </>
);

const terms: ReactNode = (
  <>
    <p>
      These terms apply when you use Hub Direct, a web workspace for planning, writing and scheduling social media posts. By creating
      an account you agree to them.
    </p>

    <h2>Your account</h2>
    <p>
      Use an email address you control, keep your password private, and tell us at {mail(supportEmail)} if you think someone else
      has used your account. You are responsible for what happens in your account.
    </p>

    <h2>Your content</h2>
    <p>
      You keep ownership of everything you add: brand details, briefs, captions, photos and videos. You allow us to store, process and
      send it only as needed to run the service, including sending it to the AI provider that writes captions and to the social
      accounts you choose to publish to. You confirm you have the rights to what you upload and publish.
    </p>

    <h2>Acceptable use</h2>
    <p>Do not use Hub Direct to:</p>
    <ul>
      <li>publish anything unlawful, deceptive, hateful or that infringes someone else’s rights;</li>
      <li>break the rules of Facebook, Instagram, TikTok or any platform you publish to;</li>
      <li>access accounts, Pages or data you are not authorised to manage;</li>
      <li>attack, overload, or try to get around the security of the service.</li>
    </ul>

    <h2>AI suggestions</h2>
    <p>
      Captions and brand calendar dates are generated by AI and can be wrong, including dates that move from year to year. Review
      every caption and date before you schedule it. You are responsible for what you publish.
    </p>

    <h2>Social platforms</h2>
    <p>
      Hub Direct is not affiliated with or endorsed by Meta or TikTok. Publishing depends on their services and permissions, which can
      change or fail. Check your schedule for any post that did not publish. Your use of those platforms is also governed by their
      own terms.
    </p>

    <h2>Availability</h2>
    <p>
      We work to keep Hub Direct running and your data safe, but we provide it “as is”, without a guarantee that it will always be
      available or free of errors. We may change or improve features over time.
    </p>

    <h2>Liability</h2>
    <p>
      To the extent the law allows, we are not liable for indirect or consequential losses, such as lost profits, lost data, or a post
      that published late, incorrectly, or not at all. Nothing in these terms limits liability that cannot be limited by law.
    </p>

    <h2>Ending your use</h2>
    <p>
      You can stop using Hub Direct at any time and ask us to delete your account. We may suspend or close an account that breaks
      these terms, and will tell you why unless the law prevents it.
    </p>

    <h2>Changes</h2>
    <p>
      If we change these terms, we will update the date above, and tell you by email when the change is significant. Continuing to
      use Hub Direct after that means you accept the new terms.
    </p>
  </>
);
