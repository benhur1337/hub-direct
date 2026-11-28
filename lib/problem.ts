import type en from "@/messages/en.json";

/** Keys of the `errors` messages in messages/*.json. */
export type ErrorKey = Extract<keyof (typeof en)["errors"], string>;
/** Keys of the `labels` messages, used for the {label} in "Enter {label}". */
export type LabelKey = Extract<keyof (typeof en)["labels"], string>;
export type ErrorValues = Record<string, string | number>;

/**
 * An error the person can act on. It carries a message key rather than text, so the
 * route handler (or the browser, for checks that run there) can say it in their language.
 * A `label` value names a key in `labels`.
 */
export class Problem extends Error {
  constructor(
    readonly key: ErrorKey,
    readonly status = 400,
    readonly values: ErrorValues = {},
    /** "group.key" of the brand profile field the error is about. */
    readonly field?: string,
  ) {
    super(key);
    this.name = "Problem";
  }
}
export function check(
  value: unknown,
  key: ErrorKey,
  status = 400,
  values?: ErrorValues,
): asserts value {
  if (!value) throw new Problem(key, status, values);
}

/** A translator for any message key; next-intl's typed `t` narrowed to what this file needs. */
export type Translate = (key: string, values?: ErrorValues) => string;

/** The text for a Problem in the translator's language. */
export function problemText(t: Translate, problem: Problem) {
  const values = { ...problem.values };
  if (typeof values.label === "string") values.label = t("labels." + values.label, values);
  const text = t("errors." + problem.key, values);
  return problem.field ? t("errors.brandField", { field: t("brandFields." + problem.field + ".label"), reason: text }) : text;
}
