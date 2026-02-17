import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface HomeState {
  user: any;
}

const initialState: HomeState = {
  user: null,
};

const setUserReducer = (state: HomeState, action: PayloadAction<any>) => {
  state.user = action.payload;
};

const homeSlice = createSlice({
  name: "home",
  initialState,
  reducers: {
    setUser: setUserReducer,
  },
});

export const { setUser } = homeSlice.actions;
export default homeSlice.reducer;
