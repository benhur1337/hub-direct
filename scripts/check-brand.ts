import assert from "node:assert/strict";
import { brandContext, initialProfile, normalizeProfile } from "../lib/brand-profile";

const profile = normalizeProfile(
  {
    ...initialProfile(" Studio ", "Existing custom guidance."),
    brand_personality: { traits: ["Friendly", "Friendly", " "] },
    brand_identity: { name: "Studio", website: "https://example.com", tagline: " " },
    social_platforms: {
      active: ["Instagram", "LinkedIn"],
      guidelines: {
        Instagram: "Use image credits.",
        LinkedIn: "Cite the research.",
        X: "Inactive.",
      },
    },
    content_guidelines: { avoid: ["Guaranteed"], use: ["Partners"] },
  },
  [],
  true,
);
assert.deepEqual(profile.brand_personality?.traits, ["Friendly"]);
assert.deepEqual(profile.brand_identity, { name: "Studio", website: "https://example.com/" });
const project = {
  name: "Studio",
  voice: "Legacy guidance",
  brand: { revision: 2, step: 1, completed: profile, draft: initialProfile("Private draft", "") },
};
const context = brandContext(project, "Instagram").data;
assert.equal(context.preferences?.brand_identity?.name, "Studio");
assert.equal(
  brandContext({ ...project, brand: null }, "Instagram").data.preferences?.brand_voice?.previous,
  "Legacy guidance",
);
assert.equal(context.preferences?.brand_voice?.previous, "Existing custom guidance.");
assert.equal(context.preferences?.social_platforms?.guidelines, "Use image credits.");
assert.deepEqual(context.preferences?.content_guidelines?.use, ["Partners"]);
assert.deepEqual(context.rules, { "Words or phrases to avoid": ["Guaranteed"] });
assert.equal(
  brandContext(project, "TikTok").data.preferences?.social_platforms?.guidelines,
  undefined,
);
assert.deepEqual(normalizeProfile({}, [], false), {});
assert.throws(() => normalizeProfile({}, [], true), /brand name/i);
assert.throws(
  () =>
    normalizeProfile({ brand_personality: { traits: ["1", "2", "3", "4", "5", "6"] } }, [], false),
  /five|5/i,
);
assert.throws(
  () => normalizeProfile({ brand_identity: { website: "javascript:void(0)" } }, [], false),
  /URL/,
);
assert.throws(
  () => normalizeProfile({ visual_identity: { primary: "#XYZ" } }, [], false),
  /colour/,
);
console.log("Brand validation and platform context checks passed.");
