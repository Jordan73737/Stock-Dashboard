// slices/stocksSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;

const FINNHUB_API_KEY = "cv9n049r01qpd9s86e70cv9n049r01qpd9s86e7g";

export const fetchFavorites = createAsyncThunk(
  "stocks/fetchFavorites",
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const response = await axios.get(`${API_URL}/favorites`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });

      const stockPromises = response.data.map(async (favorite) => {
        try {
          const stockResponse = await axios.get(
            `https://finnhub.io/api/v1/quote?symbol=${favorite.symbol}&token=${FINNHUB_API_KEY}`
          );

          return {
            id: favorite.id,
            symbol: favorite.symbol,
            name: favorite.name,
            price: stockResponse.data.c.toFixed(2),
            change: (
              ((stockResponse.data.c - stockResponse.data.pc) /
                stockResponse.data.pc) *
              100
            ).toFixed(2),
            favorite: true,
            highlight: false,
          };
        } catch (err) {
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

      const stocks = await Promise.all(stockPromises);
      return stocks;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Failed to fetch favorites"
      );
    }
  }
);

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

export const toggleFavorite =
  (symbol, name, isCurrentlyFavorite) => async (dispatch) => {
    try {
      console.log(
        "Toggling favorite:",
        symbol,
        "Currently:",
        isCurrentlyFavorite
      );
      if (isCurrentlyFavorite) {
        await dispatch(removeFavorite(symbol)).unwrap();
      } else {
        await dispatch(addFavorite({ symbol, name })).unwrap();
      }

      // ✅ Update Redux favorites so Home.jsx re-renders
      await dispatch(fetchFavorites());
    } catch (error) {
      console.error("Toggle favorite failed:", error);
    }
  };

const initialState = {
  stocks: [],
  favorites: [],
  loading: false,
  error: null,
  searchResults: [],
  isSearching: false,
};

const stocksSlice = createSlice({
  name: "stocks",
  initialState,
  reducers: {
    setSearchResults: (state, action) => {
      state.searchResults = action.payload;
    },
    setIsSearching: (state, action) => {
      state.isSearching = action.payload;
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
    updateStockHighlight: (state, action) => {
      const { id, highlight } = action.payload;
      const stock = state.stocks.find((s) => s.id === id);
      if (stock) stock.highlight = highlight;
    },
    updateStockPrice: (state, action) => {
      const { id, price, change, highlight } = action.payload;
      const stock = state.stocks.find((s) => s.id === id);
      if (stock) {
        stock.price = price;
        stock.change = change;
        stock.highlight = highlight;
      }
    },
    updateFavoriteStatus: (state, action) => {
      const { symbol, favorite } = action.payload;
      const stock = state.stocks.find((s) => s.symbol === symbol);
      if (stock) {
        stock.favorite = favorite;
      }
    },
    setStocks: (state, action) => {
      state.stocks = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
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
      .addCase(addFavorite.fulfilled, () => {
        console.log("Successfully added to favorites");
      })
      .addCase(removeFavorite.fulfilled, (state, action) => {
        console.log("Successfully removed from favorites:", action.payload);
        const stock = state.stocks.find((s) => s.symbol === action.payload);
        if (stock) stock.favorite = false;
      });
  },
});

export const {
  setSearchResults,
  setIsSearching,
  clearSearchResults,
  updateStockHighlight,
  updateStockPrice,
  updateFavoriteStatus,
  setStocks,
} = stocksSlice.actions;

export default stocksSlice.reducer;
