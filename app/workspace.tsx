"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, MotionConfig } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { Landing } from "./landing";
import { platforms, type Project } from "@/lib/model";
import {
  api,
  Brand,
  Field,
  Icon,
  PlatformMark,
  prettyTime,
  SiteFooter,
  useErrorText,
} from "./ui";
import { LanguageSwitch } from "./language-switch";
import { BrandWizard } from "./brand-wizard";
import { Composer } from "./composer";
import { Schedule } from "./schedule";
import { Library } from "./library";
import { EditorialNotes } from "./editorial";
import { Planner } from "./planner";

type View =
  | "overview"
  | "create"
  | "schedule"
  | "compose"
  | "plan"
  | "library"
  | "voice"
  | "channels";
const tabs = [
  ["schedule", "calendar"],
  ["compose", "compose"],
  ["plan", "week"],
  ["library", "upload"],
  ["voice", "voice"],
  ["channels", "link"],
] as const;
const views = ["overview", "create", ...tabs.map(([key]) => key)] as const;

const subscribeToHydration = () => () => {};
// Results of Meta login, passed back as codes by app/api/meta/route.ts; texts are metaLogin.* messages.
const metaResults = ["denied", "pages", "setup", "failed", "expired"] as const;

export function Desk({
  signedIn,
  initialProjects,
  metaReturn: returned,
  reopen,
}: {
  signedIn: boolean;
  initialProjects: Project[];
  /** Set when Meta login redirects back to a project. */
  metaReturn?: { project: string; result: string };
  /** The screen that was open before switching language. */
  reopen?: { project: string; view: string };
}) {
  const t = useTranslations("workspace");
  const tTabs = useTranslations("tabs");
  const tMeta = useTranslations("metaLogin");
  const errorText = useErrorText();
  const locale = useLocale();
  const [projects, setProjects] = useState(initialProjects);
  const metaReturn = initialProjects.some((p) => p.id === returned?.project) ? returned : undefined;
  const reopened = initialProjects.some((p) => p.id === reopen?.project)
    ? views.find((v) => v === reopen?.view)
    : undefined;
  const showLocalTime = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [view, setView] = useState<View>(
    metaReturn ? "channels" : reopened ?? (initialProjects.length ? "overview" : "create"),
  );
  const [id, setId] = useState(metaReturn?.project ?? (reopened ? reopen!.project : ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    metaReturn && metaReturn.result !== "linked"
      ? tMeta(metaResults.find((r) => r === metaReturn.result) ?? "failed")
      : "",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const version = useRef(0);
  const current = projects.find((p) => p.id === id);
  function go(next: View, projectId = id) {
    version.current++;
    setView(next);
    setId(projectId);
    setError("");
    setConfirmDelete(false);
    window.scrollTo({ top: 0 });
  }
  function update(next: Project) {
    version.current++;
    setProjects((all) =>
      [...all.filter((p) => p.id !== next.id), next].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
  }
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  function session(fields: Record<string, string>) {
    void perform(async () => {
      await api(fields);
      window.location.reload();
    });
  }
  useEffect(() => {
    if (!signedIn || !["overview", "schedule", "plan"].includes(view)) return;
    let active = true;
    let loading = false;
    async function refresh() {
      if (loading || document.hidden) return;
      loading = true;
      const revision = version.current;
      try {
        const result = await fetch("/api/workspace", { cache: "no-store" });
        if (!result.ok) throw new Error(t("refreshFailed"));
        const data = await result.json();
        if (!active || revision !== version.current) return;
        if (!data.signedIn) {
          window.location.reload();
          return;
        }
        setProjects(data.projects);
      } catch (err) {
        if (active) setError(errorText(err));
      } finally {
        loading = false;
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
    // errorText and t change with the language, which remounts the page anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, view, id]);
  useEffect(() => {
    // Drop one-off query parameters (Meta's result, the screen to reopen) from the address.
    if (returned || reopen) window.history.replaceState(null, "", window.location.pathname);
  }, [returned, reopen]);
  if (!signedIn) {
    return <Landing />;
  }
  const upcoming = projects
    .flatMap((p) =>
      p.posts
        .filter((post) =>
          post.destinations.some((d) => d.status === "Scheduled"),
        )
        .map((post) => ({ project: p, post })),
    )
    .sort((a, b) => a.post.when.localeCompare(b.post.when));
  return (
    <div className="shell" id="top">
      <header className="site-header">
        <div className="wide mast-inner">
          <button
            className="mast-brand"
            onClick={() => go(projects.length ? "overview" : "create")}
            aria-label={t("home")}
          >
            <Brand />
          </button>
          <nav aria-label={t("navigation")}>
            <button onClick={() => go("overview")} aria-current={view === "overview" ? "page" : undefined}>{t("projects")}</button>
            <button onClick={() => go("create")} aria-current={view === "create" ? "page" : undefined}>{t("newProject")}</button>
          </nav>
          <div className="mast-end">
            <LanguageSwitch query={id && view !== "overview" && view !== "create" ? { project: id, view } : undefined} />
            <button
              className="mast-action sign-out"
              disabled={busy}
              onClick={() => session({ action: "signout" })}
            >
              <span className="mast-label">{t("signOut")}</span> <Icon name="exit" size={16} />
            </button>
          </div>
        </div>
      </header>
      <main className="desk wide" data-view={view} key={id}>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {view === "overview" ? (
          <>
            <div className="title-row">
              <h1>{t("title")}</h1>
              <button className="primary" onClick={() => go("create")}>
                <Icon name="plus" />
                {t("newProject")}
              </button>
            </div>
            <div className="overview-lists">
              <section>
                <h2><Icon name="folder" />{t("projects")} <span className="count">{projects.length}</span></h2>
                <div className="project-list">
                  {projects.map((p) => (
                    <button
                      className="project-row"
                      key={p.id}
                      onClick={() => go("schedule", p.id)}
                    >
                      <span className="project-icon">
                        <Icon name="folder" size={24} />
                      </span>
                      <span>
                        <strong>{p.name}</strong>
                        <small>
                          {t("projectSummary", {
                            channels: p.channels.length,
                            upcoming: upcoming.filter((u) => u.project.id === p.id).length,
                          })}
                        </small>
                      </span>
                      <Icon name="chevron" />
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h2><Icon name="calendar" />{t("upcomingPosts")} <span className="count">{upcoming.length}</span></h2>
                {upcoming.length ? (
                  <div className="agenda-list">
                    {upcoming.map(({ project, post }) => (
                      <button
                        className="agenda-row"
                        key={post.id}
                        onClick={() => go("schedule", project.id)}
                      >
                        <time dateTime={post.when}>
                          {showLocalTime ? prettyTime(post.when, locale) : post.when}
                        </time>
                        <span>
                          <strong>{post.brief}</strong>
                          <small>{project.name}</small>
                        </span>
                        <Icon name="chevron" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="empty">{t("upcomingEmpty")}</p>
                )}
              </section>
            </div>
          </>
        ) : view === "create" ? (
          <>
            <button
              className="back"
              hidden={!projects.length}
              onClick={() => go("overview")}
            >
              <Icon name="back" />
              {t("title")}
            </button>
            <div className="form-layout">
              <div>
                <span className="desk-mark"><Icon name="folder" size={22} /></span>
                <h1>{projects.length ? t("createProject") : t("createFirstProject")}</h1>
                <p className="lead">{t("createLead")}</p>
              </div>
              <form
                className="form-panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  const values = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  void perform(async () => {
                    const data = await api({ ...values, action: "create" });
                    update(data.project);
                    go("voice", data.project.id);
                  });
                }}
              >
                <div className="project-fields">
                  <Field label={t("projectName")}>
                    <input
                      name="name"
                      required
                      maxLength={100}
                      placeholder={t("projectNamePlaceholder")}
                    />
                  </Field>
                </div>
                <button className="primary" disabled={busy}>
                  {busy ? t("creating") : t("createButton")}
                  <Icon name="arrow" />
                </button>
              </form>
            </div>
          </>
        ) : (
          current && (
            <MotionConfig reducedMotion="user" transition={{ duration: .22, ease: "easeOut" }}>
              <button className="back" onClick={() => go("overview")}>
                <Icon name="back" />
                {t("title")}
              </button>
              <div className="title-row project-title">
                <h1>{current.name}</h1>
                <div className="project-tools">
                {projects.length > 1 && (
                  <label className="switch-project">
                    {t("switchProject")}
                    <select
                      value={id}
                      onChange={(e) => go(view, e.target.value)}
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Icon name="trash" size={16} />
                  {t("deleteProject")}
                </button>
                </div>
              </div>
              {confirmDelete && (
                <div className="confirm-delete" role="alertdialog" aria-labelledby="delete-title">
                  <p id="delete-title">
                    <strong>{t("deleteTitle", { name: current.name })}</strong>{" "}
                    {t("deleteBody", { posts: current.posts.length, files: current.assets.length })}
                  </p>
                  <div className="actions">
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void perform(async () => {
                          await api({ action: "delete", project: id });
                          try {
                            sessionStorage.removeItem("draft-" + id);
                          } catch {
                            /* Nothing to clear. */
                          }
                          const rest = projects.filter((p) => p.id !== id);
                          setProjects(rest);
                          go(rest.length ? "overview" : "create", "");
                        })
                      }
                    >
                      {busy ? t("deleting") : t("deletePermanently")}
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      autoFocus
                      onClick={() => setConfirmDelete(false)}
                    >
                      {t("keepProject")}
                    </button>
                  </div>
                </div>
              )}
              <nav className="tabs" aria-label={t("projectNavigation")}>
                {tabs.map(([key, icon]) => (
                  <button
                    key={key}
                    aria-current={view === key ? "page" : undefined}
                    onClick={() => go(key)}
                  >
                    <Icon name={icon} />
                    {tTabs(key)}
                    {view === key && <motion.span aria-hidden="true" className="tab-outline" layoutId="project-tab" />}
                  </button>
                ))}
              </nav>
              {view === "channels" && (
                <div className="form-layout">
                  <div>
                    <span className="desk-mark"><Icon name="link" size={22} /></span>
                    <h2>{t("channelsTitle")}</h2>
                    <p className="lead">{t("channelsLead")}</p>
                  </div>
                  <div className="form-panel">
                    {platforms.map((p) => (
                      <div key={p} className="channel-row">
                        <PlatformMark platform={p} />
                        <strong>{p}</strong>
                        {current.linked?.[p] ? (
                          <>
                            <span className="connected">
                              <Icon name="check" size={15} />
                              {current.linked[p]}
                            </span>
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                void perform(async () =>
                                  update((await api({ action: "disconnect", project: id, platform: p })).project),
                                )
                              }
                            >
                              {t("disconnect")}
                            </button>
                          </>
                        ) : p !== "TikTok" ? (
                          <a className="secondary" href={"/api/meta?project=" + id}>
                            {p === "Instagram" ? t("connectThroughFacebook") : t("connect")}
                          </a>
                        ) : current.channels.includes(p) ? (
                          <span className="connected">
                            <Icon name="check" size={15} />
                            {t("connected")}
                          </span>
                        ) : (
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() =>
                              void perform(async () =>
                                update(
                                  (
                                    await api({
                                      action: "connect",
                                      project: id,
                                      platform: p,
                                    })
                                  ).project,
                                ),
                              )
                            }
                          >
                            {t("connect")}
                          </button>
                        )}
                      </div>
                    ))}
                    {current.channels.length > 0 && (
                      <button
                        className="primary"
                        onClick={() => go("compose")}
                      >
                        {t("composePost")}
                        <Icon name="arrow" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              {view === "voice" && (
                <>
                  <BrandWizard key={id} project={current} update={update} />
                  <EditorialNotes key={"notes-" + id} project={current} update={update} />
                </>
              )}
              {view === "plan" && (
                <Planner key={id} project={current} update={update} navigate={go} />
              )}
              {view === "compose" && (
                <Composer
                  key={id}
                  project={current}
                  update={update}
                  navigate={go}
                />
              )}
              {view === "library" && (
                <Library key={id} project={current} update={update} navigate={go} />
              )}
              {view === "schedule" && (
                <Schedule
                  key={id}
                  project={current}
                  update={update}
                  compose={() => go("compose")}
                />
              )}
            </MotionConfig>
          )
        )}
      </main>
      <SiteFooter>
        <button onClick={() => go("overview")}>{t("projects")}</button>
        <button onClick={() => go("create")}>{t("newProject")}</button>
        {current && <button onClick={() => go("schedule")}>{t("projectSchedule")}</button>}
      </SiteFooter>
    </div>
  );
}
