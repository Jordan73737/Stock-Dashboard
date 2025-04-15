// components/Home.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

const popularSymbols = [
  "AAPL", // Apple
  "GOOGL", // Google
  "MSFT", // Microsoft
  "AMZN", // Amazon
  "TSLA", // Tesla
  "META", // Meta/Facebook
  "NVDA", // Nvidia
  "NFLX", // Netflix
  "BABA", // Alibaba
  "JPM", // JPMorgan Chase
  "V", // Visa
  "MA", // Mastercard
  "UNH", // UnitedHealth
  "DIS", // Disney
  "PEP", // PepsiCo
  "KO", // Coca-Cola
  "XOM", // Exxon Mobil
  "CVX", // Chevron
  "NKE", // Nike
  "INTC", // Intel
];

const Home = () => {
  const [stockData, setStockData] = useState([]);
  const [visibleRows, setVisibleRows] = useState(20);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const results = await Promise.all(
          popularSymbols.map(async (symbol) => {
            const [quoteRes, profileRes] = await Promise.all([
              axios.get(`https://finnhub.io/api/v1/quote`, {
                params: {
                  symbol,
                  token: import.meta.env.VITE_FINNHUB_API_KEY,
                },
              }),
              axios.get(`https://finnhub.io/api/v1/stock/profile2`, {
                params: {
                  symbol,
                  token: import.meta.env.VITE_FINNHUB_API_KEY,
                },
              }),
            ]);

            return {
              symbol,
              name: profileRes.data.name || symbol,
              changePercent: (quoteRes.data.dp || 0).toFixed(2) + "%",
              sell: `$${quoteRes.data.c?.toFixed(2) || "N/A"}`,
              buy: `$${(quoteRes.data.c + 1)?.toFixed(2) || "N/A"}`, // Fake spread
            };
          })
        );
        setStockData(results);
      } catch (error) {
        console.error("Failed to fetch stock data", error);
      }
    };

    fetchData();
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
          {stockData.slice(0, visibleRows).map((stock, index) => (
            <tr key={index} className="border-b">
              <td className="py-2 px-4">{stock.name}</td>
              <td className="py-2 px-4">{stock.changePercent}</td>
              <td className="py-2 px-4">{stock.sell}</td>
              <td className="py-2 px-4">{stock.buy}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {visibleRows < stockData.length && (
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
