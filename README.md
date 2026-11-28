# Hub Connect

Hub Connect helps you plan social posts for each brand. Create an account, start a project, and choose its channels. Compose a post, review each caption, and confirm the scheduled time.

## Run locally

Set the server-side database connection strings in `.env.local`. Use a dedicated Neon database for this workspace.

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@ENDPOINT-pooler.REGION.aws.neon.tech/hub_connect?sslmode=verify-full
DATABASE_URL_UNPOOLED=postgresql://USER:PASSWORD@ENDPOINT.REGION.aws.neon.tech/hub_connect?sslmode=verify-full
```

```sh
npm ci
npm run db:migrate
npm run dev -- --hostname 127.0.0.1
```

Set a session signing secret in `.env.local`, then open [Hub Connect](http://localhost:3000) (it redirects to `/en` or `/th`) and choose **Create account**.

```dotenv
AUTH_SECRET=at-least-32-random-characters
```

Accounts live in Neon with scrypt-hashed passwords. Each account sees only its own projects; the first account to sign up takes over projects created before accounts existed, including ones from `npm run db:import`. Sessions last 30 days. Signing out clears the current browser; change `AUTH_SECRET` to end every session. Anyone who can reach the site can sign up. Sign-in allows 10 attempts per email and 30 per address every 15 minutes; sign-up allows 5 per address per hour. Limits are held in server memory, so they reset on restart and apply per server process. Behind a proxy, make sure it overwrites `X-Forwarded-For`, or per-address limits can be bypassed.

## Languages

Hub Connect is available in English (`/en`) and Thai (`/th`), built with [next-intl](https://next-intl.dev). The **EN / ไทย** switch in the header changes language and keeps the open project and tab; the choice is saved in the `NEXT_LOCALE` cookie. Visiting `/` (including Meta's return link) redirects to the saved language, otherwise the browser's language, otherwise English.

- Text lives in `messages/en.json` and `messages/th.json`, with the same keys. `node scripts/check-messages.mjs` checks that every message exists in both, with the same placeholders, and parses. Message keys are type-checked against `messages/en.json`.
- Errors from `/api/workspace` are keyed (`lib/problem.ts`) and written in the language of the page that called (the browser sends `X-Locale`). Publishing errors saved on posts carry a code, so the schedule shows them in the reader's language.
- Dates use the page's language; Thai shows the Buddhist calendar year. Times stay in the browser's time zone.
- Brand profile options are stored in English and shown translated, so saved profiles, the voice summary and the caption prompt (and its cache) are the same in either language. Captions follow the brand profile's primary language and the language of the brief, not the interface language.
- Thai text uses the bundled Noto Sans Thai (SIL OFL), loaded only for Thai characters.

## Caption generation

Captions are drafted by Claude Sonnet 5.5 (`claude-sonnet-5-5`, low effort, with Anthropic's server-side refusal fallback). The brand context is sent first with a cache breakpoint, so every platform's caption after the first reads it from the prompt cache; "Generate all" and library descriptions send one request before the rest for that reason. Brand contexts under 512 tokens are too short to cache. Set the key in `.env.local` and restart the server.

```dotenv
ANTHROPIC_API_KEY=your-api-key
```

Open **Brand voice** in a project to build its profile. The eight sections can be skipped and revisited. **Save draft** remembers the current step. **Save profile** on the review screen makes the reviewed answers available to caption generation. Existing Markdown appears under **Audience & communication → Advanced options → Existing voice notes**.

**Editorial notes** are feedback for future captions ("great hook", "fewer emoji"). Add one when you confirm a post, from any post in the schedule (before or after it publishes, optionally about one channel's caption), or under **Brand voice → Editorial notes**, where you can also remove them. Notes are stored with the brand voice (`projects.editorial`, up to 40 of 500 characters) and every caption request sends all of them, oldest first, so later notes win.

The caption prompt is laid out for the prompt cache, most stable first: the fixed system prompt, the brand context (cache breakpoint 1), the editorial notes (breakpoint 2), then the platform, brief and media description. Notes are the same for every platform (each note names the platform it is about), so adding one only rewrites the notes block and the brand context stays cached; the second breakpoint also caches the pair when the brand context alone is under the model's 512-token minimum. `scripts/check-brand.ts` asserts this layout. Bulk generation runs the first request alone to write the cache, then the rest four at a time to read it. `response.usage` is logged as "Caption usage" for checking `cache_read_input_tokens`.

**Plan week** shows the next seven days and lets you queue posts in bulk. Upload a batch of up to 50 photos and videos; each file becomes a queued post on the next day with nothing queued or scheduled, at the default time. Write a brief (and media description) on each card, choose **Generate missing captions**, then **Schedule ready posts** and confirm the list of times and destinations. Each post is scheduled on its own, so one failure leaves the others scheduled and shows what to fix. The queue is kept per project in the current browser tab, like composer drafts. The **Library** accepts the same batches (sent ten files per request); batch uploads skip the one-video-per-post rule, which still applies when a post is scheduled.

When a post has media, the composer asks for a short description of it; generated captions describe only what that description states. Generating a caption sends the completed brand context, post brief, media description, and destination to Anthropic. Draft edits stay separate until submission. Without a completed profile, captions use the project's existing voice notes. You can also enter or edit captions manually.

## Storage and delivery

Cloudflare R2 stores uploaded photos, videos, and brand PDFs. Neon stores project profiles, drafts, summaries, schedules, and attachment metadata. Use a private R2 bucket dedicated to this workspace and environment. Generate an R2 S3 access key with **Object Read & Write** permission scoped to that bucket. Add these server-side settings to `.env.local` and restart Next.js. [Cloudflare R2 credentials](https://developers.cloudflare.com/r2/api/tokens/)

```dotenv
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_BUCKET=<BUCKET_NAME>
R2_ACCESS_KEY_ID=<ACCESS_KEY_ID>
R2_SECRET_ACCESS_KEY=<SECRET_ACCESS_KEY>
```

Use the S3 endpoint shown for your bucket. The workspace validates uploads before writing them and serves private objects through its signed-in attachment route.

For workspaces that already store files in Neon, run `npm run media:migrate`. It copies each attachment to R2, verifies its bytes, and preserves existing links and the database copy. You can rerun it after an interruption. Existing Neon attachments remain readable while configuring R2.

The database schema lives in `lib/schema.ts`. After editing it, run `npm run db:generate`, review the generated SQL in `drizzle/`, then run `npm run db:migrate`. On Vercel, every deployment applies pending migrations before building (the `vercel-build` script), using that environment's `DATABASE_URL_UNPOOLED` or `DATABASE_URL`; migrations only add, so the deployment still running keeps working. If a Build Command override is set in the Vercel project settings, it replaces this script. Previews that share the production database migrate it too.

To migrate an existing file-backed workspace, stop its old server, configure R2, apply the database migration, and run `npm run db:import`. The importer reads `.hub-data/` or the directory specified by `HUB_DATA_DIR`. It copies and verifies files in R2 before committing their project metadata to Neon. It preserves original IDs and source files and skips existing projects on reruns.

**Delete project** (next to the project title) removes the project, its posts and drafts, and its R2 files after confirmation. It cannot be undone.

Times are stored in UTC and displayed in the browser’s time zone. Posts to linked Facebook and Instagram accounts publish automatically (see below). Reading a schedule moves other posts into history once their scheduled time passes; publish those on their channel yourself. The workspace and project schedule refresh every five seconds while visible.

The composer supports JPEG, PNG, and WebP photos up to 8 MiB each, or one MP4 or WebM video up to 40 MiB. Drafts are kept per project in the current browser tab.

## Automatic publishing (Facebook and Instagram)

**Channels → Connect** signs in with Facebook and links one Page, plus the Instagram professional account linked to that Page. From then on, posts scheduled to them publish automatically. TikTok stays plan-only.

1. Create a Business app at [Meta for Developers](https://developers.facebook.com/apps). Add **Facebook Login for Business** and the **Instagram Graph API**. Set the valid OAuth redirect URI to `<APP_URL>/api/meta`.
2. In Development mode, only the app's admins, developers and testers can connect. Other people need App Review for `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish` and `business_management`, plus Business Verification.
3. The Instagram account must be a Business or Creator account linked to the Page. Instagram accepts JPEG photos (up to 10, which become a carousel) or one MP4 video (published as a Reel). Hub Connect checks this when you schedule.
4. Add these settings and restart:

```dotenv
META_APP_ID=<app id>
META_APP_SECRET=<app secret>
APP_URL=https://your-public-address   # Meta fetches media from here, so it must be reachable from the internet
TOKEN_KEY=<32 random bytes, base64>   # encrypts Page tokens; node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
CRON_SECRET=<random string>
```

`vercel.json` runs `/api/cron/publish` every minute, so a post goes out within about a minute of its scheduled time (Instagram within about two, since it needs a second run). Each run touches Neon, which keeps it from scaling to zero; the route skips the database entirely when `META_APP_ID` is unset. Cron Jobs more often than daily need the Vercel Pro plan (Hobby runs them once a day). Vercel sends `CRON_SECRET` automatically; anywhere else, call the route with `Authorization: Bearer <CRON_SECRET>`. If deployment protection is on, Meta can't fetch media from protected deployments.

Page tokens are stored encrypted in the `connections` table and never sent to the browser. Media reaches Meta through one-hour signed links. A post is claimed before sending and is never re-sent automatically. If one stays on **Publishing**, check the platform before scheduling it again. If Facebook revokes access (for example after a password change), the post shows **Not published** with a prompt to reconnect.

## Verify

```sh
npm run lint
npm run build
node --import tsx scripts/check-brand.ts
node scripts/check-messages.mjs
node scripts/check-scheduler.mjs
```

The scheduler check uses the direct database connection to create and migrate a temporary database, then removes it after the run. The role needs permission to create databases. A local S3 test server exercises uploads, downloads, failed uploads, and migration retries. The check also starts and restarts a production server and exercises concurrent edits, project isolation, caption failure, scheduling, rescheduling, cancellation, and the transition of due posts into history.
