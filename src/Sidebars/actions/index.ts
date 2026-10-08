export const Actions = {
  TOGGLE_SPRITES: "TOGGLE_SPRITES",
  SET_LEFT_PANEL: "SET_LEFT_PANEL",
  TOGGLE_FRAMES: "TOGGLE_FRAMES",
  TOGGLE_PROPERTIES: "TOGGLE_PROPERTIES",
  TOGGLE_AI_CHAT: "TOGGLE_AI_CHAT",
  SET_AI_BUSY: "SET_AI_BUSY",
  LOAD_BACKGROUNDS: "LOAD_BACKGROUNDS",
  LOAD_SPRITES: "LOAD_SPRITES",
};

export type LeftPanel = "sprites" | "backgrounds";

export const toggleSprites = () => ({
  type: Actions.TOGGLE_SPRITES,
});

// Opens the given left-rail panel, or closes it if it is already active.
export const setLeftPanel = (panel: LeftPanel) => ({
  type: Actions.SET_LEFT_PANEL,
  payload: panel,
});

export const toggleFrames = () => ({
  type: Actions.TOGGLE_FRAMES,
});

export const toggleProperties = () => ({
  type: Actions.TOGGLE_PROPERTIES,
});

// Drives both the chat column and the editor's card layout, so it lives in the
// store rather than in the panel: the header button toggles it too.
export const toggleAiChat = () => ({
  type: Actions.TOGGLE_AI_CHAT,
});

// True while an AI turn is editing the presentation. The editor locks while it
// is set: the turn reads the canvas between tool calls, and a user edit landing
// mid-turn would also be folded into the turn's single undo step.
export const setAiBusy = (busy: boolean) => ({
  type: Actions.SET_AI_BUSY,
  payload: busy,
});

export const loadBackgrounds = (payload: {
  backgrounds: Array<any>;
  hasEnded?: boolean;
}) => ({
  type: Actions.LOAD_BACKGROUNDS,
  payload,
});

export const loadSprites = (payload: {
  sprites: Array<any>;
  hasEnded?: boolean;
}) => ({
  type: Actions.LOAD_SPRITES,
  payload,
});
