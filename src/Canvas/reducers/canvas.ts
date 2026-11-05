import { Actions } from '../actions'
import { Actions as FramesActions } from '../../Frames/actions'
import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from '../../constants'

const initialState: CanvasState = {
  scale: 1,
  width: DEFAULT_CANVAS_WIDTH,
  height: DEFAULT_CANVAS_HEIGHT,
}

interface Action {
  type: string,
  payload: any,
}

export interface CanvasState {
  scale: number
  // Size of the presentation's canvas (the white viewport), in canvas units.
  width: number
  height: number
}

export const canvas = (state: CanvasState = initialState, action: Action): CanvasState => {
  const {type, payload} = action
  switch(type){
    case Actions.SET_CANVAS_SCALE: {
      if (state.scale + payload.scaleIncrease < 0.5) return state
      if (state.scale + payload.scaleIncrease > 1) return state
      return {
        ...state,
        scale: state.scale + payload.scaleIncrease
      }
    }
    case Actions.SET_CANVAS_SIZE: {
      return {
        ...state,
        width: payload.width,
        height: payload.height,
      }
    }
    // The presentation load carries its canvas size alongside the frames.
    case FramesActions.SET_INITIAL_DATA: {
      const data = payload || {}
      return {
        ...state,
        width: data.canvasWidth || DEFAULT_CANVAS_WIDTH,
        height: data.canvasHeight || DEFAULT_CANVAS_HEIGHT,
      }
    }
    default:
      return state
  }
}
