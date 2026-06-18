export const Actions = {
  TOGGLE_SPRITES: "TOGGLE_SPRITES",
  SET_LEFT_PANEL: "SET_LEFT_PANEL",
  TOGGLE_FRAMES: "TOGGLE_FRAMES",
  TOGGLE_PROPERTIES: "TOGGLE_PROPERTIES",
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
