// components/Dashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import {
  fetchFavorites,
  addFavorite,
  removeFavorite,
  setSearchResults,
  setIsSearching,
  clearSearchResults,
  updateStockHighlight,
  updateStockPrice,
  updateFavoriteStatus,
  setStocks,
  toggleFavorite,
} from "../slices/stocksSlice";

const Dashboard = () => {
  const dispatch = useDispatch();
  const { stocks, loading, error, searchResults, isSearching } = useSelector(
    (state) => state.stocks
  );
  const { token } = useSelector((state) => state.auth);

  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  const API_KEY = "cv9n049r01qpd9s86e70cv9n049r01qpd9s86e7g";
  const [rawStocks, setRawStocks] = useState([]);

  useEffect(() => {
    dispatch(fetchFavorites());
  }, [dispatch]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [searchRef]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      dispatch(clearSearchResults());
      setShowResults(false);
      return;
    }

    const searchTimer = setTimeout(async () => {
      dispatch(setIsSearching(true));

      try {
        const response = await axios.get(
          `https://finnhub.io/api/v1/search?q=${searchQuery}&token=${API_KEY}`
        );

        if (
          response.data &&
          response.data.result &&
          response.data.result.length > 0
        ) {
          const filteredResults = response.data.result
            .filter((item) => item.type === "Common Stock")
            .slice(0, 5);

          dispatch(setSearchResults(filteredResults));
          setShowResults(true);
        } else {
          dispatch(setSearchResults([]));
          setShowResults(false);
        }
      } catch (err) {
        console.error("Search error:", err);
        dispatch(setSearchResults([]));
        setShowResults(false);
      } finally {
        dispatch(setIsSearching(false));
      }
    }, 500);

    return () => clearTimeout(searchTimer);
  }, [searchQuery, dispatch]);

  const handleAddStock = async (symbol, name) => {
    if (stocks.some((stock) => stock.symbol === symbol)) {
      alert(`${symbol} is already in your dashboard`);
      return;
    }

    try {
      await dispatch(addFavorite({ symbol, name })).unwrap();
      dispatch(fetchFavorites());
      setSearchQuery("");
      setShowResults(false);
    } catch (err) {
      console.error("Error adding stock:", err);
      alert(`Failed to add ${symbol}. Please try again later.`);
    }
  };

  const handleRemoveStock = (symbol) => {
    dispatch(removeFavorite(symbol));
    const updatedStocks = stocks.filter((stock) => stock.symbol !== symbol);
    dispatch(setStocks(updatedStocks));
  };

  const handleToggleFavorite = (symbol, name, isCurrentlyFavorite) => {
    dispatch(toggleFavorite(symbol, name, isCurrentlyFavorite));

    // Optimistically update the stock's favorite status in rawStocks
    setRawStocks((prev) =>
      prev.map((stock) =>
        stock.symbol === symbol
          ? { ...stock, favorite: !isCurrentlyFavorite }
          : stock
      )
    );
  };

  useEffect(() => {
    if (stocks.length === 0) return;

    const updateInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * stocks.length);
      const stockToUpdate = stocks[randomIndex];

      const changeAmount = (Math.random() * 2 - 1).toFixed(2);
      const newPrice = (
        parseFloat(stockToUpdate.price) + parseFloat(changeAmount)
      ).toFixed(2);

      dispatch(
        updateStockPrice({
          id: stockToUpdate.id,
          price: newPrice,
          change: changeAmount,
          highlight: true,
        })
      );

      setTimeout(() => {
        dispatch(
          updateStockHighlight({ id: stockToUpdate.id, highlight: false })
        );
      }, 1000);
    }, 5000);

    return () => clearInterval(updateInterval);
  }, [stocks, dispatch]);

  const sortedStocks = [...stocks].sort(
    (a, b) => (b.favorite === true) - (a.favorite === true)
  );

  return (
    <>
      <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
        Your Stock Dashboard
      </h1>

      {error && (
        <div
          className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6"
          role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="mb-6 relative" ref={searchRef}>
        <div className="flex">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a stock..."
            className="w-full p-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            onFocus={() => searchQuery.trim() && setShowResults(true)}
          />
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r-lg transition-colors"
            onClick={() =>
              searchQuery.trim() && handleAddStock(searchQuery, searchQuery)
            }
            disabled={isSearching}>
            Add Stock
          </button>
        </div>

        {showResults && searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
            {searchResults.map((result) => (
              <div
                key={result.symbol}
                className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                onClick={() =>
                  handleAddStock(result.symbol, result.description)
                }>
                <div className="font-medium">{result.symbol}</div>
                <div className="text-sm text-gray-600">
                  {result.description}
                </div>
              </div>
            ))}
          </div>
        )}

        {isSearching && (
          <div className="absolute right-16 top-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>Loading your stocks...</p>
          </div>
        ) : stocks.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">
              You haven't added any stocks yet. Search above to add stocks to
              your dashboard.
            </p>
          </div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-200">
                <th className="py-3 px-4 text-left">Company</th>
                <th className="py-3 px-4 text-right">Price</th>
                <th className="py-3 px-4 text-right">Change</th>
                <th className="py-3 px-4 text-center">Favorite</th>
                <th className="py-3 px-4 text-center">Remove</th>
              </tr>
            </thead>
            <tbody>
              {sortedStocks.map((stock) => (
                <tr
                  key={stock.id}
                  className={`border-b border-gray-200 transition-colors ${
                    stock.highlight ? "bg-blue-100" : "hover:bg-gray-50"
                  } ${stock.error ? "opacity-70" : ""}`}>
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                        {stock.symbol.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium">{stock.name}</div>
                        <div className="text-sm text-gray-500">
                          {stock.symbol}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right font-medium">
                    ${stock.price}
                  </td>
                  <td
                    className={`py-4 px-4 text-right font-medium ${
                      parseFloat(stock.change) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}>
                    {parseFloat(stock.change) >= 0 ? "+" : ""}
                    {stock.change}%
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button
                      onClick={() =>
                        handleToggleFavorite(
                          stock.symbol,
                          stock.name,
                          stock.favorite
                        )
                      }
                      className="focus:outline-none mx-auto block">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill={stock.favorite ? "currentColor" : "none"}
                        stroke="currentColor"
                        className={`w-6 h-6 ${
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
                  <td className="py-4 px-4 text-center">
                    <button
                      onClick={() => handleRemoveStock(stock.symbol)}
                      className="text-gray-500 hover:text-red-600 focus:outline-none transition-colors">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        className="w-6 h-6">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

export default Dashboard;
