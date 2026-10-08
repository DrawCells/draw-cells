// Tool definitions sent to the model. These are pure data so the server route
// can import them without pulling in any browser-only code — the matching
// executors live in `executor.ts` and run in the browser, where the store is.
//
// Phase 1: find, place, label. Phase 2: edit, animate, frames, z-order,
// grouping, backgrounds. Sprite-editing tools only ever act on the CURRENT
// frame, because that is what the underlying reducer cases do — the executor
// rejects handles from other frames with a message telling the model to switch.

export const SEARCH_SPRITES = "search_sprites";
export const ADD_SPRITE = "add_sprite";
export const ADD_TEXT = "add_text";
export const UPDATE_SPRITES = "update_sprites";
export const DELETE_SPRITES = "delete_sprites";
export const SET_ANIMATION = "set_animation";
export const ADD_FRAME = "add_frame";
export const SWITCH_FRAME = "switch_frame";
export const COPY_SPRITES_TO_FRAME = "copy_sprites_to_frame";
export const ARRANGE_SPRITES = "arrange_sprites";
export const GROUP_SPRITES = "group_sprites";
export const UNGROUP_SPRITES = "ungroup_sprites";
export const LIST_BACKGROUNDS = "list_backgrounds";
export const SET_FRAME_BACKGROUND = "set_frame_background";

export interface SearchSpritesInput {
  query: string;
}

