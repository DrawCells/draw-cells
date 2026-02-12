import { PayloadAction } from "@reduxjs/toolkit";
import { Actions } from "../actions";

const initialState: SidebarsState = {
  isSpritesOpen: false,
  isFramesOpen: false,
  isPropertiesOpen: false,
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
  isSpritesOpen: boolean;
  isFramesOpen: boolean;
  isPropertiesOpen: boolean;
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
