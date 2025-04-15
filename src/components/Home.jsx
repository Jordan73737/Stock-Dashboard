import React, { useEffect, useState } from "react";
import axios from "axios";

const Home = () => {
  const [stocks, setStocks] = useState([]);
  const [visibleRows, setVisibleRows] = useState(20);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/api/popular-stocks`
        );
        setStocks(response.data);
      } catch (error) {
        console.error("Failed to fetch stock data", error);
      }
    };
    fetchStocks();
  }, []);

  const handleBuy = async (stock) => {
    const quantity = parseInt(prompt("Enter quantity to buy:"), 10);
    if (!quantity || quantity <= 0) return;
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/holdings/buy`,
        {
          symbol: stock.symbol,
          name: stock.name,
          quantity,
          buy_price: parseFloat(stock.buy.replace("$", "")),
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      alert("Stock bought successfully!");
    } catch (err) {
      alert("Error buying stock");
    }
  };

  const handleSell = async (stock) => {
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/holdings/sell`,
        { symbol: stock.symbol },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      alert("Stock sold successfully!");
    } catch (err) {
      alert("Error selling stock");
    }
  };

  const handleLoadMore = () => setVisibleRows((prev) => prev + 20);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-center">Popular Stocks</h2>
      <table className="w-full text-sm text-left border">
        <thead className="bg-gray-200">
          <tr>
            <th className="py-2 px-4">Company</th>
            <th className="py-2 px-4">Change %</th>
            <th className="py-2 px-4">Sell</th>
            <th className="py-2 px-4">Buy</th>
            <th className="py-2 px-4">Buy</th>
            <th className="py-2 px-4">Sell</th>
          </tr>
        </thead>
        <tbody>
          {stocks.slice(0, visibleRows).map((stock, index) => (
            <tr key={index} className="border-b">
              <td className="py-2 px-4">{stock.name}</td>
              <td className="py-2 px-4">{stock.change}</td>
              <td className="py-2 px-4">{stock.sell}</td>
              <td className="py-2 px-4">{stock.buy}</td>
              <td className="py-2 px-4">
                <button
                  onClick={() => handleBuy(stock)}
                  className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">
                  Buy
                </button>
              </td>
              <td className="py-2 px-4">
                <button
                  onClick={() => handleSell(stock)}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">
                  Sell
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {visibleRows < stocks.length && (
        <div className="text-center mt-4">
          <button
            onClick={handleLoadMore}
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default Home;
