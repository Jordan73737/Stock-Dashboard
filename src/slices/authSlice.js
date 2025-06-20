// slices/authSlice.js

// setting up redux toolkit slice for auth state management
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// grabbing base api url from env
const API_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;

// async thunk for logging in a user
export const login = createAsyncThunk(
  "auth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      // post to backend login route
      const response = await axios.post(`${API_URL}/login`, {
        email,
        password,
      });

      // store token and email in localstorage
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("email", response.data.email);

      // return user data to reducer
      return response.data;
    } catch (error) {
      // pass back error from backend to show in ui
      return rejectWithValue(error.response.data.error);
    }
  }
);

// async thunk for registering a new user
export const register = createAsyncThunk(
  "auth/register",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      // post to backend register route
      const response = await axios.post(`${API_URL}/register`, {
        email,
        password,
      });

      // store token and email in localstorage
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("email", response.data.email);

      // return user data to reducer
      return response.data;
    } catch (error) {
      // pass back error from backend to show in ui
      return rejectWithValue(error.response.data.error);
    }
  }
);

// async thunk for logging out a user
export const logout = createAsyncThunk("auth/logout", async () => {
  // just clearing out localstorage
  localStorage.removeItem("token");
  localStorage.removeItem("email");
  return null;
});

// initial auth state pulled from localstorage (so auth persists on refresh)
const initialState = {
  token: localStorage.getItem("token"),
  email: localStorage.getItem("email"),
  isAuthenticated: !!localStorage.getItem("token"),
  loading: false,
  error: null,
};

// creating the actual auth slice
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // simple reducer to clear error manually
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // login flow
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.email = action.payload.email;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // register flow
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.email = action.payload.email;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // logout just resets everything
      .addCase(logout.fulfilled, (state) => {
        state.token = null;
        state.email = null;
        state.isAuthenticated = false;
      });
  },
});

// export actions and reducer for use in store
export const { clearError } = authSlice.actions;
export default authSlice.reducer;
