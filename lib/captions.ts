import type Anthropic from "@anthropic-ai/sdk";
import { brandContext, editorialContext } from "./brand-profile";
import type { Platform, Project } from "./model";

// Never changes between requests, so it opens the cached prefix; editorial notes get their own instruction here rather than a varying one.
const captionSystem = (instruction: string) =>
  "Draft one social caption for the specified platform in this brand's voice. " +
  instruction +
  " Editorial notes are the team's feedback on earlier captions, oldest first: follow them as preferences after the rules, let a later note win over an earlier one, and apply a note that names a platform only to that platform." +
  " The media description is the user's own summary of the attached photos or video; describe only what it states. Return only the editable caption, up to 6000 characters.";
/**
 * Prompt layout, most stable first, so each change only re-writes the blocks after it:
 * system → brand context (changes when the profile is saved; breakpoint 1) →
 * editorial notes (change when a note is added; breakpoint 2) → this request.
 * Notes stay out of the first block so adding one keeps the brand context cached, and
 * the second breakpoint caches the pair even when the profile alone is under the minimum.
 */
export function captionRequest(project: Project, platform: Platform, brief: string, mediaDescription?: string) {
  // Brand context minus platform notes is identical for every platform, so it forms the cached prefix.
  const shared = brandContext(project, "");
  const notes = editorialContext(project);
  const guidelines = brandContext(project, platform).data.preferences?.social_platforms?.guidelines;
  return {
    model: "claude-sonnet-5-5",
    max_tokens: 16000,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: captionSystem(shared.instruction),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify({ brandContext: shared.data }),
            cache_control: { type: "ephemeral" },
          },
          ...(notes
            ? [
                {
                  type: "text",
                  text: JSON.stringify({ editorialNotes: notes }),
                  cache_control: { type: "ephemeral" },
                } as const,
              ]
            : []),
          {
            type: "text",
            text: JSON.stringify({
              platform,
              ...(guidelines ? { platformGuidelines: guidelines } : {}),
              brief,
              ...(mediaDescription ? { mediaDescription } : {}),
            }),
          },
        ],
      },
    ],
  } satisfies Anthropic.Beta.MessageCreateParamsNonStreaming;
}
