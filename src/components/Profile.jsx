import React, { useEffect, useState } from "react";
import axios from "axios";
import TradeSidebar from "./TradeSidebar";

const Profile = () => {
  const [balance, setBalance] = useState(0);
  const [inputBalance, setInputBalance] = useState("");
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedStock, setSelectedStock] = useState(null);
  const [tradeMode, setTradeMode] = useState(null);

  const openTradeSidebar = (stock, mode) => {
    setSelectedStock(stock);
    setTradeMode(mode);
  };

  const closeSidebar = () => {
    setSelectedStock(null);
    setTradeMode(null);
  };

  const handleSidebarSuccess = (msg) => {
    setSuccessMessage(msg);
    fetchProfileData(); // Refresh holdings/balance
  };

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

  const handleDeposit = async () => {
    const depositAmount = parseFloat(inputBalance);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      alert("Please enter a positive amount.");
      return;
    }

    const token = localStorage.getItem("token");

    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/balance`,
        { balance: Number(balance) + Number(inputBalance) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (Number(inputBalance) <= 0) {
        alert("Please enter a positive number to deposit.");
        return;
      }

      setInputBalance(""); // Clear the input
      window.dispatchEvent(new Event("balanceUpdated"));
      fetchProfileData(); // Refresh balance on screen
    } catch (err) {
      console.error("Failed to deposit funds", err);
      alert("Failed to deposit. Try again.");
    }
  };

  // Already Using The Sidebar To Handle Selling
  // const handleSell = async (symbol) => {
  //   const token = localStorage.getItem("token");
  //   try {
  //     await axios.post(
  //       `${import.meta.env.VITE_API_BASE_URL}/api/sell`,
  //       { symbol, quantity: 1 },
  //       {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //         },
  //       }
  //     );
  //     window.dispatchEvent(new Event("balanceUpdated"));
  //     fetchProfileData();
  //   } catch (err) {
  //     alert("Error selling stock.");
  //   }
  // };

  useEffect(() => {
    fetchProfileData();
  }, []);
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchProfileData(); // initial fetch

    const listener = () => fetchProfileData();
    window.addEventListener("holdingsUpdated", listener);

    return () => window.removeEventListener("holdingsUpdated", listener);
  }, []);

  useEffect(() => {
    const handleBalanceUpdate = () => {
      fetchProfileData();
    };

    window.addEventListener("balanceUpdated", handleBalanceUpdate);
    return () =>
      window.removeEventListener("balanceUpdated", handleBalanceUpdate);
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
          min="0"
          step="0.01"
          value={inputBalance}
          onChange={(e) => setInputBalance(e.target.value)}
          placeholder="Enter deposit amount"
          className="border px-2 py-1 mr-2"
        />
        <button
          onClick={handleDeposit}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded">
          Deposit
        </button>
      </div>
      {successMessage && (
        <p className="text-green-600 mb-4 text-center font-medium">
          {successMessage}
        </p>
      )}

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
                <td className="py-2 px-4">
                  ${Number(stock.buy_price).toFixed(2)}
                </td>
                <td className="py-2 px-4">
                  ${Number(stock.currentPrice).toFixed(2)}
                </td>
                <td
                  className={`py-2 px-4 font-semibold ${
                    stock.profitLoss > 0
                      ? "text-green-600"
                      : stock.profitLoss < 0
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}>
                  ${Number(stock.profitLoss).toFixed(2)}
                </td>

                <td className="py-2 px-4">
                  <button
                    onClick={() =>
                      openTradeSidebar(
                        {
                          ...stock,
                          sell: `$${Number(stock.currentPrice).toFixed(2)}`,
                        },
                        "sell"
                      )
                    }
                    className="bg-red-600 text-white px-3 py-1 rounded">
                    Sell
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <TradeSidebar
        isOpen={!!selectedStock}
        onClose={closeSidebar}
        stock={selectedStock}
        mode={tradeMode}
        onSuccess={handleSidebarSuccess}
      />
    </div>
  );
};

export default Profile;
