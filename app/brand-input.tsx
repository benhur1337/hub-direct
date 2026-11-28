"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { strings, textLimit, type Answer } from "@/lib/brand-profile";
import type { BrandField } from "@/lib/brand-fields";
import { brandAssetTypes, type Project } from "@/lib/model";
import type { Translate } from "@/lib/problem";
import { Icon } from "./ui";

/**
 * Brand profile text in the reader's language. Field definitions (lib/brand-fields.ts) stay
 * English because they are also the labels sent to Claude and saved in the voice summary.
 */
export function useBrandText() {
  const t = useTranslations() as unknown as Translate & { has: (key: string) => boolean };
  const own = (f: BrandField, part: string) => t(`brandFields.${f.group}.${f.key}.${part}`);
  return {
    label: (f: BrandField) => own(f, "label"),
    hint: (f: BrandField) => (f.hint ? own(f, "hint") : undefined),
    example: (f: BrandField) => (f.example ? own(f, "example") : undefined),
    /** Options are stored in English; values people typed themselves show as typed. */
    option: (value: string) => (t.has(`brandOptions.${value}`) ? t(`brandOptions.${value}`) : value),
    section: (index: number) => t(`brandSections.${index}.title`),
    sectionHint: (index: number) => t(`brandSections.${index}.hint`),
  };
}

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
  const t = useTranslations("brand");
  const bt = useBrandText();
  const label = bt.label(f);
  const example = bt.example(f);
  const hint = bt.hint(f);
  const text = typeof value === "string" ? value : "";
  const items = strings(value);
  const options = f.options ?? [];
  const [custom, setCustom] = useState(!!text && !options.includes(text));
  const [entry, setEntry] = useState("");
  const id = f.group + "-" + f.key;
  const props = {
    id,
    maxLength: textLimit(f),
    placeholder: example,
    "aria-describedby": hint ? id + "-hint" : undefined,
  };
  const limit = f.limit ?? 40;
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  function addTag() {
    const next = entry.trim();
    if (!next || items.length >= limit) return;
    if (!items.includes(next)) onChange([...items, next]);
    setEntry("");
  }
  function removeButton(what: string, action: () => void) {
    return (
      <button
        type="button"
        className="brand-remove"
        aria-label={t("remove", { item: what })}
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
                  {bt.option(option)}
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
                aria-label={options.length ? t("custom", { field: label }) : label}
                placeholder={example ?? t("addOwn")}
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
                {t("add")}
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
            aria-label={label}
            value={custom ? "__custom" : text}
            onChange={(e) => {
              const other = e.target.value === "__custom";
              setCustom(other);
              onChange(other ? "" : e.target.value);
            }}
          >
            <option value="">{t("chooseOption")}</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {bt.option(o)}
              </option>
            ))}
            <option value="__custom">{t("other")}</option>
          </select>
          {custom && (
            <input
              aria-label={t("custom", { field: label })}
              maxLength={textLimit(f)}
              placeholder={t("writeOwn")}
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
      const noun = colour ? "colour" : f.kind === "urls" ? "url" : f.key === "fonts" ? "font" : "message";
      control = (
        <>
          {rows.map((v, i) => (
            <div className="brand-entry" key={i}>
              <input
                aria-label={label + " " + (i + 1)}
                type={colour ? "color" : f.kind === "urls" ? "url" : "text"}
                placeholder={example}
                maxLength={textLimit(f)}
                value={v}
                onChange={(e) => write(rows.map((old, j) => (j === i ? e.target.value : old)))}
              />
              {colour && <span>{v.toUpperCase()}</span>}
              {removeButton(t(`nouns.${noun}`, { n: i + 1 }), () => write(rows.filter((_, j) => j !== i)))}
            </div>
          ))}
          {rows.length < (f.kind === "colour" ? 1 : limit) && (
            <button
              type="button"
              className="text-button"
              onClick={() => write([...rows, colour ? "#000000" : ""])}
            >
              <Icon name="plus" size={16} />
              {t(`addNoun.${noun}`)}
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
            placeholder={t("platformPlaceholder", { platform: p })}
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
              {removeButton(t(logo ? "nouns.logo" : "nouns.asset", { n: i + 1 }), () =>
                logo ? onChange("") : remove(i),
              )}
            </div>
          ))}
          <label className="upload">
            <Icon name="upload" />
            <span>{logo ? (text ? t("replaceLogo") : t("chooseLogo")) : t("chooseFiles")}</span>
            <small>{logo ? t("logoTypes") : t("fileTypes")}</small>
            <input
              type="file"
              aria-label={label}
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
              aria-label={t("existingFor", { field: label })}
              value=""
              onChange={(e) => onChange(logo ? e.target.value : [...items, e.target.value])}
            >
              <option value="">{t("existing")}</option>
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
          aria-label={label}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    default:
      control = (
        <input
          {...props}
          aria-label={label}
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
        {label}
        {f.key === "name" && <small>{t("required")}</small>}
      </legend>
      {hint && (
        <p className="brand-hint" id={id + "-hint"}>
          {hint}
        </p>
      )}
      {control}
    </fieldset>
  );
}
