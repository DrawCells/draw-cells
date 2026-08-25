// Tool definitions sent to the model. These are pure data so the server route
// can import them without pulling in any browser-only code — the matching
// executors live in `executor.ts` and run in the browser, where the store is.
//
// Phase 1 surface: find a sprite, place a sprite, place a label. Everything else
// (moving, styling, frames, animation) comes in Phase 2.

export const SEARCH_SPRITES = "search_sprites";
export const ADD_SPRITE = "add_sprite";
export const ADD_TEXT = "add_text";

export interface SearchSpritesInput {
  query: string;
}

export interface AddSpriteInput {
  image_url: string;
  name?: string;
  x: number;
  y: number;
  size?: number;
}

export interface AddTextInput {
  text: string;
  x: number;
  y: number;
  font_size?: number;
  color?: string;
}

export const AI_TOOLS = [
  {
    name: SEARCH_SPRITES,
    // Deliberately prescriptive about *when* to call: the catalogue is far too
    // large to list in the prompt, and a guessed image_url silently produces a
    // broken sprite rather than an error.
    description:
      "Search the sprite catalogue by name or tag (e.g. 'neuron', 'mitochondrion', " +
      "'virus'). Returns matching sprites with the image_url needed by add_sprite. " +
      "You MUST call this before every add_sprite and use an image_url exactly as " +
      "returned — never invent, guess, or modify one. If a search returns nothing " +
      "useful, try a broader biological term before giving up.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "A single term describing the thing to draw, e.g. 'neuron'. Prefer one " +
            "concept per search; search again rather than combining terms.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: ADD_SPRITE,
    description:
      "Place a catalogue sprite on the current frame. The image_url must come " +
      "from a search_sprites result.",
    input_schema: {
      type: "object" as const,
      properties: {
        image_url: {
          type: "string",
          description: "image_url copied verbatim from a search_sprites result.",
        },
        name: {
          type: "string",
          description:
            "The sprite's name from the search result. Used for labelling only.",
        },
        x: {
          type: "number",
          description: "Centre X on the canvas. The canvas is 810 wide.",
        },
        y: {
          type: "number",
          description: "Centre Y on the canvas. The canvas is 540 tall.",
        },
        size: {
          type: "number",
          description:
            "Approximate size in pixels of the sprite's shorter side. Defaults " +
            "to 50. The other side is derived from the image's aspect ratio.",
        },
      },
      required: ["image_url", "x", "y"],
    },
  },
  {
    name: ADD_TEXT,
    description:
      "Place a text box on the current frame — captions, labels, and titles.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "The text to display." },
        x: { type: "number", description: "Centre X of the text box." },
        y: { type: "number", description: "Centre Y of the text box." },
        font_size: {
          type: "number",
          description: "Font size in pixels. Defaults to 24.",
        },
        color: {
          type: "string",
          description: "Hex colour such as '#000000'. Defaults to black.",
        },
      },
      required: ["text", "x", "y"],
    },
  },
];
