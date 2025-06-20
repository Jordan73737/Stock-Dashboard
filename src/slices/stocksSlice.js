// slices/stocksSlice.js

// handles state for stocks and favorites using redux toolkit
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// grab api base url and finnhub key from env
const API_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;
const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

// fetch all favorite stocks for the logged in user
export const fetchFavorites = createAsyncThunk(
  "stocks/fetchFavorites",
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();

      // get favorites from backend with auth header
      const response = await axios.get(`${API_URL}/favorites`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });

      // for each favorite, get live price and change data from finnhub
      const stockPromises = response.data.map(async (favorite) => {
        try {
          const stockResponse = await axios.get(
            `https://finnhub.io/api/v1/quote?symbol=${favorite.symbol}&token=${FINNHUB_API_KEY}`
          );

          return {
            id: favorite.id,
            symbol: favorite.symbol,
            name: favorite.name,
            price: stockResponse.data.c.toFixed(2), // current price
            change: (
              ((stockResponse.data.c - stockResponse.data.pc) / stockResponse.data.pc) *
              100
            ).toFixed(2), // percentage change
            favorite: true,
            highlight: false,
          };
        } catch (err) {
          // fallback if finnhub fails for that stock
          return {
            id: favorite.id,
            symbol: favorite.symbol,
            name: favorite.name,
            price: "0.00",
            change: "0.00",
            favorite: true,
            highlight: false,
            error: true,
          };
        }
      });

      // wait for all quotes to resolve
      const stocks = await Promise.all(stockPromises);
      return stocks;
    } catch (error) {
      // fallback if backend request fails
      return rejectWithValue(
        error.response?.data?.error || "Failed to fetch favorites"
      );
    }
  }
);

// add a new favorite stock for the user
export const addFavorite = createAsyncThunk(
  "stocks/addFavorite",
  async ({ symbol, name }, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      await axios.post(
        `${API_URL}/favorites`,
        { symbol, name },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      return { symbol, name };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to add favorite"
      );
    }
  }
);

// remove a favorite stock
export const removeFavorite = createAsyncThunk(
  "stocks/removeFavorite",
  async (symbol, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      await axios.delete(`${API_URL}/favorites/${symbol}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      return symbol;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to remove favorite"
      );
    }
  }
);

// toggle favorite status based on current state
export const toggleFavorite =
  (symbol, name, isCurrentlyFavorite) => async (dispatch) => {
    try {
      console.log("Toggling favorite:", symbol, "Currently:", isCurrentlyFavorite);
      if (isCurrentlyFavorite) {
        await dispatch(removeFavorite(symbol)).unwrap();
      } else {
        await dispatch(addFavorite({ symbol, name })).unwrap();
      }

      // refresh favorites after toggling to update the ui
      await dispatch(fetchFavorites());
    } catch (error) {
      console.error("Toggle favorite failed:", error);
    }
  };

// initial slice state
const initialState = {
  stocks: [], // holds current stock data
  favorites: [], // just the favorite stocks
  loading: false,
  error: null,
  searchResults: [], // used for search bar results
  isSearching: false,
};

// redux slice for stocks
const stocksSlice = createSlice({
  name: "stocks",
  initialState,
  reducers: {
    // set results from stock search
    setSearchResults: (state, action) => {
      state.searchResults = action.payload;
    },
    // toggle if the user is currently searching
    setIsSearching: (state, action) => {
      state.isSearching = action.payload;
    },
    // clear out search results (usually when search box is empty)
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
    // manually highlight a stock (for flashing price change or animation)
    updateStockHighlight: (state, action) => {
      const { id, highlight } = action.payload;
      const stock = state.stocks.find((s) => s.id === id);
      if (stock) stock.highlight = highlight;
    },
    // update stock price + change value (used during live updates)
    updateStockPrice: (state, action) => {
      const { id, price, change, highlight } = action.payload;
      const stock = state.stocks.find((s) => s.id === id);
      if (stock) {
        stock.price = price;
        stock.change = change;
        stock.highlight = highlight;
      }
    },
    // update just the favorite flag on a stock
    updateFavoriteStatus: (state, action) => {
      const { symbol, favorite } = action.payload;
      const stock = state.stocks.find((s) => s.symbol === symbol);
      if (stock) {
        stock.favorite = favorite;
      }
    },
    // replace the whole stock list (used after searching or initial load)
    setStocks: (state, action) => {
      state.stocks = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // when fetching favorites
      .addCase(fetchFavorites.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFavorites.fulfilled, (state, action) => {
        state.loading = false;
        state.stocks = action.payload;
        state.favorites = action.payload;
      })
      .addCase(fetchFavorites.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // side effect only - just logging, no state change
      .addCase(addFavorite.fulfilled, () => {
        console.log("Successfully added to favorites");
      })

      // remove from local state after backend delete
      .addCase(removeFavorite.fulfilled, (state, action) => {
        console.log("Successfully removed from favorites:", action.payload);
        const stock = state.stocks.find((s) => s.symbol === action.payload);
        if (stock) stock.favorite = false;
      });
  },
});

// export actions for dispatching in components
export const {
  setSearchResults,
  setIsSearching,
  clearSearchResults,
  updateStockHighlight,
  updateStockPrice,
  updateFavoriteStatus,
  setStocks,
} = stocksSlice.actions;

// export the reducer for the store
export default stocksSlice.reducer;
