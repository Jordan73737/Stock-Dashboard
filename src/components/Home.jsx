import React, { useEffect, useState } from "react";
import axios from "axios";
import TradeSidebar from "./TradeSidebar";
import { toggleFavorite, fetchFavorites } from "../slices/stocksSlice";
import { useDispatch, useSelector } from "react-redux";

const Home = () => {
  const [rawStocks, setRawStocks] = useState([]);
  const [visibleRows, setVisibleRows] = useState(10);
  const [selectedStock, setSelectedStock] = useState(null);
  const [tradeMode, setTradeMode] = useState(null);
  const [holdings, setHoldings] = useState([]);

  const dispatch = useDispatch();
  const favorites = useSelector((state) => state.stocks.favorites || []);
  useEffect(() => {
    console.log("Favorites updated in Redux:", favorites);
  }, [favorites]);

  // Listens for balanceUpdated
  useEffect(() => {
    const updateBalance = async () => {
      // Refetch or update UI state
    };
    window.addEventListener("balanceUpdated", updateBalance);
    return () => window.removeEventListener("balanceUpdated", updateBalance);
  }, []);

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

  useEffect(() => {
    fetchPopularStocks();
  }, []);

  useEffect(() => {
    const handleBalanceUpdate = () => {
      fetchPopularStocks();
      dispatch(fetchFavorites());
    };

    window.addEventListener("balanceUpdated", handleBalanceUpdate);
    return () =>
      window.removeEventListener("balanceUpdated", handleBalanceUpdate);
  }, [dispatch]);

  const token = localStorage.getItem("token");

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

    window.addEventListener("holdingsUpdated", fetchHoldings);

    return () => window.removeEventListener("holdingsUpdated", fetchHoldings);
  }, []);

  // 1. Fetch stocks only once
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

  // 2. Fetch favorites only once
  useEffect(() => {
    dispatch(fetchFavorites());
  }, [dispatch]);

  // 3. Combine stocks and favorite status
  const enrichedStocks = rawStocks.map((stock) => ({
    ...stock,
    favorite: favorites.some((f) => f.symbol === stock.symbol),
  }));

  const openTradeSidebar = (stock, mode) => {
    setSelectedStock(stock);
    setTradeMode(mode);
  };

  const closeSidebar = () => {
    setSelectedStock(null);
    setTradeMode(null);
  };

  const handleToggleFavorite = async (symbol, name, isCurrentlyFavorite) => {
    console.log(
      "Toggling favorite:",
      symbol,
      "Currently:",
      isCurrentlyFavorite
    );
    await dispatch(toggleFavorite(symbol, name, isCurrentlyFavorite));
    await dispatch(fetchFavorites()); // ensures enrichedStocks gets new data
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-center">Popular Stocks</h2>

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
                <button
                  onClick={() => openTradeSidebar(stock, "buy")}
                  className="bg-green-600 text-white px-2 py-1 rounded">
                  Buy
                </button>
                <button
                  onClick={() => openTradeSidebar(stock, "sell")}
                  className="bg-red-600 text-white px-2 py-1 rounded">
                  Sell
                </button>
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

      <TradeSidebar
        isOpen={!!selectedStock}
        onClose={closeSidebar}
        stock={selectedStock}
        mode={tradeMode}
        onSuccess={(msg) => {
          console.log(msg);
          window.dispatchEvent(new Event("balanceUpdated")); // Triggers profile/home update
        }}
      />
    </div>
  );
};

export default Home;
