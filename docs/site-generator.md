# AI site generator — implementation plan

Status: **planned, not implemented.**

A user clicks "Make my website". The app builds it in the background and comes back with a
`*.vercel.app` link. The user edits the site afterwards through a CMS inside this app.

## Core idea: Claude writes content, not code

| Approach | Cost per site | Quality risk |
|---|---|---|
| Agent loop (Claude Code style: write, build, screenshot, fix) | ~$5–20 | Low, but too expensive to give away |
| One call that writes HTML/CSS | ~$0.30–0.60 | Broken layouts, inconsistent design |
| **One call that writes content JSON into a hand-built template** (this plan) | **~$0.05–0.15** | Layout can't break; quality comes from the template |

Quality comes from a template we design once, which is a fixed cost. Claude only fills in the
words, picks sections and chooses images, which is what it does well and cheaply.
Editing a site never calls Claude.

## Flow

```
POST /api/site          → set project.site.status = "building", return 202
  after(() => …)        → 1. generate content (one Claude call)
                          2. validate (one repair call only if invalid)
                          3. render template → static files
                          4. deploy to Vercel → save url, status = "live"
GET /api/workspace      → UI shows "Building…" and then the link (polling, which already exists)
PUT /api/site           → CMS save: re-render + redeploy, no Claude call
```

## What it reuses

- `lib/brand-profile.ts`: `brandContext()` / `brandSummary()` are the generation input.
  The brand wizard has already collected what a site needs.
- `@anthropic-ai/sdk` is already installed.
- `projects.assets` + `lib/r2.ts` for images. Claude picks assets **by id**; it never invents URLs.
- The `app/api/cron/publish` pattern: `maxDuration = 300`, Neon-friendly early exits.
- `GET /api/workspace` already returns the project, so status and URL come back for free.

## Data

One new nullable `jsonb` column on `projects` (drizzle migration):

```ts
site: {
  status: "building" | "live" | "failed";
  content: SiteContent;      // what the CMS edits
  vercelProject?: string;    // project id, reused on redeploy
  url?: string;              // URL as returned by Vercel; never assumed
  error?: string;
  updatedAt: string;
}
```

Project rows are sent to the browser (see the comment in `lib/schema.ts`). `site` holds no
secrets, so that's fine. The Vercel token stays in an env var.

`SiteContent` is a fixed schema, kept small and closed:

```ts
{
  theme: { accent: string; font: "serif" | "sans" | "display"; mode: "light" | "dark" };
  seo: { title: string; description: string };
  sections: Array<
    | { type: "hero"; headline: string; sub: string; cta: string; image?: AssetId }
    | { type: "about"; heading: string; body: string; image?: AssetId }
    | { type: "services"; heading: string; items: { name: string; text: string }[] }
    | { type: "gallery"; images: { asset: AssetId; alt: string }[] }
    | { type: "testimonials"; items: { quote: string; name: string }[] }
    | { type: "contact"; heading: string; email?: string; phone?: string; address?: string }
  >;
}
```

## Generation (cost-critical part)

One request in `lib/site.ts`:

- **Model:** `claude-opus-5-5`, `output_config.effort: "medium"` (set explicitly; that's the
  default). Choosing words for a fixed schema doesn't need high effort. Before launch, run the
  same 10 brands on `claude-sonnet-5-5` and compare side by side. If they look as good,
  switch and halve the cost.
- **Structured outputs:** `output_config.format` with the `SiteContent` JSON schema, so the
  JSON is guaranteed valid. (Forced `tool_choice` returns 400 on Opus 5.5; don't use it.)
- **Streaming** + `finalMessage()`, `max_tokens` ~16000. The output is ~3–5K tokens; the
  headroom only prevents truncation.
- **Prompt caching:** the system prompt (writing rules, section guidance, two example
  sites) is identical for every user. Mark it `cache_control: ephemeral`. It only caches if it
  is above the model's minimum prefix length; check `usage.cache_read_input_tokens`.
- **Input:** `brandSummary()` + an asset list (id, name, description) only. Never image bytes.
  Claude chooses from descriptions the user has already written.
- **Refusals:** `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`; check
  `stop_reason` before reading content.

Estimated tokens: ~3–6K in, ~3–5K out → **~$0.05–0.15 per site** on Opus 5.5.
Log `response.usage` per generation and check the real number after the first 20 sites.

### Quality checks without an agent loop (all in code, free)

1. Every `AssetId` exists in `project.assets`; drop any section image that doesn't.
2. Text length limits per field (headline ≤ 70 chars, etc.). Reject and repair if a field runs over.
3. No placeholder text ("Lorem", "Your Company", "[", "TODO").
4. Contact details come **from the brand profile only**. Claude must not invent a phone number
   or address. Enforce this in code: overwrite contact fields from the profile.

If check 2 or 3 fails, make **one** repair call that sends just the bad fields and the error.
After that, save as `failed` with the error. Never loop.

## Template (quality-critical part)

- One template in `lib/site-template.ts`: a function `render(content, assets) → files[]`
  that outputs plain HTML + one CSS file. No build step, no JS framework.
- Design it once following `DESIGN.md`. Responsive, accessible (alt text is required in the
  schema, real heading order, contrast checked for each `theme.mode`), fast (static, small).
- Escape every content string. Content counts as untrusted input even though Claude wrote it.
- Images: check whether R2 asset URLs are public. If not, copy the chosen images into the
  deployment's files.

## Deploy

- Vercel REST API with inline files (`POST /v13/deployments`), `target: "production"`.
- One Vercel project per site, named from a slug of the project name. Store the project id;
  CMS saves redeploy the same project.
- `*.vercel.app` names are global and may be taken. Save the URL Vercel returns.
- Env: `VERCEL_TOKEN`, `VERCEL_TEAM_ID`.
- **Vercel Pro is required**, since Hobby is non-commercial. Check the per-account project limit
  against expected users. If it's tight, move to one multi-tenant deployment on a
  wildcard custom domain. Content and CMS stay the same.

## Background job

- `POST /api/site` sets `building`, then runs the work inside `after()` from `next/server`
  (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`), with
  `export const maxDuration = 300`. Generation takes ~30–90s and the deploy a few seconds.
- If the function dies mid-build, the status would stay `building` forever. The existing
  15-minute cron marks `building` older than 10 minutes as `failed`, so the user can retry.

## CMS

- A "Website" screen in the app: one form per section in `site.content`, plus reorder,
  hide and delete for sections, and choosing images from the project's assets.
- Save → `PUT /api/site` → validate → render → redeploy. **No Claude call.**
- Later, if wanted: "Rewrite this section" sends one small Claude call with only that section
  (~$0.01).

## Cost controls

- Owner-only routes (same auth as `/api/workspace`). Validate input at the boundary.
- Limit full generations per user (e.g. 3/day). Re-render/redeploy stays unlimited because it's free.
- Ignore a new generate request while status is `building`, so double clicks can't double-bill.
- Log `usage` + model per generation to track the real cost per site.

## Out of scope for v1

Multiple templates, custom domains, blog/posts on the site, forms with a backend, an admin
panel inside the generated site (each site would need its own auth and DB; the in-app CMS
covers it), user-written code.

## Build order

1. `SiteContent` type + template + 2 hand-written sample contents → check the design looks right.
2. `lib/site.ts` generation + checks, run with a script on 10 real brands → check cost + quality.
3. Vercel deploy function.
4. `site` column + `POST/PUT /api/site` + cron sweep.
5. CMS screen.
