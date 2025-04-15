import React, { useEffect, useState } from "react";
import axios from "axios";

const Profile = () => {
  const [balance, setBalance] = useState(0);
  const [inputBalance, setInputBalance] = useState("");
  const [holdings, setHoldings] = useState([]);

  const fetchProfileData = async () => {
    const token = localStorage.getItem("token");

    const [balanceRes, holdingsRes] = await Promise.all([
      axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/holdings`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    setBalance(balanceRes.data.balance);
    setHoldings(holdingsRes.data);
  };

  const handleSetBalance = async () => {
    const token = localStorage.getItem("token");
    await axios.post(
      `${import.meta.env.VITE_API_BASE_URL}/api/balance`,
      { balance: inputBalance },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    fetchProfileData();
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Your Profile</h2>
      <div className="mb-4">
        <p className="mb-2 font-medium">Current Balance: ${balance}</p>
        <input
          type="number"
          value={inputBalance}
          onChange={(e) => setInputBalance(e.target.value)}
          placeholder="Enter new balance"
          className="border px-2 py-1 mr-2"
        />
        <button
          onClick={handleSetBalance}
          className="bg-blue-600 text-white px-3 py-1 rounded">
          Set Balance
        </button>
      </div>

      <h3 className="text-xl font-semibold mt-6 mb-2">Your Holdings</h3>
      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="py-2 px-4">Symbol</th>
            <th className="py-2 px-4">Name</th>
            <th className="py-2 px-4">Quantity</th>
            <th className="py-2 px-4">Buy Price</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((stock, index) => (
            <tr key={index} className="border-b">
              <td className="py-2 px-4">{stock.symbol}</td>
              <td className="py-2 px-4">{stock.name}</td>
              <td className="py-2 px-4">{stock.quantity}</td>
              <td className="py-2 px-4">${stock.buy_price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Profile;
