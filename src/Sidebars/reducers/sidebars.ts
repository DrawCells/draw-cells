import { PayloadAction } from "@reduxjs/toolkit";
import { Actions, LeftPanel } from "../actions";

const initialState: SidebarsState = {
  isSpritesOpen: false,
  activeLeftPanel: null,
  isFramesOpen: false,
  isPropertiesOpen: false,
  isAiChatOpen: false,
  backgrounds: {
    list: [],
    hasEnded: false,
  },
  sprites: {
    list: [],
    hasEnded: false,
  },
};

export interface SidebarsState {
  // True when any left-rail panel is open. Kept in sync with activeLeftPanel so
  // the canvas/frames layout (which only needs a boolean) stays unchanged.
  isSpritesOpen: boolean;
  activeLeftPanel: LeftPanel | null;
  isFramesOpen: boolean;
  isPropertiesOpen: boolean;
  // Opening the AI chat also switches the editor into its card layout.
  isAiChatOpen: boolean;
  backgrounds: {
    list: Array<any>;
    hasEnded: boolean;
  };
  sprites: {
    list: Array<any>;
    hasEnded: boolean;
  };
}

export const sidebars = (
  state: SidebarsState = initialState,
  action: PayloadAction<any>,
): SidebarsState => {
  const { type } = action;
  switch (type) {
    case Actions.TOGGLE_SPRITES:
      return {
        ...state,
        isSpritesOpen: !state.isSpritesOpen,
      };
    case Actions.SET_LEFT_PANEL: {
      const nextPanel =
        state.activeLeftPanel === action.payload ? null : action.payload;
      return {
        ...state,
        activeLeftPanel: nextPanel,
        isSpritesOpen: nextPanel !== null,
      };
    }
    case Actions.TOGGLE_PROPERTIES:
      return {
        ...state,
        isPropertiesOpen: !state.isPropertiesOpen,
      };
    case Actions.TOGGLE_FRAMES:
      return {
        ...state,
        isFramesOpen: !state.isFramesOpen,
      };
    case Actions.TOGGLE_AI_CHAT:
      return {
        ...state,
        isAiChatOpen: !state.isAiChatOpen,
      };
    case Actions.LOAD_BACKGROUNDS:
      return {
        ...state,
        backgrounds: {
          list: [
            ...(state.backgrounds?.list || []),
            ...(action.payload.backgrounds || []),
          ],
          hasEnded: action.payload.hasEnded,
        },
      };
    case Actions.LOAD_SPRITES:
      return {
        ...state,
        sprites: {
          list: [
            ...(state.sprites?.list || []),
            ...(action.payload.sprites || []),
          ],
          hasEnded: action.payload.hasEnded,
        },
      };
    default:
      return state;
  }
};
