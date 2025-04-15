import React, { useEffect, useState } from "react";
import axios from "axios";

const Home = () => {
  const [stocks, setStocks] = useState([]);
  const [visibleRows, setVisibleRows] = useState(10);

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
    const quantity = 1; // Hardcoded for now
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/holdings`,
        {
          symbol: stock.symbol,
          name: stock.name,
          quantity,
          buy_price: parseFloat(stock.sell.replace("$", "")),
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      // ✅ Trigger Navbar to refresh balance
      window.dispatchEvent(new Event("balanceUpdated"));
      alert("Bought!");
    } catch (err) {
      console.error("Buy failed:", err.response?.data?.error || err.message);
      alert("Failed to buy.");
    }
  };

  const handleSell = async (stock) => {
    const quantity = 1;
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/sell`,
        {
          symbol: stock.symbol,
          quantity,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      // ✅ Trigger Navbar to refresh balance
      window.dispatchEvent(new Event("balanceUpdated"));
      alert("Sold!");
    } catch (err) {
      console.error("Sell failed:", err.response?.data?.error || err.message);
      alert("Failed to sell. You might not own this stock.");
    }
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
          {stocks.slice(0, visibleRows).map((stock, index) => (
            <tr key={index} className="border-b text-center">
              <td className="py-2 px-4">{stock.name}</td>
              <td className="py-2 px-4">{stock.change}</td>
              <td className="py-2 px-4">{stock.sell}</td>
              <td className="py-2 px-4">{stock.buy}</td>
              <td className="py-2 px-4 space-x-2">
                <button
                  onClick={() => handleBuy(stock)}
                  className="bg-green-600 text-white px-2 py-1 rounded">
                  Buy
                </button>
                <button className="bg-red-600 text-white px-2 py-1 rounded">
                  Sell
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Home;
