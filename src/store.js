// store.js
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import stocksReducer from "./slices/stocksSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    stocks: stocksReducer,
  },
});
