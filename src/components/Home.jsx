import React, { useEffect, useState } from "react";
import axios from "axios";
import TradeSidebar from "./TradeSidebar";
import { toggleFavorite, fetchFavorites } from "../slices/stocksSlice";
import { useDispatch, useSelector } from "react-redux";

// This component shows the main "Popular Stocks" screen with buying/selling and favoriting
const Home = () => {
  // State to hold fetched stock data
  const [rawStocks, setRawStocks] = useState([]);

  // How many rows (stocks) to show in the table
  const [visibleRows, setVisibleRows] = useState(10);

  // Currently selected stock for trading (buy/sell)
  const [selectedStock, setSelectedStock] = useState(null);
  const [tradeMode, setTradeMode] = useState(null);

  // User's holdings (used for advanced features or display)
  const [holdings, setHoldings] = useState([]);

  // Redux setup to handle favorites
  const dispatch = useDispatch();
  const favorites = useSelector((state) => state.stocks.favorites || []);

  // Log favorites whenever they update
  useEffect(() => {
    console.log("Favorites updated in Redux:", favorites);
  }, [favorites]);

  // Listen for balance updates (e.g., after a trade) and optionally refresh
  useEffect(() => {
    const updateBalance = async () => {
      // You could add logic here to refresh balance or other UI updates
    };
    window.addEventListener("balanceUpdated", updateBalance);
    return () => window.removeEventListener("balanceUpdated", updateBalance);
  }, []);

  // Fetch popular stock data from the backend
  const fetchPopularStocks = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/api/popular-stocks`
      );
      setRawStocks(response.data);
    } catch (error) {
      console.error("Failed to fetch stock data", error);
    }
  };

  // Fetch stock data on first component load
  useEffect(() => {
    fetchPopularStocks();
  }, []);

  // Re-fetch popular stocks and favorites when balance changes
  useEffect(() => {
    const handleBalanceUpdate = () => {
      fetchPopularStocks();
      dispatch(fetchFavorites());
    };

    window.addEventListener("balanceUpdated", handleBalanceUpdate);
    return () =>
      window.removeEventListener("balanceUpdated", handleBalanceUpdate);
  }, [dispatch]);

  // Get auth token from localStorage
  const token = localStorage.getItem("token");

  // Fetch the user's current holdings
  useEffect(() => {
    const fetchHoldings = () => {
      axios
        .get(`${import.meta.env.VITE_API_BASE_URL}/api/holdings`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setHoldings(res.data))
        .catch(console.error);
    };

    fetchHoldings(); // initial fetch

    // Refresh holdings whenever "holdingsUpdated" event is fired
    window.addEventListener("holdingsUpdated", fetchHoldings);

    return () => window.removeEventListener("holdingsUpdated", fetchHoldings);
  }, []);

  // Duplicate fetch of popular stocks on mount — could be removed for optimization
  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/api/popular-stocks`
        );
        setRawStocks(response.data);
      } catch (error) {
        console.error("Failed to fetch stock data", error);
      }
    };

    fetchStocks();
  }, []);

  // Fetch favorites from Redux when component loads
  useEffect(() => {
    dispatch(fetchFavorites());
  }, [dispatch]);

  // Add `favorite: true/false` to each stock based on user's favorites
  const enrichedStocks = rawStocks.map((stock) => ({
    ...stock,
    favorite: favorites.some((f) => f.symbol === stock.symbol),
  }));

  // Trigger the sidebar to open with the selected stock and mode (buy/sell)
  const openTradeSidebar = (stock, mode) => {
    setSelectedStock(stock);
    setTradeMode(mode);
  };

  // Close the trade sidebar
  const closeSidebar = () => {
    setSelectedStock(null);
    setTradeMode(null);
  };

  // Toggle a stock as a favorite/unfavorite
  const handleToggleFavorite = async (symbol, name, isCurrentlyFavorite) => {
    console.log(
      "Toggling favorite:",
      symbol,
      "Currently:",
      isCurrentlyFavorite
    );
    await dispatch(toggleFavorite(symbol, name, isCurrentlyFavorite));
    await dispatch(fetchFavorites()); // refresh UI
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-center">Popular Stocks</h2>

      {/* Stock Table */}
      <table className="w-full text-sm border">
        <thead className="bg-gray-200">
          <tr>
            <th className="py-2 px-4 text-center">Company</th>
            <th className="py-2 px-4 text-center">Change %</th>
            <th className="py-2 px-4 text-center">Sell</th>
            <th className="py-2 px-4 text-center">Buy</th>
            <th className="py-2 px-4 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {enrichedStocks.slice(0, visibleRows).map((stock, index) => (
            <tr key={index} className="border-b text-center">
              <td className="py-2 px-4">{stock.name}</td>
              <td className="py-2 px-4">{stock.change}</td>
              <td className="py-2 px-4">{stock.sell}</td>
              <td className="py-2 px-4">{stock.buy}</td>
              <td className="py-2 px-4 space-x-2">
                {/* Buy Button */}
                <button
                  onClick={() => openTradeSidebar(stock, "buy")}
                  className="bg-green-600 text-white px-2 py-1 rounded">
                  Buy
                </button>
                {/* Sell Button */}
                <button
                  onClick={() => openTradeSidebar(stock, "sell")}
                  className="bg-red-600 text-white px-2 py-1 rounded">
                  Sell
                </button>
                {/* Favorite Toggle */}
                <button
                  onClick={() =>
                    handleToggleFavorite(
                      stock.symbol,
                      stock.name,
                      stock.favorite
                    )
                  }
                  className="w-6 h-6">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill={stock.favorite ? "currentColor" : "none"}
                    stroke="currentColor"
                    className={`w-6 h-6 mt-1 ${
                      stock.favorite ? "text-yellow-400" : "text-gray-400"
                    }`}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={stock.favorite ? 0 : 1.5}
                      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                    />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Sidebar for trading stocks */}
      <TradeSidebar
        isOpen={!!selectedStock}
        onClose={closeSidebar}
        stock={selectedStock}
        mode={tradeMode}
        onSuccess={(msg) => {
          console.log(msg);
          window.dispatchEvent(new Event("balanceUpdated")); // triggers refresh
        }}
      />
    </div>
  );
};

export default Home;
