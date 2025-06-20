// store.js

// importing the redux toolkit store creator
import { configureStore } from "@reduxjs/toolkit";

// importing the reducers from the slices
import authReducer from "./slices/authSlice";
import stocksReducer from "./slices/stocksSlice";

// Building the redux store store and combining the auth + stocks slices
// Redux uses thid store.js file to figure out which slice/reducers should handle certain actions
export const store = configureStore({
  reducer: {
    // the reducer key is to define how the global state is split up
    // each key (auth, stocks) becomes a "slice" of the global redux state
    auth: authReducer,
    stocks: stocksReducer
  },
});
