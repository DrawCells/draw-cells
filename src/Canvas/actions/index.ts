export const Actions = {
  SET_CANVAS_SCALE: 'SET_CANVAS_SCALE',
  SET_CANVAS_SIZE: 'SET_CANVAS_SIZE',
}

export const zoomIn = () => ({
  type: Actions.SET_CANVAS_SCALE,
  payload: {scaleIncrease: 0.01},
})

export const zoomOut = () => ({
  type: Actions.SET_CANVAS_SCALE,
  payload: {scaleIncrease: -0.01},
})

export const setCanvasSize = (width: number, height: number) => ({
  type: Actions.SET_CANVAS_SIZE,
  payload: {width, height},
})
