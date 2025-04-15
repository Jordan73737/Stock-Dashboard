// components/Home.jsx
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

  const handleLoadMore = () => {
    setVisibleRows((prev) => prev + 20);
  };

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
          </tr>
        </thead>
        <tbody>
          {stocks.slice(0, visibleRows).map((stock, index) => (
            <tr key={index} className="border-b">
              <td className="py-2 px-4">{stock.name}</td>
              <td className="py-2 px-4">{stock.change}</td>
              <td className="py-2 px-4">{stock.sell}</td>
              <td className="py-2 px-4">{stock.buy}</td>
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
