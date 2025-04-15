import React, { useEffect, useState } from "react";
import axios from "axios";

const Profile = () => {
  const [balance, setBalance] = useState(0);
  const [inputBalance, setInputBalance] = useState("");
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchProfileData = async () => {
    const token = localStorage.getItem("token");
    setLoading(true);
    try {
      const [balanceRes, holdingsRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/balance`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/holdings`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const enrichedHoldings = await Promise.all(
        holdingsRes.data.map(async (holding) => {
          try {
            const quoteRes = await axios.get(
              `https://finnhub.io/api/v1/quote?symbol=${holding.symbol}`,
              {
                params: {
                  token: import.meta.env.VITE_FINNHUB_API_KEY,
                },
              }
            );

            const currentPrice = quoteRes.data.c;
            const currentValue = currentPrice * holding.quantity;
            const originalCost = holding.buy_price * holding.quantity;
            const profitLoss = currentValue - originalCost;

            return {
              ...holding,
              currentPrice,
              currentValue,
              profitLoss,
            };
          } catch {
            return {
              ...holding,
              currentPrice: 0,
              currentValue: 0,
              profitLoss: 0,
            };
          }
        })
      );

      setBalance(balanceRes.data.balance);
      setHoldings(enrichedHoldings);
    } catch (err) {
      console.error("Error fetching profile data", err);
    } finally {
      setLoading(false);
    }
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
    window.dispatchEvent(new Event("balanceUpdated"));
    fetchProfileData();
  };

  const handleSell = async (symbol) => {
    const token = localStorage.getItem("token");
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/sell`,
        { symbol, quantity: 1 },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      window.dispatchEvent(new Event("balanceUpdated"));
      fetchProfileData();
    } catch (err) {
      alert("Error selling stock.");
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Your Profile</h2>
      <div className="mb-4">
        <p className="mb-2 font-medium">
          Current Balance: ${Number(balance || 0).toFixed(2)}
        </p>

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

      {loading ? (
        <p>Loading holdings...</p>
      ) : holdings.length === 0 ? (
        <p className="text-gray-500">No holdings found.</p>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4">Symbol</th>
              <th className="py-2 px-4">Name</th>
              <th className="py-2 px-4">Qty</th>
              <th className="py-2 px-4">Buy Price</th>
              <th className="py-2 px-4">Current Price</th>
              <th className="py-2 px-4">Profit/Loss</th>
              <th className="py-2 px-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((stock, index) => (
              <tr key={index} className="border-b">
                <td className="py-2 px-4">{stock.symbol}</td>
                <td className="py-2 px-4">{stock.name}</td>
                <td className="py-2 px-4">{stock.quantity}</td>
                <td className="py-2 px-4">${stock.buy_price.toFixed(2)}</td>
                <td className="py-2 px-4">${stock.currentPrice.toFixed(2)}</td>
                <td
                  className={`py-2 px-4 font-semibold ${
                    stock.profitLoss > 0
                      ? "text-green-600"
                      : stock.profitLoss < 0
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}>
                  ${stock.profitLoss.toFixed(2)}
                </td>
                <td className="py-2 px-4">
                  <button
                    onClick={() => handleSell(stock.symbol)}
                    className="bg-red-600 text-white px-3 py-1 rounded">
                    Sell 1
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Profile;
