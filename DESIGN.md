# Hub Direct · OFF+BRAND. style reference

## Visual identity

The light interface uses near-black type on warm parchment. A single CSS sphere overlaps the homepage headline, with static concentric hairlines extending beyond its edge. Product previews, navigation, the signed-in workspace, and feedback states are monochrome. Uploaded media retains its original colors.

| Surface | Value | Use |
| --- | --- | --- |
| Parchment | `#e5e4e0` | Page canvas |
| Ink | `#1d1d1d` | Type, icons, control outlines, keyboard focus |
| Paper | `#ffffff` | Forms, product proofs, logo cells, schedule sheets |
| Ash | `#bfbebe` | Hairline dividers and concentric rings |
| Stone | `#cdcdc9` | Secondary panels |
| Sphere | `linear-gradient(255deg, rgb(250, 203, 14), rgb(240, 107, 168) 30%, rgb(120, 186, 230) 65%, white)` | Homepage hero only |

## Typography

The live OFF+BRAND site uses Ataero Retina OB Edition. Hub Direct uses that family when installed locally and bundles Manrope under the SIL Open Font License as its geometric substitute. An exact match across devices requires the licensed Ataero webfont.

Thai text uses Noto Sans Thai (bundled, SIL Open Font License), loaded only for Thai characters so Latin text keeps Manrope. Thai has no capitals and stacks tone marks above and vowels below, so under `:lang(th)` display type opens to a 1.12–1.25 line height, body to 1.6, and tracking returns to zero.

Use regular weight for display and body, with bold reserved for small labels and navigation. Set the desktop display at 70–103 px, uppercase, with 0.80 line height and tight tracking. Use 34–46 px for section and project titles and 15–18 px for left-aligned body text. Captions use 11 px, 1.4 line height, and 0.05 em tracking.

## Layout and components

- Center the layout in a 1400 px frame. Space editorial sections 76–119 px apart, with 19 px between related elements and up to 30 px inside cards.
- The top bar is a floating frosted-glass panel (translucent white, 22 px blur, white hairline edge, soft shadow) that sticks 12 px below the viewport top and its inner padding tightens evenly from 10 px to 5 px once the reader leaves the top, keeping the corner radius concentric with the pill controls. A parchment fade hides content scrolling through the gap above it. The current page is an ink pill; other links get a white glass pill on hover.
- The footer mirrors the top bar: the same frosted-glass panel, floating 12 px above the page bottom, with the brand and an 11 px uppercase tagline above a hairline, then pill links and a "Back to top" link.
- The logo mark is one ink dot inside a ring carrying three nodes (one brief, three channels), drawn inline so it takes the current text color. It sits beside a single-weight Manrope wordmark and doubles as the favicon (`app/icon.svg`). The full-height hero places a three-line headline in front of the sphere. A bottom-right scroll link disappears when the reader leaves the top of the page.
- Follow the hero with a two-column introduction, a two-row, five-column publishing index, and a featured workflow grid. The index identifies real tools and supported destinations. Workflow cards pair square white sheets and grid-paper product studies with expandable details.
- Use ghost links with a trailing arrow. Give links, buttons, and inputs a 10 px hit-area radius. Use a thin ink outline for primary form actions, with an ink fill on hover. Use square corners for product cards, lists, and images.
- Use paper and hairlines to separate surfaces. Within static dashed rings, the sphere’s colors turn beneath a soft pearl sheen. A nearby pointer draws a highlight across the surface. The sphere and its rings stay fixed behind the whole homepage: scrolling swells them off the right edge through the introduction and index, shrinks them to the lower left behind the workflow cards, and settles them right of center by the FAQ. Reduced motion presents the resting sphere. [Live motion reference](https://www.itsoffbrand.com/)

## Signed-in workspace

The overview pairs grid-paper project cards with an upcoming-post list. Project creation, channels, and brand voice pair an editorial heading on parchment with a white working sheet. Composition and review use adjacent columns for the brief, media, destinations, and captions. The schedule aligns local times and expands each row to show its destination, caption, and written delivery status.

Keep longer content in normal document flow and stack columns on narrow screens. Preserve keyboard focus, labeled media-order controls, native form validation, written error messages, and explicit scheduling confirmation.