export interface AddSpriteInput {
  image_url: string;
  name?: string;
  variant?: string;
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

export interface SpriteEdit {
  sprite: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  text?: string;
  font_size?: number;
  color?: string;
}

export interface UpdateSpritesInput {
  edits: SpriteEdit[];
}

export interface DeleteSpritesInput {
  sprites: string[];
  from_all_frames?: boolean;
}

export interface SetAnimationInput {
  sprites: string[];
  type?: "LINEAR" | "CHAOTIC" | "CIRCULAR";
  duration?: number;
  range_of_movement?: number;
  iterations?: number;
  arc_angle?: number;
  arc_direction?: "up" | "down";
}

export interface AddFrameInput {
  copy_sprites?: boolean;
}

export interface SwitchFrameInput {
  frame: string | number;
}

export interface CopySpritesToFrameInput {
  sprites: string[];
  frame: string | number;
}

export interface ArrangeSpritesInput {
  sprites: string[];
  to: "front" | "back";
}

export interface GroupSpritesInput {
  sprites: string[];
}

export interface SetFrameBackgroundInput {
  path: string;
}

// Shared schema fragments. A sprite is always addressed by the handle shown in
// the presentation state, never by name or position.
const SPRITE_HANDLE = {
  type: "string",
  description: "A sprite handle from the presentation state, e.g. '3f2a9c1b'.",
};

const SPRITE_HANDLES = {
  type: "array",
  items: SPRITE_HANDLE,
  minItems: 1,
  description: "Handles of sprites on the current frame.",
};

const FRAME_REF = {
  type: ["string", "integer"],
  description:
    "The frame's handle (id=… in the presentation state) or its 1-based " +
    "position, e.g. 2 for the second frame.",
};

export const AI_TOOLS = [
  {
    name: SEARCH_SPRITES,
    // Deliberately prescriptive about *when* to call: the catalogue is far too
    // large to list in the prompt, and a guessed image_url silently produces a
    // broken sprite rather than an error.
    description:
      "Search the sprite catalogue by name or tag (e.g. 'neuron', 'mitochondrion', " +
      "'virus'). Returns matching sprites with the image_url needed by add_sprite, " +
      "and any variants the sprite comes in. You MUST call this before every " +
      "add_sprite and use an image_url exactly as returned — never invent, guess, " +
      "or modify one. If a search returns nothing useful, try a broader biological " +
      "term before giving up.",
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
      "from a search_sprites result. Returns the new sprite's handle.",
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
            "The sprite's name from the search result. Stored on the sprite so it " +
            "reads well in the presentation state.",
        },
        variant: {
          type: "string",
          description:
            "One of the variants listed for this sprite in the search result. " +
            "Omit to use the default (first) variant.",
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
      "Place a text box on the current frame — captions, labels, and titles. " +
      "Returns the new sprite's handle.",
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
  {
    // One tool for move / resize / rotate / restyle rather than one per
    // property: a rearrangement touches several sprites at once, and a single
    // call is a single reducer pass and a single undo step.
    name: UPDATE_SPRITES,
    description:
      "Move, resize, rotate, fade, or restyle sprites on the current frame. Pass " +
      "one edit per sprite with only the fields to change; everything else is " +
      "kept. All edits apply together as one undo step.",
    input_schema: {
      type: "object" as const,
      properties: {
        edits: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              sprite: SPRITE_HANDLE,
              x: { type: "number", description: "New centre X." },
              y: { type: "number", description: "New centre Y." },
              width: {
                type: "number",
                description:
                  "New width in pixels. For an image, giving only width (or " +
                  "only height) keeps the aspect ratio.",
              },
              height: { type: "number", description: "New height in pixels." },
              rotation: {
                type: "number",
                description: "Rotation in degrees, clockwise.",
              },
              opacity: {
                type: "number",
                description: "0 (invisible) to 1 (opaque).",
              },
              text: {
                type: "string",
                description: "Text sprites only: replacement text.",
              },
              font_size: {
                type: "number",
                description: "Text sprites only: font size in pixels.",
              },
              color: {
                type: "string",
                description:
                  "Hex colour. Text colour for text sprites, line colour for " +
                  "arrows. Not applicable to images.",
              },
            },
            required: ["sprite"],
          },
        },
      },
      required: ["edits"],
    },
  },
  {
    name: DELETE_SPRITES,
    description:
      "Remove sprites from the current frame, or from every frame they appear " +
      "in. Only delete what the user asked to remove.",
    input_schema: {
      type: "object" as const,
      properties: {
        sprites: SPRITE_HANDLES,
        from_all_frames: {
          type: "boolean",
          description:
            "Also remove the same sprites from every other frame. Defaults to " +
            "false (current frame only).",
        },
      },
      required: ["sprites"],
    },
  },
  {
    name: SET_ANIMATION,
    description:
      "Set how sprites on the current frame move to their position in the NEXT " +
      "frame. Only takes effect for sprites that also exist in the next frame. " +
      "LINEAR moves in a straight line; CHAOTIC jitters along the way (diffusion, " +
      "Brownian motion); CIRCULAR travels along an arc.",
    input_schema: {
      type: "object" as const,
      properties: {
        sprites: SPRITE_HANDLES,
        type: {
          type: "string",
          enum: ["LINEAR", "CHAOTIC", "CIRCULAR"],
          description: "Motion style. Omit to keep the current one.",
        },
        duration: {
          type: "number",
          description: "Seconds the transition takes. Default 1.",
        },
        range_of_movement: {
          type: "number",
          description:
            "CHAOTIC only: how far each jitter may stray from the straight path, " +
            "in pixels (10–500). Default 40.",
        },
        iterations: {
          type: "integer",
          description:
            "CHAOTIC only: number of jitter steps (1–30). More steps look busier.",
        },
        arc_angle: {
          type: "number",
          description:
            "CIRCULAR only: how curved the arc is, in degrees (1–359). 90 is a " +
            "quarter circle, 180 a semicircle. Default 90.",
        },
        arc_direction: {
          type: "string",
          enum: ["up", "down"],
          description: "CIRCULAR only: which side the arc bulges towards.",
        },
      },
      required: ["sprites"],
    },
  },
  {
    name: ADD_FRAME,
    description:
      "Insert a new frame right after the current one and make it current. By " +
      "default it starts as a copy of the current frame — same sprites, same " +
      "handles — which is how you animate: move the copies in the new frame and " +
      "they glide there from their old positions.",
    input_schema: {
      type: "object" as const,
      properties: {
        copy_sprites: {
          type: "boolean",
          description:
            "Start from a copy of the current frame's sprites. Defaults to true. " +
            "Pass false for an empty frame (a new scene with no motion from the " +
            "previous one).",
        },
      },
    },
  },
  {
    name: SWITCH_FRAME,
    description:
      "Make another frame current, so the sprite tools act on it and its " +
      "sprites are listed in full in the presentation state.",
    input_schema: {
      type: "object" as const,
      properties: { frame: FRAME_REF },
      required: ["frame"],
    },
  },
  {
    name: COPY_SPRITES_TO_FRAME,
    description:
      "Copy sprites from the current frame into another existing frame, keeping " +
      "their handles so they animate between the two frames if adjacent. Skips " +
      "sprites the target frame already has.",
    input_schema: {
      type: "object" as const,
      properties: {
        sprites: SPRITE_HANDLES,
        frame: FRAME_REF,
      },
      required: ["sprites", "frame"],
    },
  },
  {
    name: ARRANGE_SPRITES,
    description:
      "Bring sprites to the front or send them to the back of the current frame.",
    input_schema: {
      type: "object" as const,
      properties: {
        sprites: SPRITE_HANDLES,
        to: { type: "string", enum: ["front", "back"] },
      },
      required: ["sprites", "to"],
    },
  },
  {
    name: GROUP_SPRITES,
    description:
      "Group two or more sprites so the user can select and drag them together. " +
      "Use for a sprite and its label, or the parts of one composite object.",
    input_schema: {
      type: "object" as const,
      properties: {
        sprites: { ...SPRITE_HANDLES, minItems: 2 },
      },
      required: ["sprites"],
    },
  },
  {
    name: UNGROUP_SPRITES,
    description:
      "Dissolve the groups the given sprites belong to, in every frame.",
    input_schema: {
      type: "object" as const,
      properties: { sprites: SPRITE_HANDLES },
      required: ["sprites"],
    },
  },
  {
    name: LIST_BACKGROUNDS,
    description:
      "List the available frame background images. Call before " +
      "set_frame_background.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: SET_FRAME_BACKGROUND,
    description:
      "Set the current frame's background image, or clear it with an empty path.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            "A path copied verbatim from list_backgrounds, or '' to clear.",
        },
      },
      required: ["path"],
    },
  },
];
