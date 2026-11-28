// Checks that every language has exactly the English messages, with the same placeholders,
// and that each message parses as ICU. Run: node scripts/check-messages.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IntlMessageFormat } from "intl-messageformat";

const load = (locale) => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url)));
function flatten(node, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(node)) {
    assert(!key.includes("."), `Message keys cannot contain dots: ${prefix}${key}`);
    if (typeof value === "string") out[prefix + key] = value;
    else flatten(value, prefix + key + ".", out);
  }
  return out;
}
// Top-level argument names, ignoring plural branches and rich-text tags.
const placeholders = (text) =>
  [...new Set([...text.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => m[1]))].sort().join(",");

const en = flatten(load("en"));
for (const locale of ["th"]) {
  const other = flatten(load(locale));
  assert.deepEqual(Object.keys(other).sort(), Object.keys(en).sort(), `${locale} keys differ from en`);
  for (const [key, text] of Object.entries(en)) {
    assert.equal(placeholders(other[key]), placeholders(text), `${locale}.${key} placeholders differ`);
    for (const [l, t] of [["en", text], [locale, other[key]]])
      assert.doesNotThrow(() => new IntlMessageFormat(t, l, undefined, { ignoreTag: false }), `${l}.${key} is not valid ICU`);
  }
}
console.log(`Message catalogs match (${Object.keys(en).length} messages).`);
