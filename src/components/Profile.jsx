import React, { useEffect, useState } from "react";
import axios from "axios";

const Profile = () => {
  const [holdings, setHoldings] = useState([]);

  useEffect(() => {
    const fetchHoldings = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/api/holdings`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        setHoldings(res.data);
      } catch (err) {
        console.error("Failed to load holdings", err);
      }
    };
    fetchHoldings();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-center mb-4">My Portfolio</h2>
      <table className="w-full border">
        <thead className="bg-gray-200">
          <tr>
            <th className="py-2 px-4">Stock</th>
            <th className="py-2 px-4">Quantity</th>
            <th className="py-2 px-4">Buy Price</th>
            <th className="py-2 px-4">Buy Total</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((stock, idx) => (
            <tr key={idx} className="border-b">
              <td className="py-2 px-4">{stock.symbol}</td>
              <td className="py-2 px-4">{stock.quantity}</td>
              <td className="py-2 px-4">${stock.buy_price}</td>
              <td className="py-2 px-4">
                ${(+stock.buy_price * stock.quantity).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Profile;
