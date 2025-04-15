import React, { useEffect, useState } from "react";
import axios from "axios";
import TradeSidebar from "./TradeSidebar"; // ✅ Import your TradeSidebar

const Home = () => {
  const [stocks, setStocks] = useState([]);
  const [visibleRows, setVisibleRows] = useState(10);
  const [selectedStock, setSelectedStock] = useState(null);
  const [tradeMode, setTradeMode] = useState(null); // 'buy' or 'sell'

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

  const openTradeSidebar = (stock, mode) => {
    setSelectedStock(stock);
    setTradeMode(mode);
  };

  const closeSidebar = () => {
    setSelectedStock(null);
    setTradeMode(null);
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
                  onClick={() => openTradeSidebar(stock, "buy")}
                  className="bg-green-600 text-white px-2 py-1 rounded">
                  Buy
                </button>
                <button
                  onClick={() => openTradeSidebar(stock, "sell")}
                  className="bg-red-600 text-white px-2 py-1 rounded">
                  Sell
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ✅ TradeSidebar rendered conditionally */}
      <TradeSidebar
        isOpen={!!selectedStock}
        onClose={closeSidebar}
        stock={selectedStock}
        mode={tradeMode}
      />
    </div>
  );
};

export default Home;
