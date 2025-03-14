import { useState, useEffect, useRef } from "react";

function App() {
  const [stocks, setStocks] = useState([
    {
      id: 1,
      name: "Apple",
      symbol: "AAPL",
      price: "0",
      change: "0",
      favorite: false,
      highlight: false,
    },
    {
      id: 2,
      name: "Microsoft",
      symbol: "MSFT",
      price: "0",
      change: "0",
      favorite: false,
      highlight: false,
    },
    {
      id: 3,
      name: "Google",
      symbol: "GOOGL",
      price: "0",
      change: "0",
      favorite: false,
      highlight: false,
    },
    {
      id: 4,
      name: "Amazon",
      symbol: "AMZN",
      price: "0",
      change: "0",
      favorite: false,
      highlight: false,
    },
    {
      id: 5,
      name: "Tesla",
      symbol: "TSLA",
      price: "0",
      change: "0",
      favorite: false,
      highlight: false,
    },
  ]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef(null);

  const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

  // Close search results when clicking outside
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

  // Fetch initial stock data
  useEffect(() => {
    const fetchStockData = async () => {
      try {
        setLoading(true);

        // Load favorites from localStorage
        const savedFavorites =
          JSON.parse(localStorage.getItem("favoriteStocks")) || [];

        // Create promises for all stock fetch requests
        const fetchPromises = stocks.map((stock) => {
          return fetch(
            `https://finnhub.io/api/v1/quote?symbol=${stock.symbol}&token=${API_KEY}`
          )
            .then((response) => {
              if (!response.ok) throw new Error("Network response was not ok");
              return response.json();
            })
            .then((data) => {
              if (!data.c) throw new Error("Invalid data received");

              return {
                ...stock,
                price: data.c.toFixed(2),
                change: (((data.c - data.pc) / data.pc) * 100).toFixed(2),
                favorite: savedFavorites.includes(stock.symbol),
                highlight: false,
              };
            })
            .catch((err) => {
              console.error(`Error fetching data for ${stock.symbol}:`, err);
              // Return stock with default values if API call fails
              return {
                ...stock,
                price: "0.00",
                change: "0.00",
                error: true,
              };
            });
        });

        // Wait for all fetches to complete
        const updatedStocks = await Promise.all(fetchPromises);

        // Sort to put favorites at the top
        updatedStocks.sort((a, b) => {
          if (a.favorite && !b.favorite) return -1;
          if (!a.favorite && b.favorite) return 1;
          return 0;
        });

        setStocks(updatedStocks);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching stock data:", err);
        setError(
          "Failed to fetch real-time stock data. Some values may be missing or outdated."
        );
        setLoading(false);
      }
    };

    fetchStockData();
  }, []);

  // Search for stocks with API only (no fallback)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const searchTimer = setTimeout(async () => {
      setIsSearching(true);

      try {
        const response = await fetch(
          `https://finnhub.io/api/v1/search?q=${searchQuery}&token=${API_KEY}`
        );

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = await response.json();

        if (data && data.result && data.result.length > 0) {
          const filteredResults = data.result
            .filter((item) => item.type === "Common Stock")
            .slice(0, 5);

          setSearchResults(filteredResults);
          setShowResults(true);
        } else {
          setSearchResults([]);
          setShowResults(false);
        }
      } catch (err) {
        console.error("Search error:", err);
        setSearchResults([]);
        setShowResults(false);
        setError("Search failed. Please try again later.");
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(searchTimer);
  }, [searchQuery]);

  // Add new stock with real API data
  const addStock = async (symbol, name) => {
    // Check if stock already exists
    if (stocks.some((stock) => stock.symbol === symbol)) {
      alert(`${symbol} is already in your dashboard`);
      return;
    }

    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch stock data");
      }

      const data = await response.json();

      if (!data.c) {
        throw new Error("Invalid data received");
      }

      const newStock = {
        id: Date.now(),
        name: name,
        symbol: symbol,
        price: data.c.toFixed(2),
        change: (((data.c - data.pc) / data.pc) * 100).toFixed(2),
        favorite: true,
        highlight: true,
      };

      // Add to beginning and ensure favorites are at top
      setStocks((prevStocks) => {
        const newStocks = [newStock, ...prevStocks];
        return newStocks.sort((a, b) => {
          if (a.favorite && !b.favorite) return -1;
          if (!a.favorite && b.favorite) return 1;
          return 0;
        });
      });

      // Clear search
      setSearchQuery("");
      setShowResults(false);
    } catch (err) {
      console.error("Error adding stock:", err);
      alert(`Failed to add ${symbol}. Please try again later.`);
    }
  };

  // Toggle favorite status and reorder
  const toggleFavorite = (id) => {
    const updatedStocks = stocks.map((stock) =>
      stock.id === id ? { ...stock, favorite: !stock.favorite } : stock
    );

    // Sort to move favorites to the top
    updatedStocks.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return 0;
    });

    setStocks(updatedStocks);

    // Save favorites to localStorage
    const favorites = updatedStocks
      .filter((stock) => stock.favorite)
      .map((stock) => stock.symbol);
    localStorage.setItem("favoriteStocks", JSON.stringify(favorites));
  };

  // Remove stock from table
  const removeStock = (id) => {
    setStocks((prevStocks) => prevStocks.filter((stock) => stock.id !== id));
  };

  // Simulate occasional price updates for demo
  useEffect(() => {
    const updateInterval = setInterval(() => {
      setStocks((prevStocks) => {
        return prevStocks.map((stock) => {
          // 1 in 5 chance of updating
          if (Math.random() > 0.8) {
            const changeAmount = (Math.random() * 2 - 1).toFixed(2);
            const newPrice = (
              parseFloat(stock.price) + parseFloat(changeAmount)
            ).toFixed(2);

            return {
              ...stock,
              price: newPrice,
              change: changeAmount,
              highlight: true,
            };
          }
          return { ...stock, highlight: false };
        });
      });
    }, 5000);

    return () => clearInterval(updateInterval);
  }, []);

  // Reset highlight after animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setStocks((prevStocks) =>
        prevStocks.map((stock) => ({ ...stock, highlight: false }))
      );
    }, 1000);

    return () => clearTimeout(timer);
  }, [stocks]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="bg-white shadow-md p-4 sticky top-0 w-full">
        <div className="container mx-auto flex justify-between items-center">
          <div className="font-bold text-xl text-blue-600">StockDash</div>
          <div className="flex space-x-4">
            <a href="#" className="hover:text-blue-600 transition-colors">
              Home
            </a>
            <a href="#" className="hover:text-blue-600 transition-colors">
              About
            </a>
            <a href="#" className="hover:text-blue-600 transition-colors">
              Services
            </a>
            <a href="#" className="hover:text-blue-600 transition-colors">
              Contact
            </a>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="container mx-auto mt-10 px-4">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          Stock Dashboard
        </h1>

        {/* Error message */}
        {error && (
          <div
            className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6"
            role="alert"
          >
            <p>{error}</p>
          </div>
        )}

        {/* Search bar */}
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
                searchQuery.trim() && addStock(searchQuery, searchQuery)
              }
              disabled={isSearching}
            >
              Add Stock
            </button>
          </div>

          {/* Search results dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
              {searchResults.map((result) => (
                <div
                  key={result.symbol}
                  className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                  onClick={() => addStock(result.symbol, result.description)}
                >
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

        {/* Stock Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p>Loading stock data...</p>
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
                {stocks.map((stock) => (
                  <tr
                    key={stock.id}
                    className={`border-b border-gray-200 transition-colors ${
                      stock.highlight ? "bg-blue-100" : "hover:bg-gray-50"
                    } ${stock.error ? "opacity-70" : ""}`}
                  >
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
                      }`}
                    >
                      {parseFloat(stock.change) >= 0 ? "+" : ""}
                      {stock.change}%
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => toggleFavorite(stock.id)}
                        className="focus:outline-none"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill={stock.favorite ? "currentColor" : "none"}
                          stroke="currentColor"
                          className={`w-6 h-6 ${
                            stock.favorite ? "text-yellow-400" : "text-gray-400"
                          }`}
                        >
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
                        onClick={() => removeStock(stock.id)}
                        className="text-gray-500 hover:text-red-600 focus:outline-none transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          className="w-6 h-6"
                        >
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
      </main>
    </div>
  );
}

export default App;
