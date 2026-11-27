"use client";
import { useState } from "react";
import {
  noteLength,
  noteLimit,
  type EditorialNote,
  type Post,
  type Project,
} from "@/lib/model";
import { api, Field, Icon, message, PlatformMark } from "./ui";

const when = (note: EditorialNote) =>
  new Date(note.at).toLocaleDateString(undefined, { dateStyle: "medium" });

/** Adds a note to the brand voice, optionally about one post and one of its channels. */
function NoteForm({
  project,
  update,
  post,
}: {
  project: Project;
  update: (p: Project) => void;
  post?: Post;
}) {
  const [text, setText] = useState("");
  const [platform, setPlatform] = useState("");
  // Kept across retries so a lost response cannot save the note twice.
  const [noteId, setNoteId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const full = (project.editorial?.length ?? 0) >= noteLimit;
  return (
    <form
      className="note-form"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        api({
          action: "note",
          project: project.id,
          noteId,
          text,
          ...(post ? { postId: post.id, platform } : {}),
        })
          .then((data) => {
            update(data.project);
            setText("");
            setPlatform("");
            setNoteId(crypto.randomUUID());
          })
          .catch((err) => setError(message(err)))
          .finally(() => setBusy(false));
      }}
    >
      <Field label={post ? "Add an editorial note" : "Add a note"}>
        <textarea
          required
          maxLength={noteLength}
          disabled={busy || full}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            post
              ? "What should future captions keep or change? e.g. Great hook. Fewer emoji."
              : "e.g. Always mention free delivery on product posts."
          }
        />
        <small>
          {full
            ? `You have ${noteLimit} notes. Remove one in Brand voice to add another.`
            : "Saved with the brand voice. Captions generated from now on follow it."}
        </small>
      </Field>
      <div className="actions">
        {post && post.destinations.length > 1 && (
          <label className="note-scope">
            About
            <select value={platform} disabled={busy} onChange={(e) => setPlatform(e.target.value)}>
              <option value="">All channels</option>
              {post.destinations.map((d) => (
                <option key={d.platform} value={d.platform}>
                  {d.platform} caption
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="secondary" disabled={busy || full || !text.trim()}>
          <Icon name="note" size={15} />
          {busy ? "Saving…" : "Save note"}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function NoteItem({
  project,
  note,
  update,
  showPost,
}: {
  project: Project;
  note: EditorialNote;
  update: (p: Project) => void;
  showPost?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const post = showPost && note.postId && project.posts.find((p) => p.id === note.postId);
  return (
    <li className="note">
      <p className="preserve">{note.text}</p>
      <small className="note-meta">
        {note.platform && <PlatformMark platform={note.platform} />}
        {when(note)}
        {note.platform && " · " + note.platform}
        {post && " · " + post.brief}
      </small>
      {note.caption && <p className="note-caption">“{note.caption}”</p>}
      <button
        className="text-button"
        disabled={busy}
        aria-label={"Remove note: " + note.text.slice(0, 60)}
        onClick={() => {
          setBusy(true);
          setError("");
          api({ action: "unnote", project: project.id, noteId: note.id })
            .then((data) => update(data.project))
            .catch((err) => {
              setError(message(err));
              setBusy(false);
            });
        }}
      >
        <Icon name="close" size={15} />
        {busy ? "Removing…" : "Remove"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

/** Notes written about one post, shown in its schedule row. */
export function PostNotes({
  project,
  post,
  update,
}: {
  project: Project;
  post: Post;
  update: (p: Project) => void;
}) {
  const notes = (project.editorial ?? []).filter((n) => n.postId === post.id);
  return (
    <section className="post-notes" aria-label="Editorial notes">
      {notes.length > 0 && (
        <ul className="note-list">
          {notes.map((n) => (
            <NoteItem key={n.id} project={project} note={n} update={update} />
          ))}
        </ul>
      )}
      <NoteForm project={project} update={update} post={post} />
    </section>
  );
}

/** Every note, newest first, on the Brand voice tab. */
export function EditorialNotes({
  project,
  update,
}: {
  project: Project;
  update: (p: Project) => void;
}) {
  const notes = [...(project.editorial ?? [])].reverse();
  return (
    <section className="form-layout editorial">
      <div>
        <span className="desk-mark">
          <Icon name="note" size={22} />
        </span>
        <h2>Editorial notes</h2>
        <p className="lead">
          Feedback from the composer and schedule lives here with the brand voice. Every generated
          caption follows these notes, with later notes taking priority.
        </p>
      </div>
      <div className="form-panel">
        <NoteForm project={project} update={update} />
        {notes.length ? (
          <ul className="note-list">
            {notes.map((n) => (
              <NoteItem key={n.id} project={project} note={n} update={update} showPost />
            ))}
          </ul>
        ) : (
          <p className="muted">
            No notes yet. Add one here, when you confirm a post, or from any post in the schedule.
          </p>
        )}
      </div>
    </section>
  );
}
