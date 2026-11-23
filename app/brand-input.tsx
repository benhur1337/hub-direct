"use client";
import { useState } from "react";
import { strings, textLimit, type Answer } from "@/lib/brand-profile";
import type { BrandField } from "@/lib/brand-fields";
import { brandAssetTypes, type Project } from "@/lib/model";
import { Icon } from "./ui";

export function BrandInput({
  f,
  value,
  onChange,
  project,
  platforms,
  upload,
}: {
  f: BrandField;
  value?: Answer;
  onChange: (answer: Answer) => void;
  project: Project;
  platforms: string[];
  upload: (files: File[]) => void;
}) {
  const text = typeof value === "string" ? value : "";
  const items = strings(value);
  const options = f.options ?? [];
  const [custom, setCustom] = useState(!!text && !options.includes(text));
  const [entry, setEntry] = useState("");
  const id = f.group + "-" + f.key;
  const props = {
    id,
    maxLength: textLimit(f),
    placeholder: f.example,
    "aria-describedby": f.hint ? id + "-hint" : undefined,
  };
  const limit = f.limit ?? 40;
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  function addTag() {
    const next = entry.trim();
    if (!next || items.length >= limit) return;
    if (!items.includes(next)) onChange([...items, next]);
    setEntry("");
  }
  function removeButton(label: string, action: () => void) {
    return (
      <button
        type="button"
        className="brand-remove"
        aria-label={"Remove " + label}
        onClick={action}
      >
        <Icon name="close" size={15} />
      </button>
    );
  }
  let control;
  switch (f.kind) {
    case "multi":
    case "tags":
      control = (
        <>
          {options.length > 0 && (
            <div className="choices">
              {options.map((option) => (
                <label key={option}>
                  <input
                    type="checkbox"
                    checked={items.includes(option)}
                    disabled={!items.includes(option) && items.length >= limit}
                    onChange={(e) =>
                      onChange(
                        e.target.checked ? [...items, option] : items.filter((v) => v !== option),
                      )
                    }
                  />
                  {option}
                </label>
              ))}
            </div>
          )}
          <div className="brand-tags">
            {items
              .filter((v) => !options.includes(v))
              .map((v) => (
                <span key={v}>
                  {v}
                  {removeButton(v, () => onChange(items.filter((item) => item !== v)))}
                </span>
              ))}
          </div>
          {items.length < limit && (
            <div className="brand-entry">
              <input
                {...props}
                aria-label={options.length ? "Custom " + f.label : f.label}
                placeholder={f.example ?? "Add your own option"}
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                onBlur={addTag}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button
                type="button"
                className="secondary"
                onMouseDown={(e) => e.preventDefault()}
                onClick={addTag}
              >
                Add
              </button>
            </div>
          )}
        </>
      );
      break;
    case "select":
      control = (
        <>
          <select
            id={id}
            aria-label={f.label}
            value={custom ? "__custom" : text}
            onChange={(e) => {
              const other = e.target.value === "__custom";
              setCustom(other);
              onChange(other ? "" : e.target.value);
            }}
          >
            <option value="">Choose an option</option>
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
            <option value="__custom">Other (write your own)</option>
          </select>
          {custom && (
            <input
              aria-label={"Custom " + f.label}
              maxLength={textLimit(f)}
              placeholder="Write your own"
              value={text}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </>
      );
      break;
    case "colour":
    case "colours":
    case "lines":
    case "urls": {
      const colour = f.kind === "colour" || f.kind === "colours";
      const rows = f.kind === "colour" ? (text ? [text] : []) : items;
      const write = (rows: string[]) => onChange(f.kind === "colour" ? (rows[0] ?? "") : rows);
      const noun = colour
        ? "colour"
        : f.kind === "urls"
          ? "URL"
          : f.key === "fonts"
            ? "font"
            : "message";
      control = (
        <>
          {rows.map((v, i) => (
            <div className="brand-entry" key={i}>
              <input
                aria-label={f.label + " " + (i + 1)}
                type={colour ? "color" : f.kind === "urls" ? "url" : "text"}
                placeholder={f.example}
                maxLength={textLimit(f)}
                value={v}
                onChange={(e) => write(rows.map((old, j) => (j === i ? e.target.value : old)))}
              />
              {colour && <span>{v.toUpperCase()}</span>}
              {removeButton(noun + " " + (i + 1), () => write(rows.filter((_, j) => j !== i)))}
            </div>
          ))}
          {rows.length < (f.kind === "colour" ? 1 : limit) && (
            <button
              type="button"
              className="text-button"
              onClick={() => write([...rows, colour ? "#000000" : ""])}
            >
              <Icon name="plus" size={16} />
              Add {noun}
            </button>
          )}
        </>
      );
      break;
    }
    case "platformNotes": {
      const notes = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      control = platforms.map((p) => (
        <label className="field" key={p}>
          <span>{p}</span>
          <textarea
            maxLength={1000}
            placeholder={"What works on " + p + "?"}
            value={Object.hasOwn(notes, p) ? notes[p] : ""}
            onChange={(e) => onChange({ ...notes, [p]: e.target.value })}
          />
        </label>
      ));
      break;
    }
    case "logo":
    case "assets": {
      const logo = f.kind === "logo";
      const ids = logo ? (text ? [text] : []) : items;
      const types = logo ? brandAssetTypes.filter((t) => t.startsWith("image/")) : brandAssetTypes;
      const available = project.assets.filter((a) => !ids.includes(a.id) && types.includes(a.type));
      control = (
        <>
          {ids.map((v, i) => (
            <div className="brand-entry" key={v}>
              <a
                href={"/api/workspace?project=" + project.id + "&asset=" + v}
                target="_blank"
                rel="noreferrer"
              >
                {project.assets.find((a) => a.id === v)?.name}
              </a>
              {removeButton((logo ? "logo" : "asset") + " " + (i + 1), () =>
                logo ? onChange("") : remove(i),
              )}
            </div>
          ))}
          <label className="upload">
            <Icon name="upload" />
            <span>{logo ? (text ? "Replace logo" : "Choose logo") : "Choose brand files"}</span>
            <small>
              {logo
                ? "JPEG, PNG or WebP · up to 8 MB"
                : "Images or PDF up to 8 MB · MP4 or WebM up to 40 MB"}
            </small>
            <input
              type="file"
              aria-label={f.label}
              accept={types.join(",")}
              multiple={!logo}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) upload(files);
              }}
            />
          </label>
          {available.length > 0 && (
            <select
              aria-label={"Use an existing file for " + f.label}
              value=""
              onChange={(e) => onChange(logo ? e.target.value : [...items, e.target.value])}
            >
              <option value="">Use a file from this project…</option>
              {available.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </>
      );
      break;
    }
    case "area":
      control = (
        <textarea
          {...props}
          aria-label={f.label}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    default:
      control = (
        <input
          {...props}
          aria-label={f.label}
          required={f.key === "name"}
          value={text}
          type={f.kind === "url" ? "url" : "text"}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
  return (
    <fieldset className="brand-field" aria-describedby={props["aria-describedby"]}>
      <legend>
        {f.label}
        {f.key === "name" && <small>Required</small>}
      </legend>
      {f.hint && (
        <p className="brand-hint" id={id + "-hint"}>
          {f.hint}
        </p>
      )}
      {control}
    </fieldset>
  );
}
