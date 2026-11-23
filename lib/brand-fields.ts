export type Group =
  | "brand_identity"
  | "brand_personality"
  | "target_audience"
  | "brand_voice"
  | "communication_preferences"
  | "key_messages"
  | "content_pillars"
  | "visual_identity"
  | "content_guidelines"
  | "social_platforms"
  | "approval_rules";

type Kind =
  | "text"
  | "area"
  | "select"
  | "multi"
  | "tags"
  | "lines"
  | "url"
  | "urls"
  | "colour"
  | "colours"
  | "logo"
  | "assets"
  | "platformNotes";
export type BrandField = {
  group: Group;
  key: string;
  label: string;
  kind: Kind;
  hint?: string;
  example?: string;
  options?: string[];
  advanced?: boolean;
  limit?: number;
};
function field(
  group: Group,
  key: string,
  label: string,
  kind: Kind,
  extra: Partial<BrandField> = {},
): BrandField {
  return { group, key, label, kind, ...extra };
}
const languages = [
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Arabic",
  "Hindi",
  "Mandarin Chinese",
  "Japanese",
  "Thai",
];

export const sections = [
  {
    title: "Brand basics",
    hint: "Introduce your business in your own words.",
    fields: [
      field("brand_identity", "name", "Brand name", "text", { example: "Sunday Studio" }),
      field("brand_identity", "tagline", "Tagline or slogan", "text", {
        example: "Made for everyday life",
      }),
      field("brand_identity", "website", "Website", "url", { example: "https://example.com" }),
      field("brand_identity", "industry", "Industry or business category", "select", {
        options: [
          "Hospitality",
          "Education",
          "Retail",
          "Software",
          "Professional services",
          "Personal brand",
        ],
      }),
      field("brand_identity", "description", "Brand description", "area", {
        hint: "Describe what your business does in 1–3 sentences.",
      }),
      field("brand_identity", "offerings", "Products or services", "area", {
        example: "Weekend classes and online workshops",
      }),
      field("brand_identity", "market", "Primary location or market", "text", {
        example: "Bangkok and online across Thailand",
      }),
    ],
  },
  {
    title: "Brand personality",
    hint: "Choose the qualities you want people to remember.",
    fields: [
      field("brand_personality", "traits", "Personality", "multi", {
        limit: 5,
        hint: "Choose up to five, including your own words.",
        options: [
          "Professional",
          "Friendly",
          "Playful",
          "Sophisticated",
          "Minimalist",
          "Bold",
          "Creative",
          "Warm",
          "Trustworthy",
          "Innovative",
          "Calm",
          "Energetic",
          "Approachable",
        ],
      }),
      field("brand_personality", "values", "Brand values", "area", {
        example: "We explain our prices openly and make time for questions.",
      }),
      field("brand_personality", "impression", "Customer impression", "area", {
        hint: "How should people feel when interacting with your brand?",
      }),
    ],
  },
  {
    title: "Audience & communication",
    hint: "Describe who you speak to and how you sound.",
    fields: [
      field("target_audience", "audience", "Target audience", "area", {
        hint: "Who are your ideal customers or community?",
      }),
      field("communication_preferences", "language", "Primary language", "select", {
        options: languages,
      }),
      field("communication_preferences", "secondary", "Secondary languages", "multi", {
        options: languages,
      }),
      field("brand_voice", "tone", "Brand voice", "multi", {
        options: [
          "Conversational",
          "Formal",
          "Educational",
          "Inspirational",
          "Humorous",
          "Direct",
          "Storytelling",
          "Empathetic",
          "Authoritative",
        ],
      }),
      field("brand_voice", "style", "Preferred writing style", "area", {
        example: "Use short sentences and explain technical terms.",
      }),
      field("target_audience", "terminology", "What do you call your audience?", "text", {
        example: "Guests, members, or clients",
      }),
      field("brand_voice", "previous", "Existing voice notes", "area", {
        advanced: true,
        hint: "Your previously saved guidance. Keep or edit it here.",
      }),
    ],
  },
  {
    title: "Key messages & content",
    hint: "Choose the ideas you want to share most often.",
    fields: [
      field("key_messages", "messages", "Key brand messages", "lines", {
        example: "Every class is open to beginners.",
      }),
      field("content_pillars", "topics", "Main content topics", "tags", {
        hint: "What subjects should your brand regularly talk about?",
        example: "Getting started",
      }),
      field("content_pillars", "goals", "Content goals", "multi", {
        options: [
          "Brand Awareness",
          "Community Engagement",
          "Education",
          "Lead Generation",
          "Sales",
          "Customer Retention",
          "Brand Storytelling",
        ],
      }),
      field("content_pillars", "approach", "Content approach", "multi", {
        options: [
          "Educational",
          "Behind the Scenes",
          "Product-Focused",
          "Story-Driven",
          "Promotional",
          "Community-Focused",
          "Entertaining",
          "Informational",
        ],
      }),
      field(
        "communication_preferences",
        "cta",
        "How often should posts ask readers to take action?",
        "select",
        { options: ["Frequent", "Occasional", "Only When Relevant", "Minimal"] },
      ),
    ],
  },
  {
    title: "Visual identity",
    hint: "Share the colours, images, and files that represent your brand.",
    fields: [
      field("visual_identity", "primary", "Primary brand colour", "colour"),
      field("visual_identity", "style", "Visual style", "multi", {
        options: [
          "Minimalist",
          "Modern",
          "Editorial",
          "Corporate",
          "Playful",
          "Natural",
          "Luxury",
          "Colourful",
          "Documentary",
          "Bold",
        ],
      }),
      field("visual_identity", "logo", "Brand logo", "logo"),
      field("visual_identity", "assets", "Brand assets", "assets"),
      field("visual_identity", "secondary", "Secondary colours", "colours", { advanced: true }),
      field("visual_identity", "accents", "Accent colours", "colours", { advanced: true }),
      field("visual_identity", "fonts", "Preferred fonts", "lines", {
        advanced: true,
        example: "Inter for headlines",
      }),
      field("visual_identity", "imagery", "Photography and imagery", "area", {
        advanced: true,
        example: "Natural light and real people at work",
      }),
      field("visual_identity", "avoid", "Visual styles to avoid", "area", { advanced: true }),
    ],
  },
  {
    title: "Content guidelines",
    hint: "Set preferences for everyday writing.",
    fields: [
      field("content_guidelines", "use", "Words or phrases to use", "tags", {
        example: "Learning partners",
      }),
      field("content_guidelines", "avoid", "Words or phrases to avoid", "tags", {
        example: "Guaranteed results",
      }),
      field("content_guidelines", "emoji", "Emoji usage", "select", {
        options: ["None", "Minimal", "Moderate", "Frequent"],
      }),
      field("content_guidelines", "humour", "Humour preference", "select", {
        options: ["None", "Subtle", "Casual", "Playful"],
      }),
      field("content_guidelines", "promotion", "Promotional tone", "select", {
        options: ["Subtle", "Balanced", "Sales-Focused"],
      }),
      field("content_guidelines", "hashtags", "Preferred hashtags", "tags", {
        advanced: true,
        example: "#MadeLocally",
      }),
      field("content_guidelines", "rules", "Additional content rules", "area", {
        advanced: true,
        example: "Use sentence case in headings.",
      }),
    ],
  },
  {
    title: "Social media preferences",
    hint: "Choose where your brand appears and what you like to share.",
    fields: [
      field("social_platforms", "active", "Active platforms", "multi", {
        options: [
          "Instagram",
          "Facebook",
          "TikTok",
          "LinkedIn",
          "X / Twitter",
          "YouTube",
          "Pinterest",
        ],
      }),
      field("social_platforms", "formats", "Preferred content formats", "multi", {
        options: [
          "Images",
          "Carousels",
          "Short Videos",
          "Long Videos",
          "Stories",
          "Articles",
          "Infographics",
        ],
      }),
      field("social_platforms", "frequency", "Content frequency", "text", {
        example: "Two posts a week",
      }),
      field("social_platforms", "references", "Reference accounts or inspiration", "urls", {
        example: "https://example.com/inspiration",
      }),
      field("social_platforms", "guidelines", "Platform-specific guidelines", "platformNotes", {
        advanced: true,
      }),
    ],
  },
  {
    title: "Brand rules & approval",
    hint: "Tell writers what to avoid and when to ask for a review.",
    fields: [
      field("approval_rules", "rules", "Non-negotiable brand rules", "area", {
        example: "Get consent before naming a customer.",
      }),
      field("approval_rules", "avoid", "Topics to avoid", "area"),
      field("approval_rules", "notes", "Additional notes", "area"),
      field("approval_rules", "verify", "Claims requiring verification", "area", {
        advanced: true,
        example: "Check all prices and product performance claims.",
      }),
      field("approval_rules", "review", "Content requiring human approval", "multi", {
        advanced: true,
        options: [
          "All Content",
          "Promotional Content",
          "Customer Stories",
          "Humour",
          "Sensitive Topics",
          "AI-Generated Images",
        ],
      }),
    ],
  },
];
