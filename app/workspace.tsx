"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, MotionConfig } from "motion/react";
import { Landing } from "./landing";
import { ThemeToggle } from "./theme-toggle";
import { platforms, type Project } from "@/lib/model";
import {
  api,
  Brand,
  Field,
  Icon,
  message,
  PlatformMark,
  prettyTime,
  SiteFooter,
} from "./ui";
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
  ["schedule", "Schedule", "calendar"],
  ["compose", "Compose", "compose"],
  ["plan", "Plan week", "week"],
  ["library", "Library", "upload"],
  ["voice", "Brand voice", "voice"],
  ["channels", "Channels", "link"],
] as const;

const subscribeToHydration = () => () => {};
// Results of Meta login, passed back as codes by app/api/meta/route.ts.
const metaMessages: Record<string, string> = {
  denied: "Facebook login was canceled. Connect again to publish automatically.",
  pages: "Choose exactly one Facebook Page when you connect, then try again.",
  setup: "Automatic publishing isn’t set up on this server yet (META_APP_ID, META_APP_SECRET, APP_URL).",
  failed: "Facebook couldn’t be connected. Try again; if it keeps failing, the server log shows the reason under “Meta login failed”.",
  expired: "That Facebook login couldn’t be matched to this browser. Start Connect again from this same web address, within 10 minutes.",
};

export function Desk({
  signedIn,
  initialProjects,
  metaReturn: returned,
}: {
  signedIn: boolean;
  initialProjects: Project[];
  /** Set when Meta login redirects back to a project. */
  metaReturn?: { project: string; result: string };
}) {
  const [projects, setProjects] = useState(initialProjects);
  const metaReturn = initialProjects.some((p) => p.id === returned?.project) ? returned : undefined;
  const showLocalTime = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [view, setView] = useState<View>(
    metaReturn ? "channels" : initialProjects.length ? "overview" : "create",
  );
  const [id, setId] = useState(metaReturn?.project ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    metaReturn && metaReturn.result !== "linked"
      ? (metaMessages[metaReturn.result] ?? metaMessages.failed)
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
      setError(message(err));
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
        if (!result.ok)
          throw new Error("Could not refresh the schedule. Retrying shortly.");
        const data = await result.json();
        if (!active || revision !== version.current) return;
        if (!data.signedIn) {
          window.location.reload();
          return;
        }
        setProjects(data.projects);
      } catch (err) {
        if (active) setError(message(err));
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
  }, [signedIn, view, id]);
  useEffect(() => {
    if (returned) window.history.replaceState(null, "", "/");
  }, [returned]);
  if (!signedIn) {
    return <Landing busy={busy} error={error} enter={session} />;
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
            aria-label="Hub Connect workspace"
          >
            <Brand />
          </button>
          <nav aria-label="Workspace navigation">
            <button onClick={() => go("overview")} aria-current={view === "overview" ? "page" : undefined}>Projects</button>
            <button onClick={() => go("create")} aria-current={view === "create" ? "page" : undefined}>New project</button>
          </nav>
          <div className="mast-end">
            <ThemeToggle />
            <button
              className="mast-action"
              disabled={busy}
              onClick={() => session({ action: "signout" })}
              aria-label="Sign out"
            >
              Sign out <Icon name="exit" size={16} />
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
              <h1>Workspace</h1>
              <button className="primary" onClick={() => go("create")}>
                <Icon name="plus" />
                New project
              </button>
            </div>
            <div className="overview-lists">
              <section>
                <h2><Icon name="folder" />Projects <span className="count">{projects.length}</span></h2>
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
                          {p.channels.length}{" "}
                          {p.channels.length === 1 ? "channel" : "channels"} ·{" "}
                          {upcoming.filter((u) => u.project.id === p.id).length} upcoming
                        </small>
                      </span>
                      <Icon name="chevron" />
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h2><Icon name="calendar" />Upcoming posts <span className="count">{upcoming.length}</span></h2>
                {upcoming.length ? (
                  <div className="agenda-list">
                    {upcoming.map(({ project, post }) => (
                      <button
                        className="agenda-row"
                        key={post.id}
                        onClick={() => go("schedule", project.id)}
                      >
                        <time dateTime={post.when}>
                          {showLocalTime ? prettyTime(post.when) : post.when}
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
                  <p className="empty">
                    Scheduled posts from your projects will appear here.
                  </p>
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
              Workspace
            </button>
            <div className="form-layout">
              <div>
                <span className="desk-mark"><Icon name="folder" size={22} /></span>
                <h1>
                  {projects.length
                    ? "Create a project"
                    : "Create your first project"}
                </h1>
                <p className="lead">
                  Start with a name. You can add brand guidelines next or return to them later.
                </p>
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
                  <Field label="Project name">
                    <input
                      name="name"
                      required
                      maxLength={100}
                      placeholder="e.g. Sunday Studio"
                    />
                  </Field>
                </div>
                <button className="primary" disabled={busy}>
                  {busy ? "Creating…" : "Create project"}
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
                Workspace
              </button>
              <div className="title-row project-title">
                <h1>{current.name}</h1>
                <div className="project-tools">
                {projects.length > 1 && (
                  <label className="switch-project">
                    Switch project
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
                  Delete project
                </button>
                </div>
              </div>
              {confirmDelete && (
                <div className="confirm-delete" role="alertdialog" aria-labelledby="delete-title">
                  <p id="delete-title">
                    <strong>Delete {current.name}?</strong> This removes its brand voice,{" "}
                    {current.posts.length} {current.posts.length === 1 ? "post" : "posts"}, and{" "}
                    {current.assets.length} uploaded {current.assets.length === 1 ? "file" : "files"}. This cannot be undone.
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
                      {busy ? "Deleting…" : "Delete permanently"}
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      autoFocus
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep project
                    </button>
                  </div>
                </div>
              )}
              <nav className="tabs" aria-label="Project navigation">
                {tabs.map(([key, label, icon]) => (
                  <button
                    key={key}
                    aria-current={view === key ? "page" : undefined}
                    onClick={() => go(key)}
                  >
                    <Icon name={icon} />
                    {label}
                    {view === key && <motion.span aria-hidden="true" className="tab-outline" layoutId="project-tab" />}
                  </button>
                ))}
              </nav>
              {view === "channels" && (
                <div className="form-layout">
                  <div>
                    <span className="desk-mark"><Icon name="link" size={22} /></span>
                    <h2>Connected channels</h2>
                    <p className="lead">
                      Connect Facebook to publish to its Page and linked Instagram account automatically. TikTok posts stay in your plan for you to publish.
                    </p>
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
                              Disconnect
                            </button>
                          </>
                        ) : p !== "TikTok" ? (
                          <a className="secondary" href={"/api/meta?project=" + id}>
                            {p === "Instagram" ? "Connect through Facebook" : "Connect"}
                          </a>
                        ) : current.channels.includes(p) ? (
                          <span className="connected">
                            <Icon name="check" size={15} />
                            Connected
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
                            Connect
                          </button>
                        )}
                      </div>
                    ))}
                    {current.channels.length > 0 && (
                      <button
                        className="primary"
                        onClick={() => go("compose")}
                      >
                        Compose a post
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
        <button onClick={() => go("overview")}>Projects</button>
        <button onClick={() => go("create")}>New project</button>
        {current && <button onClick={() => go("schedule")}>Project schedule</button>}
      </SiteFooter>
    </div>
  );
}
